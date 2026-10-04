import type { GenerateInput } from './workouts'

function boundedInteger(value: unknown, min: number, max: number) {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN
  return Number.isInteger(number) && number >= min && number <= max ? number : undefined
}

export function workoutSearch(search: Record<string, unknown>): {
  minutes?: number
  level?: number
} {
  return {
    minutes: boundedInteger(search.minutes, 30, 120),
    level: boundedInteger(search.level, 1, 5),
  }
}

export function preferencesFromSearch(search: ReturnType<typeof workoutSearch>): GenerateInput {
  return { durationMinutes: search.minutes ?? 45, level: search.level ?? 2 }
}

export function workoutReturnPath(input: GenerateInput) {
  const valid = preferencesFromSearch(
    workoutSearch({ minutes: input.durationMinutes, level: input.level }),
  )
  return `/?minutes=${valid.durationMinutes}&level=${valid.level}#builder`
}
