import type { Exercise, Workout } from './workouts'

export type WorkoutStep =
  | { kind: 'warmup'; minutes: number }
  | { kind: 'exercise'; exercise: Exercise; blockName: Workout['focus']; set: number; sets: number }

export function workoutSteps(workout: Workout): WorkoutStep[] {
  const steps: WorkoutStep[] =
    workout.warmupMinutes > 0 ? [{ kind: 'warmup', minutes: workout.warmupMinutes }] : []
  for (const block of workout.blocks) {
    for (let set = 1; set <= block.sets; set++) {
      for (const exercise of block.exercises)
        steps.push({ kind: 'exercise', exercise, blockName: block.name, set, sets: block.sets })
    }
  }
  return steps
}
