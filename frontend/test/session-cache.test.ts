import { expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { cacheCreatedWorkout, clearSessionCache } from '../app/services/session-cache'
import { queryKeys } from '../app/services/query-keys'
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

test('signing out removes the previous session without cancelling a new account', async () => {
  const client = new QueryClient()
  client.setQueryData(queryKeys.workoutList('old-session'), { private: 'old account' })
  client.setQueryData(queryKeys.workoutList('new-session'), { private: 'new account' })
  const result = Promise.withResolvers<string>()
  const pending = client.fetchQuery({
    queryKey: queryKeys.profile('old-session'),
    queryFn: () => result.promise,
    retry: false,
  })
  const settled = pending.catch(() => undefined)
  clearSessionCache(client, 'old-session')
  result.resolve('late private result')
  await settled
  expect(client.getQueriesData({ queryKey: queryKeys.account('old-session') })).toEqual([])
  expect(client.getQueryData<{ private: string }>(queryKeys.workoutList('new-session'))).toEqual({
    private: 'new account',
  })
  client.clear()
})

test('creation seeds immutable detail and refreshes every list page size and the summary only for its session', async () => {
  const client = new QueryClient()
  const affected = [
    queryKeys.workoutList('active'),
    queryKeys.workoutList('active', 1),
    queryKeys.workoutSummary('active'),
  ]
  for (const key of affected) client.setQueryData(key, { stale: true })
  const other = queryKeys.workoutList('other-session')
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
