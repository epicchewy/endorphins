import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getActivity, completeWorkout, undoCompletion } from '~/services/activity'
import { APIError } from '~/services/http'
import { queryKeys } from '~/services/query-keys'
import { useAccountSession, retryAccountQuery } from './use-account'

export function useActivity() {
  const { userId, sessionId, getToken } = useAccountSession()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  return useQuery({
    queryKey: queryKeys.activity(sessionId, timezone),
    queryFn: ({ signal }) => getActivity(timezone, getToken, signal),
    enabled: Boolean(userId),
    retry: retryAccountQuery,
    staleTime: 30_000,
  })
}
export function useWorkoutCompletion(workoutId: string) {
  const { sessionId, getToken, isCurrentSession } = useAccountSession()
  const client = useQueryClient()
  const attempt = useRef<string | null>(null)
  // The plan's own history changes with each write. Wait for it so the page
  // switches between "to do" and "completed" in one step; analytics refresh later.
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: queryKeys.workout(sessionId, workoutId) })
    void client.invalidateQueries({ queryKey: queryKeys.workoutLists(sessionId) })
    void client.invalidateQueries({ queryKey: queryKeys.activities(sessionId) })
  }
  const confirmation = useMutation({
    mutationKey: queryKeys.completion(sessionId),
    mutationFn: () => {
      attempt.current ??= crypto.randomUUID()
      return completeWorkout(workoutId, attempt.current, getToken)
    },
    retry: false,
    networkMode: 'always',
    onSuccess: async () => {
      if (!isCurrentSession()) return
      // A later confirmation on this page is another workout, so it needs a new key.
      attempt.current = null
      await refresh()
    },
  })
  const removal = useMutation({
    mutationKey: queryKeys.completion(sessionId),
    mutationFn: (id: string) => undoCompletion(id, getToken),
    retry: false,
    networkMode: 'always',
    onSuccess: async () => {
      if (!isCurrentSession()) return
      await refresh()
      confirmation.reset()
      attempt.current = null
    },
  })
  const completion = confirmation.data ?? null
  return {
    completion,
    pending: confirmation.isPending || removal.isPending,
    error: confirmation.error ?? removal.error,
    undone: removal.isSuccess,
    confirm: (options?: { onSuccess?: () => void }) => {
      removal.reset()
      confirmation.mutate(undefined, options)
    },
    undo: () => {
      if (completion) removal.mutate(completion.id)
    },
    restart:
      confirmation.error instanceof APIError && confirmation.error.code === 'completion_undone'
        ? () => {
            attempt.current = null
            confirmation.reset()
          }
        : undefined,
  }
}
export type WorkoutCompletion = ReturnType<typeof useWorkoutCompletion>
