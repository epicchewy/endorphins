import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { generateWorkout, type GenerateInput, type Workout } from '~/services/workouts'
import { queryKeys } from '~/services/query-keys'
import { cacheCreatedWorkout } from '~/services/session-cache'
import { createGenerationAttempt } from '~/services/generation-attempt'
import { useAccountSession } from './use-account'

export function useGenerateWorkout() {
  const { sessionId, getToken, isCurrentSession } = useAccountSession()
  const queryClient = useQueryClient()
  const router = useRouter()
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
    mutate: (input: GenerateInput, options?: { onSuccess?: (workout: Workout) => void }) => {
      // The calling route stays mounted while the next route loads. A late result must not
      // pull a reader who has already left back to the new plan.
      const from = router.latestLocation.pathname
      mutation.mutate(input, {
        onSuccess: (workout) => {
          if (router.latestLocation.pathname === from) options?.onSuccess?.(workout)
        },
      })
    },
    reset: () => {
      attempt.current?.reset()
      mutation.reset()
    },
  }
}
