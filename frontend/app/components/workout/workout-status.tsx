import type { MutationStatus } from '@tanstack/react-query'
import type { Workout } from '~/services/workouts'

export function WorkoutStatus({
  status,
  workout,
}: {
  status: MutationStatus
  workout: Workout | null
}) {
  return (
    <output className="sr-only">
      {status === 'pending'
        ? 'Generating your workout.'
        : status === 'success' && workout
          ? `Your workout is ready. ${workout.estimatedMinutes} estimated minutes, level ${workout.level}.`
          : ''}
    </output>
  )
}
