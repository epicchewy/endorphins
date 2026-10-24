import { createFileRoute, Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { WorkoutSheet } from '~/components/workout/workout-sheet'
import { useWorkout } from '~/hooks/use-workouts'
import { useActivity, useWorkoutCompletion, type WorkoutCompletion } from '~/hooks/use-activity'
import { completionMilestone } from '~/services/activity'
import { Button } from '~/components/ui/button'
import { buttonClassName } from '~/components/ui/button-styles'
import { Feedback, LoadingState } from '~/components/ui/feedback'

export const Route = createFileRoute('/_authenticated/app/workouts/$workoutId')({
  // Each plan has its own completion attempt and exercise position.
  remountDeps: ({ params }) => params.workoutId,
  component: SavedWorkout,
})
function SavedWorkout() {
  const { workoutId } = Route.useParams()
  const workout = useWorkout(workoutId)
  const finish = useWorkoutCompletion(workoutId)
  if (workout.isPending) return <LoadingState>Opening your workout…</LoadingState>
  if (workout.isError)
    return <Feedback retry={() => void workout.refetch()}>{workout.error.message}</Feedback>
  return (
    <WorkoutSheet
      workout={workout.data}
      finish={finish}
      result={
        finish.completion ? (
          <Completed finish={finish} />
        ) : (
          finish.undone && (
            <Feedback tone="info">Completion removed. Your plan is still saved.</Feedback>
          )
        )
      }
    />
  )
}

// Stable, so it moves focus once when the result appears, not on every render.
const focusOnMount = (node: HTMLElement | null) => node?.focus()

function Completed({ finish }: { finish: WorkoutCompletion }) {
  const activity = useActivity()
  const count = activity.data?.completedCount ?? 0
  return (
    <section
      aria-labelledby="complete-title"
      className="mb-10 grid items-center gap-x-12 gap-y-7 rounded-panel border border-line bg-surface p-8 max-[600px]:p-5 min-[800px]:grid-cols-[minmax(0,1fr)_auto] print:hidden"
    >
      <div className="flex items-start gap-5 max-[600px]:gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-focus">
          <Check size={24} aria-hidden="true" />
        </span>
        <div>
          <h2
            id="complete-title"
            ref={focusOnMount}
            tabIndex={-1}
            className="font-display text-[clamp(30px,4vw,40px)] leading-tight tracking-tight focus:outline-none"
          >
            Workout complete.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            You made time to move. This workout is now part of your activity.
          </p>
        </div>
      </div>
      <div className="border-line max-[799px]:border-t max-[799px]:pt-6 min-[800px]:row-span-2 min-[800px]:min-w-[300px] min-[800px]:border-l min-[800px]:pl-12">
        {activity.isFetching && (
          <LoadingState className="min-h-0 border-0 bg-transparent p-0 py-2">
            Updating your progress…
          </LoadingState>
        )}
        {activity.isError && (
          <Feedback className="my-0" retry={() => void activity.refetch()}>
            {activity.error.message}
          </Feedback>
        )}
        {!activity.isFetching && activity.isSuccess && (
          <>
            <dl className="grid grid-cols-2 gap-10">
              <div>
                <dt className="text-xs text-muted">Completed workouts</dt>
                <dd className="mt-2 text-4xl font-medium tabular-nums">{count.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Active days this week</dt>
                <dd className="mt-2 text-4xl font-medium tabular-nums">
                  {activity.data.activeDaysThisWeek}
                </dd>
              </div>
            </dl>
            {completionMilestone(count) === count && (
              <p className="mt-5 text-sm font-semibold">
                {count === 1
                  ? 'Your first workout. A good start.'
                  : `You reached your ${count}-workout milestone.`}
              </p>
            )}
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-3 max-[600px]:grid min-[601px]:pl-17">
        <Link to="/app" className={buttonClassName({ variant: 'primary' })}>
          Back to dashboard
        </Link>
        <Button variant="ghost" pending={finish.pending} onClick={finish.undo}>
          Undo completion
        </Button>
      </div>
      {finish.error && <Feedback className="col-span-full my-0">{finish.error.message}</Feedback>}
    </section>
  )
}
