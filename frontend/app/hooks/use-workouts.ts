import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getWorkout, listWorkouts, summarizeWorkouts } from '~/services/workouts'
import { queryKeys } from '~/services/query-keys'
import { retryAccountQuery, useAccountSession } from './use-account'

export function useWorkouts(limit = 20) {
  const { userId, sessionId, getToken } = useAccountSession()
  return useInfiniteQuery({
    queryKey: queryKeys.workoutList(sessionId, limit),
    queryFn: ({ pageParam, signal }) => listWorkouts(pageParam, getToken, signal, limit),
    initialPageParam: '',
    getNextPageParam: (page) => page.nextCursor || undefined,
    enabled: Boolean(userId),
    retry: retryAccountQuery,
    staleTime: 30_000,
  })
}

export function useWorkoutSummary() {
  const { userId, sessionId, getToken } = useAccountSession()
  return useQuery({
    queryKey: queryKeys.workoutSummary(sessionId),
    queryFn: ({ signal }) => summarizeWorkouts(getToken, signal),
    enabled: Boolean(userId),
    retry: retryAccountQuery,
    staleTime: 30_000,
  })
}

export function useWorkout(id: string) {
  const { userId, sessionId, getToken } = useAccountSession()
  return useQuery({
    queryKey: queryKeys.workout(sessionId, id),
    queryFn: ({ signal }) => getWorkout(id, getToken, signal),
    enabled: Boolean(userId),
    retry: retryAccountQuery,
    // The plan never changes, but its completion history does.
    staleTime: 30_000,
  })
}
