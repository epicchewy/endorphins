import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { generateWorkout, type GenerateInput } from '~/services/workouts'
import { queryKeys } from '~/services/query-keys'
import { cacheCreatedWorkout } from '~/services/session-cache'
import { createGenerationAttempt } from '~/services/generation-attempt'
import { useAccountSession } from './use-account'

export function useGenerateWorkout() {
  const { sessionId, getToken, isCurrentSession } = useAccountSession()
  const queryClient = useQueryClient()
  const attempt = useRef<ReturnType<typeof createGenerationAttempt> | null>(null)
  const mutation = useMutation({
    mutationFn: (input: GenerateInput) => {
      attempt.current ??= createGenerationAttempt()
      return generateWorkout(input, getToken, attempt.current.keyFor(input))
    },
    // Report connectivity failures immediately; never automatically repeat a write.
    networkMode: 'always',
    retry: false,
    mutationKey: queryKeys.generate(sessionId),
    onSuccess: async (workout) => {
      attempt.current?.reset()
      await cacheCreatedWorkout(queryClient, sessionId, isCurrentSession, workout)
    },
  })
  return {
    ...mutation,
    reset: () => {
      attempt.current?.reset()
      mutation.reset()
    },
  }
}
