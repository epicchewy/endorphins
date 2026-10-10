import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getActivity, completeWorkout, undoCompletion, type Completion } from '~/services/activity'
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
type CompletionAction = { type: 'confirm' } | { type: 'undo'; id: string }

export function useWorkoutCompletion(workoutId: string) {
  const { sessionId, getToken, isCurrentSession } = useAccountSession()
  const client = useQueryClient()
  const attempt = useRef<string | null>(null)
  const [completion, setCompletion] = useState<Completion | null>(null)
  const mutation = useMutation({
    mutationKey: queryKeys.completion(sessionId),
    mutationFn: async (action: CompletionAction) => {
      if (action.type === 'undo') {
        await undoCompletion(action.id, getToken)
        return null
      }
      attempt.current ??= crypto.randomUUID()
      return completeWorkout(workoutId, attempt.current, getToken)
    },
    retry: false,
    networkMode: 'always',
    onSuccess: (result) => {
      if (!isCurrentSession()) return
      setCompletion(result)
      if (result === null) attempt.current = null
      void client.invalidateQueries({ queryKey: queryKeys.activities(sessionId) })
    },
  })
  return {
    completion,
    pending: mutation.isPending,
    error: mutation.error,
    undone: mutation.isSuccess && mutation.variables.type === 'undo',
    confirm: () => mutation.mutate({ type: 'confirm' }),
    undo: () => {
      if (completion) mutation.mutate({ type: 'undo', id: completion.id })
    },
    restart:
      mutation.error instanceof APIError && mutation.error.code === 'completion_undone'
        ? () => {
            attempt.current = null
            mutation.reset()
          }
        : undefined,
  }
}
