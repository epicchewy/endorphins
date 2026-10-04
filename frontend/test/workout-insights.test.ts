import { expect, test } from 'bun:test'
import { workoutSteps } from '../app/services/workout-insights'
import {
  preferencesFromSearch,
  workoutReturnPath,
  workoutSearch,
} from '../app/services/workout-preferences'
import type { Workout } from '../app/services/workouts'

const plan: Workout = {
  id: 'plan-1',
  createdAt: '2026-10-01T12:00:00Z',
  level: 2,
  requestedMinutes: 45,
  estimatedMinutes: 43,
  warmupMinutes: 5,
  focus: 'legs',
  blocks: [
    {
      name: 'legs',
      sets: 2,
      estimatedMinutes: 26,
      difficulty: 'easy',
      exercises: [
        { name: 'Squat', reps: 12, difficulty: 'easy' },
        { name: 'Reverse lunge', reps: 10, difficulty: 'easy' },
      ],
    },
    {
      name: 'core',
      sets: 1,
      estimatedMinutes: 12,
      difficulty: 'medium',
      exercises: [{ name: 'Plank', rounds: 3, duration: 40, rest: 20, difficulty: 'medium' }],
    },
  ],
}

test('exercise view keeps block/set order and interval prescriptions without multiplying rounds', () => {
  const steps = workoutSteps(plan)
  expect(
    steps.map((step) =>
      step.kind === 'warmup'
        ? `Warm-up ${step.minutes}`
        : `${step.exercise.name} / set ${step.set} of ${step.sets}`,
    ),
  ).toEqual([
    'Warm-up 5',
    'Squat / set 1 of 2',
    'Reverse lunge / set 1 of 2',
    'Squat / set 2 of 2',
    'Reverse lunge / set 2 of 2',
    'Plank / set 1 of 1',
  ])
  expect(steps.at(-1)).toMatchObject({ exercise: { rounds: 3, duration: 40, rest: 20 } })
  expect(workoutSteps({ ...plan, warmupMinutes: 0 })[0]).toMatchObject({ kind: 'exercise', set: 1 })
})

test('return-to-builder URLs validate numeric settings and never accept a redirect destination', () => {
  expect(
    preferencesFromSearch(
      workoutSearch({ minutes: '75', level: '4', redirect: 'https://example.com' }),
    ),
  ).toEqual({ durationMinutes: 75, level: 4 })
  for (const minutes of [29, 121, 45.5, '', true, ['60'], {}, 'Infinity', '<script>']) {
    expect(preferencesFromSearch(workoutSearch({ minutes, level: 99 }))).toEqual({
      durationMinutes: 45,
      level: 2,
    })
  }
  expect(workoutReturnPath({ durationMinutes: 75, level: 4 })).toBe('/?minutes=75&level=4#builder')
  expect(workoutReturnPath({ durationMinutes: NaN, level: Infinity })).toBe(
    '/?minutes=45&level=2#builder',
  )
})
