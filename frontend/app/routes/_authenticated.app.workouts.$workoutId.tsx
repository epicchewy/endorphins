import { createFileRoute, Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { WorkoutSheet } from '~/components/workout/workout-sheet'
import { WorkoutStatus } from '~/components/workout/workout-status'
import { useWorkout } from '~/hooks/use-workouts'
import { Feedback, LoadingState } from '~/components/ui/feedback'
import { buttonClassName } from '~/components/ui/button-styles'
import { useAccountSession } from '~/hooks/use-account'
import { useGenerateWorkout } from '~/hooks/use-generate-workout'

export const Route = createFileRoute('/_authenticated/app/workouts/$workoutId')({
  component: SavedWorkout,
})
function SavedWorkout() {
  const { workoutId } = Route.useParams()
  const navigate = Route.useNavigate()
  const { isCurrentSession } = useAccountSession()
  const generator = useGenerateWorkout()
  const workout = useWorkout(workoutId)
  if (workout.isPending) return <LoadingState>Opening your workout…</LoadingState>
  if (workout.isError)
    return <Feedback retry={() => void workout.refetch()}>{workout.error.message}</Feedback>
  return (
    <>
      <div aria-busy={generator.isPending}>
        <WorkoutSheet
          key={workout.data.id}
          workout={workout.data}
          pending={generator.isPending}
          error={
            generator.error
              ? `${generator.error.message} Your saved workout is unchanged.`
              : undefined
          }
          onShuffle={() =>
            generator.mutate(
              { durationMinutes: workout.data.requestedMinutes, level: workout.data.level },
              {
                onSuccess: (created) => {
                  if (isCurrentSession())
                    void navigate({
                      to: '/app/workouts/$workoutId',
                      params: { workoutId: created.id },
                    })
                },
              },
            )
          }
          finish={
            <Link
              to="/app/workouts/$workoutId/finish"
              params={{ workoutId }}
              className={buttonClassName({ variant: 'primary' })}
            >
              <Check size={18} aria-hidden="true" /> I finished
            </Link>
          }
        />
      </div>
      <WorkoutStatus status={generator.status} workout={generator.data ?? null} />
    </>
  )
}
