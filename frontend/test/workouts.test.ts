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
  [401, 'Your session has ended. Please sign in again.'],
  [422, 'Choose 30-120 minutes and a level from 1 to 5.'],
  [500, 'Your workouts are unavailable just now. Please try again.'],
])('HTTP %i returns safe copy and keeps diagnostic fields', async (status, message) => {
  spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json(
      { message: 'private SQL detail', code: 'internal_error', requestId: 'request-123' },
      { status },
    ),
  )
  await expect(generateWorkout(input, getToken)).rejects.toMatchObject({
    name: 'APIError',
    status,
    message,
    code: 'internal_error',
    requestId: 'request-123',
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
