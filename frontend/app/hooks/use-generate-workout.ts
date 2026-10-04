import { useState } from 'react'
import { mutationOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { generateWorkout, type GenerateInput } from '~/services/workouts'
import type { GetToken } from '~/services/http'
import { queryKeys } from '~/services/query-keys'
import { cacheCreatedWorkout } from '~/services/session-cache'
import { createGenerationAttempt } from '~/services/generation-attempt'
import { useAccountSession } from './use-account'

export const generateWorkoutOptions = (
  getToken: GetToken,
  keyForAttempt: (input: GenerateInput) => string = () => crypto.randomUUID(),
) =>
  mutationOptions({
    mutationFn: (input: GenerateInput) => generateWorkout(input, getToken, keyForAttempt(input)),
    // Report connectivity failures immediately; never automatically repeat a write.
    networkMode: 'always',
    retry: false,
  })

export function useGenerateWorkout() {
  const { sessionId, getToken, isCurrentSession } = useAccountSession()
  const queryClient = useQueryClient()
  const [attempt] = useState(createGenerationAttempt)
  const mutation = useMutation({
    ...generateWorkoutOptions(getToken, attempt.keyFor),
    mutationKey: queryKeys.generate(sessionId),
    onSuccess: async (workout) => {
      attempt.reset()
      await cacheCreatedWorkout(queryClient, sessionId, isCurrentSession, workout)
    },
  })
  return {
    ...mutation,
    reset: () => {
      attempt.reset()
      mutation.reset()
    },
  }
}
