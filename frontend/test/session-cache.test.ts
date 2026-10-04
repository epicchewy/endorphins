import { expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { cacheCreatedWorkout, clearSessionCache } from '../app/services/session-cache'
import { queryKeys } from '../app/services/query-keys'
import { libraryFilters } from '../app/services/library-search'
import type { Workout } from '../app/services/workouts'

const workout: Workout = {
  id: 'created',
  createdAt: '2026-10-04T12:00:00Z',
  level: 2,
  requestedMinutes: 45,
  estimatedMinutes: 43,
  warmupMinutes: 5,
  focus: 'legs',
  blocks: [],
}
const filters = libraryFilters({})

test('signing out removes the previous session without cancelling a new account', async () => {
  const client = new QueryClient()
  client.setQueryData(queryKeys.workoutList('old-session', filters), { private: 'old account' })
  client.setQueryData(queryKeys.workoutList('new-session', filters), { private: 'new account' })
  let finish: (data: string) => void = () => {}
  const pending = client.fetchQuery({
    queryKey: queryKeys.profile('old-session'),
    queryFn: () =>
      new Promise<string>((resolve) => {
        finish = resolve
      }),
    retry: false,
  })
  const settled = pending.catch(() => undefined)
  clearSessionCache(client, 'old-session')
  finish('late private result')
  await settled
  expect(client.getQueriesData({ queryKey: queryKeys.account('old-session') })).toEqual([])
  expect(
    client.getQueryData<{ private: string }>(queryKeys.workoutList('new-session', filters)),
  ).toEqual({
    private: 'new account',
  })
  client.clear()
})

test('creation seeds immutable detail and refreshes every affected list and summary only for its session', async () => {
  const client = new QueryClient()
  const filtered = libraryFilters({ q: 'squat', level: 2, sort: 'shortest' })
  const affected = [
    queryKeys.workoutList('active', filters),
    queryKeys.workoutList('active', filtered),
    queryKeys.workoutSummary('active', filters),
    queryKeys.workoutSummary('active', filtered),
  ]
  for (const key of affected) client.setQueryData(key, { stale: true })
  const other = queryKeys.workoutList('other-session', filters)
  client.setQueryData(other, { private: 'other account' })
  await cacheCreatedWorkout(client, 'active', () => true, workout)
  expect(client.getQueryData<Workout>(queryKeys.workout('active', workout.id))).toEqual(workout)
  for (const key of affected) expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  expect(client.getQueryState(other)?.isInvalidated).toBe(false)
  client.clear()
})

test('a late successful generation cannot restore a signed-out account cache', async () => {
  const client = new QueryClient()
  client.setQueryData(queryKeys.profile('signed-out'), { private: 'old account' })
  clearSessionCache(client, 'signed-out')
  await cacheCreatedWorkout(client, 'signed-out', () => false, workout)
  expect(client.getQueriesData({ queryKey: queryKeys.account('signed-out') })).toEqual([])
  client.clear()
})

test('equivalent filters share results and sorting does not fork the matching summary', () => {
  const client = new QueryClient()
  const first = libraryFilters({ q: '  SQUAT  ', level: 2 })
  const equivalent = libraryFilters({ q: 'squat', level: 2 })
  client.setQueryData(queryKeys.workoutList('active', first), 'saved result')
  expect(client.getQueryData<string>(queryKeys.workoutList('active', equivalent))).toBe(
    'saved result',
  )
  client.setQueryData(queryKeys.workoutSummary('active', first), { count: 9 })
  expect(
    client.getQueryData<{ count: number }>(
      queryKeys.workoutSummary('active', { ...equivalent, sort: 'shortest' }),
    ),
  ).toEqual({ count: 9 })
  expect(
    client.getQueryData(queryKeys.workoutList('active', { ...equivalent, sort: 'shortest' })),
  ).toBeUndefined()
  client.clear()
})
