import { afterEach, expect, spyOn, test } from 'bun:test'
import {
  generateWorkout,
  listWorkouts,
  summarizeWorkouts,
  type Workout,
} from '../app/services/workouts'

import { APIError } from '../app/services/http'
import { libraryFilters } from '../app/services/library-search'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('sends preferences to the Go generation endpoint', async () => {
  const response: Workout = {
    id: 'test-workout',
    createdAt: '2026-10-01T12:00:00Z',
    level: 2,
    requestedMinutes: 45,
    estimatedMinutes: 44,
    warmupMinutes: 5,
    focus: 'legs',
    blocks: [
      {
        name: 'legs',
        sets: 13,
        estimatedMinutes: 13,
        difficulty: 'easy',
        exercises: [{ name: 'Squats', difficulty: 'easy', reps: 10 }],
      },
      {
        name: 'upper body',
        sets: 13,
        estimatedMinutes: 13,
        difficulty: 'easy',
        exercises: [{ name: 'Push ups', difficulty: 'easy', reps: 10 }],
      },
      {
        name: 'core',
        sets: 13,
        estimatedMinutes: 13,
        difficulty: 'easy',
        exercises: [{ name: 'Situps', difficulty: 'easy', reps: 10 }],
      },
    ],
  }
  const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(response))
  expect(
    await generateWorkout({ durationMinutes: 45, level: 2 }, async () => 'test-token'),
  ).toEqual(response)
  expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/v1/workouts')
  const request = fetchSpy.mock.calls[0]?.[1]
  expect(request?.method).toBe('POST')
  expect(new Headers(request?.headers).get('authorization')).toBe('Bearer test-token')
  expect(JSON.parse(String(request?.body))).toEqual({ durationMinutes: 45, level: 2 })
  expect(request?.signal).toBeInstanceOf(AbortSignal)
})

test('network failures produce an actionable message', async () => {
  spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network error'))
  await expect(
    generateWorkout({ durationMinutes: 30, level: 1 }, async () => 'test-token'),
  ).rejects.toThrow('Check your connection')
})

test('service errors do not leak internal details', async () => {
  spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({ message: 'private database details' }, { status: 500 }),
  )
  await expect(
    generateWorkout({ durationMinutes: 30, level: 1 }, async () => 'test-token'),
  ).rejects.toThrow('Please try again')
})

test('invalid input gets a specific correction', async () => {
  spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}, { status: 422 }))
  await expect(
    generateWorkout({ durationMinutes: 10, level: 9 }, async () => 'test-token'),
  ).rejects.toThrow('30-120 minutes')
})

test('a missing session never sends an anonymous generation request', async () => {
  const fetchSpy = spyOn(globalThis, 'fetch')
  await expect(
    generateWorkout({ durationMinutes: 45, level: 2 }, async () => null),
  ).rejects.toThrow('sign in again')
  expect(fetchSpy).not.toHaveBeenCalled()
})

test('fetch uses a fresh session token for each request', async () => {
  let token = 'first-session-token'
  const fetchSpy = spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json({}))
    .mockResolvedValueOnce(Response.json({}))
  const getToken = async () => token
  await generateWorkout({ durationMinutes: 45, level: 2 }, getToken)
  token = 'refreshed-session-token'
  await generateWorkout({ durationMinutes: 45, level: 2 }, getToken)
  expect(new Headers(fetchSpy.mock.calls[0]?.[1]?.headers).get('authorization')).toBe(
    'Bearer first-session-token',
  )
  expect(new Headers(fetchSpy.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(
    'Bearer refreshed-session-token',
  )
})

test('an expired session produces a sign-in action without exposing server details', async () => {
  spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({ message: 'private verification details' }, { status: 401 }),
  )
  await expect(
    generateWorkout({ durationMinutes: 45, level: 2 }, async () => 'expired'),
  ).rejects.toThrow('sign in again')
})

test('filtered lists and summaries send the same account-wide criteria without sharing cursor or sort', async () => {
  const fetchSpy = spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json({ items: [], nextCursor: '' }))
    .mockResolvedValueOnce(
      Response.json({ count: 0, plannedMinutes: 0, averageMinutes: 0, levels: [] }),
    )
  const filters = libraryFilters({ q: '  SQUAT  ', level: 3, sort: 'shortest' })
  await listWorkouts(filters, 'next-page', async () => 'test-token')
  await summarizeWorkouts(filters, async () => 'test-token')
  const list = new URL(String(fetchSpy.mock.calls[0]?.[0]), 'https://endorphins.test')
  const summary = new URL(String(fetchSpy.mock.calls[1]?.[0]), 'https://endorphins.test')
  expect(Object.fromEntries(list.searchParams)).toEqual({
    q: 'squat',
    level: '3',
    sort: 'shortest',
    limit: '20',
    cursor: 'next-page',
  })
  expect(Object.fromEntries(summary.searchParams)).toEqual({ q: 'squat', level: '3' })
})

test('generation preserves the operation key on an explicit replay', async () => {
  const fetchSpy = spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json({}))
    .mockResolvedValueOnce(Response.json({}))
  const input = { durationMinutes: 45, level: 2 }
  await generateWorkout(input, async () => 'test-token', 'same-operation')
  await generateWorkout(input, async () => 'refreshed-token', 'same-operation')
  for (const call of fetchSpy.mock.calls)
    expect(new Headers(call[1]?.headers).get('Idempotency-Key')).toBe('same-operation')
})

test('safe errors retain the server code and request identifier for diagnostics', async () => {
  spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json(
      { message: 'private SQL detail', code: 'internal_error', requestId: 'request-123' },
      { status: 500 },
    ),
  )
  try {
    await generateWorkout({ durationMinutes: 45, level: 2 }, async () => 'test-token')
    throw new Error('Expected generation to fail')
  } catch (error) {
    expect(error).toBeInstanceOf(APIError)
    expect(error).toMatchObject({ status: 500, code: 'internal_error', requestId: 'request-123' })
    expect(error instanceof Error && error.message).not.toContain('SQL')
  }
})
