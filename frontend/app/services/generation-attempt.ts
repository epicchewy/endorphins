import type { GenerateInput } from './workouts'

// A retry belongs to the same save operation until it succeeds or preferences change.
export function createGenerationAttempt() {
  let current: { durationMinutes: number; level: number; key: string } | undefined
  return {
    keyFor(input: GenerateInput) {
      if (
        !current ||
        current.durationMinutes !== input.durationMinutes ||
        current.level !== input.level
      ) {
        current = { ...input, key: crypto.randomUUID() }
      }
      return current.key
    },
    reset() {
      current = undefined
    },
  }
}
