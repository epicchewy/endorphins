import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import { generateWorkout } from '../app/services/workouts'

const input = { durationMinutes: 45, level: 2 }
const getToken = async () => 'test-token'
afterEach(() => mock.restore())

test('generation replays its input and key with a fresh token for each request', async () => {
  const fetchSpy = spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json({ id: 'saved-plan' }))
    .mockResolvedValueOnce(Response.json({ id: 'saved-plan' }))
  let token = 'first-token'
  const getToken = async () => token
  for (token of ['first-token', 'refreshed-token']) {
    expect((await generateWorkout(input, getToken, 'same-operation')).id).toBe('saved-plan')
    const [path, request] = fetchSpy.mock.calls.at(-1)!
    expect(path).toBe('/api/v1/workouts')
    expect(request?.method).toBe('POST')
    expect(new Headers(request?.headers).get('authorization')).toBe(`Bearer ${token}`)
    expect(new Headers(request?.headers).get('Idempotency-Key')).toBe('same-operation')
    expect(JSON.parse(String(request?.body))).toEqual(input)
    expect(request?.signal).toBeInstanceOf(AbortSignal)
  }
})

test.each([
  [422, 'Choose a duration from 30 to 120 minutes and a level from 1 to 5.', 'invalid_workout'],
  [500, 'Your workouts are unavailable just now. Please try again.', 'internal_error'],
])(
  'HTTP %i shows only API request-error copy and keeps diagnostic fields',
  async (status, message, code) => {
    spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(
        {
          message: status < 500 ? message : 'private SQL detail',
          code,
          requestId: 'request-123',
        },
        { status },
      ),
    )
    await expect(generateWorkout(input, getToken)).rejects.toMatchObject({
      name: 'APIError',
      status,
      message,
      code,
      requestId: 'request-123',
    })
  },
)

test('a response that is not an API error envelope gets generic copy', async () => {
  spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json(
      { message: 'upstream detail' },
      { status: 400, headers: { 'X-Request-ID': 'proxy-1' } },
    ),
  )
  await expect(generateWorkout(input, getToken)).rejects.toMatchObject({
    message: 'Your workouts are unavailable just now. Please try again.',
    code: 'unavailable',
    requestId: 'proxy-1',
  })
})

test('network failures produce an actionable message', async () => {
  spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network error'))
  await expect(generateWorkout(input, getToken)).rejects.toThrow('Check your connection')
})

test('a missing session never sends an anonymous generation request', async () => {
  const fetchSpy = spyOn(globalThis, 'fetch')
  await expect(generateWorkout(input, async () => null)).rejects.toThrow('sign in again')
  expect(fetchSpy).not.toHaveBeenCalled()
})
