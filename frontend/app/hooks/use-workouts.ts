import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getWorkout, listWorkouts, summarizeWorkouts } from '~/services/workouts'
import { libraryFilters, type LibrarySearch } from '~/services/library-search'
import { queryKeys } from '~/services/query-keys'
import { retryAccountQuery, useAccountSession } from './use-account'

export function useWorkouts(search: LibrarySearch, limit = 20) {
  const { userId, sessionId, getToken } = useAccountSession()
  const filters = libraryFilters(search)
  return useInfiniteQuery({
    queryKey: queryKeys.workoutList(sessionId, filters, limit),
    queryFn: ({ pageParam, signal }) => listWorkouts(filters, pageParam, getToken, signal, limit),
    initialPageParam: '',
    getNextPageParam: (page) => page.nextCursor || undefined,
    enabled: Boolean(userId),
    retry: retryAccountQuery,
    staleTime: 30_000,
  })
}

export function useWorkoutSummary(search: LibrarySearch) {
  const { userId, sessionId, getToken } = useAccountSession()
  const filters = libraryFilters(search)
  return useQuery({
    queryKey: queryKeys.workoutSummary(sessionId, filters),
    queryFn: ({ signal }) => summarizeWorkouts(filters, getToken, signal),
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
    // Saved snapshots are immutable. Session cache cleanup controls their lifetime.
    staleTime: Infinity,
  })
}
