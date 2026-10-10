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
  const confirmation = useMutation({
    mutationKey: queryKeys.completion(sessionId),
    mutationFn: () => {
      attempt.current ??= crypto.randomUUID()
      return completeWorkout(workoutId, attempt.current, getToken)
    },
    retry: false,
    networkMode: 'always',
    onSuccess: () => {
      if (!isCurrentSession()) return
      void client.invalidateQueries({ queryKey: queryKeys.activities(sessionId) })
    },
  })
  const removal = useMutation({
    mutationKey: queryKeys.completion(sessionId),
    mutationFn: (id: string) => undoCompletion(id, getToken),
    retry: false,
    networkMode: 'always',
    onSuccess: () => {
      if (!isCurrentSession()) return
      confirmation.reset()
      attempt.current = null
      void client.invalidateQueries({ queryKey: queryKeys.activities(sessionId) })
    },
  })
  const completion = confirmation.data ?? null
  return {
    completion,
    pending: confirmation.isPending || removal.isPending,
    error: confirmation.error ?? removal.error,
    undone: removal.isSuccess,
    confirm: () => {
      removal.reset()
      confirmation.mutate()
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
