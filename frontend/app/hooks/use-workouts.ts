import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getWorkout, listWorkouts, summarizeWorkouts } from '~/services/workouts'
import { libraryFilters, type LibraryFilters, type LibrarySearch } from '~/services/library-search'
import { queryKeys } from '~/services/query-keys'
import { retryAccountQuery, useAccountSession } from './use-account'

// Let search typing settle. A newer key aborts this wait, so no request is sent.
function settle({ q }: LibraryFilters, signal: AbortSignal) {
  if (!q) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 250)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

export function useWorkouts(search: LibrarySearch, limit = 20) {
  const { userId, sessionId, getToken } = useAccountSession()
  const filters = libraryFilters(search)
  return useInfiniteQuery({
    queryKey: queryKeys.workoutList(sessionId, filters, limit),
    queryFn: async ({ pageParam, signal }) => {
      if (!pageParam) await settle(filters, signal)
      return listWorkouts(filters, pageParam, getToken, signal, limit)
    },
    initialPageParam: '',
    getNextPageParam: (page) => page.nextCursor || undefined,
    // Keep the current results on screen while a changed filter loads.
    placeholderData: keepPreviousData,
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
    queryFn: async ({ signal }) => {
      await settle(filters, signal)
      return summarizeWorkouts(filters, getToken, signal)
    },
    placeholderData: keepPreviousData,
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
