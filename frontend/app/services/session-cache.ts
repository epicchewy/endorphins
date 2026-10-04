import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './query-keys'
import type { Workout } from './workouts'

export function clearSessionCache(client: QueryClient, sessionId: string | null | undefined) {
  const queryKey = queryKeys.account(sessionId)
  void client.cancelQueries({ queryKey })
  client.removeQueries({ queryKey })
  for (const mutation of client.getMutationCache().findAll({ mutationKey: queryKey })) {
    client.getMutationCache().remove(mutation)
  }
}

export async function cacheCreatedWorkout(
  client: QueryClient,
  sessionId: string | undefined,
  isCurrentSession: () => boolean,
  workout: Workout,
) {
  if (!sessionId || !isCurrentSession()) return
  client.setQueryData(queryKeys.workout(sessionId, workout.id), workout)
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.workoutLists(sessionId) }),
    client.invalidateQueries({ queryKey: queryKeys.workoutSummaries(sessionId) }),
  ])
}
