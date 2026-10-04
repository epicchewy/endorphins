import { expect, test } from 'bun:test'
import { createGenerationAttempt } from '../app/services/generation-attempt'

test('manual retries keep one operation key, while changed preferences and new workouts start another', () => {
  const attempt = createGenerationAttempt()
  const input = { durationMinutes: 45, level: 2 }
  const firstKey = attempt.keyFor(input)
  expect(attempt.keyFor({ ...input })).toBe(firstKey)
  const changedKey = attempt.keyFor({ ...input, level: 3 })
  expect(changedKey).not.toBe(firstKey)
  expect(attempt.keyFor({ ...input, level: 3 })).toBe(changedKey)
  attempt.reset()
  expect(attempt.keyFor({ ...input, level: 3 })).not.toBe(changedKey)
})

test('attempt identity is isolated between mounted generators and copies its input', () => {
  const first = createGenerationAttempt()
  const second = createGenerationAttempt()
  const input = { durationMinutes: 45, level: 2 }
  const key = first.keyFor(input)
  expect(second.keyFor(input)).not.toBe(key)
  input.durationMinutes = 60
  expect(first.keyFor(input)).not.toBe(key)
})
