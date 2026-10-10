import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { WorkoutSheet } from '~/components/workout/workout-sheet'
import { WorkoutStatus } from '~/components/workout/workout-status'
import { useWorkout } from '~/hooks/use-workouts'
import { Feedback, LoadingState } from '~/components/ui/feedback'
import { LocalDate } from '~/components/ui/local-date'
import { buttonClassName } from '~/components/ui/button-styles'
import { librarySearch, librarySearchDefaults } from '~/services/library-search'
import { useAccountSession } from '~/hooks/use-account'
import { useGenerateWorkout } from '~/hooks/use-generate-workout'

export const Route = createFileRoute('/_authenticated/app/workouts/$workoutId')({
  validateSearch: librarySearch,
  search: { middlewares: [stripSearchParams(librarySearchDefaults)] },
  component: SavedWorkout,
})
function SavedWorkout() {
  const { workoutId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { isCurrentSession } = useAccountSession()
  const generator = useGenerateWorkout()
  const workout = useWorkout(workoutId)
  return (
    <div className="mx-auto max-w-[960px] print:m-0 print:w-full print:max-w-none">
      <Link
        to="/app/workouts"
        search={search}
        className="inline-flex min-h-11 items-center gap-2.5 text-[13px] font-semibold underline-offset-4 hover:underline print:hidden"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Saved workouts
      </Link>
      {workout.isPending && <LoadingState>Opening your workout…</LoadingState>}
      {workout.isError && (
        <Feedback retry={() => void workout.refetch()}>{workout.error.message}</Feedback>
      )}
      {workout.data && (
        <>
          <p className="mt-3 mb-7 text-xs leading-[1.8] text-muted print:text-[10px]">
            Saved <LocalDate value={workout.data.createdAt} month="long" year="numeric" />.
            Shuffling saves a new workout to your account.
          </p>
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
                          search,
                        })
                    },
                  },
                )
              }
            >
              <Link
                to="/app/workouts/$workoutId/finish"
                params={{ workoutId }}
                className={buttonClassName({
                  variant: 'primary',
                  size: 'small',
                  className: 'max-[600px]:flex-1',
                })}
              >
                I finished
              </Link>
            </WorkoutSheet>
          </div>
          <WorkoutStatus status={generator.status} workout={generator.data ?? null} />
        </>
      )}
    </div>
  )
}
