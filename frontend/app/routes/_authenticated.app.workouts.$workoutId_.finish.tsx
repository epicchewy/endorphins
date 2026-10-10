import { createFileRoute, Link } from '@tanstack/react-router'
import { Check, ArrowLeft } from 'lucide-react'
import { useWorkout } from '~/hooks/use-workouts'
import { useActivity, useWorkoutCompletion } from '~/hooks/use-activity'
import { completionMilestone } from '~/services/activity'
import { Button, buttonClassName } from '~/components/ui/button'
import { Feedback, LoadingState } from '~/components/ui/feedback'

export const Route = createFileRoute('/_authenticated/app/workouts/$workoutId_/finish')({
  remountDeps: ({ params }) => params.workoutId,
  component: Finish,
})
function Finish() {
  const { workoutId } = Route.useParams()
  const workout = useWorkout(workoutId)
  const finish = useWorkoutCompletion(workoutId)
  const activity = useActivity()
  return (
    <div className="mx-auto max-w-[600px]">
      <Link
        to="/app/workouts/$workoutId"
        params={{ workoutId }}
        className="mb-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to plan
      </Link>
      {workout.isPending && <LoadingState>Opening your workout…</LoadingState>}
      {workout.isError && (
        <Feedback retry={() => void workout.refetch()}>{workout.error.message}</Feedback>
      )}
      {workout.data && (
        <section
          className="rounded-panel border border-line bg-surface p-9 max-[600px]:p-6"
          aria-labelledby="finish-title"
        >
          {finish.completion ? (
            <>
              <span className="mb-6 flex size-12 items-center justify-center rounded-full bg-accent-soft text-focus">
                <Check size={24} aria-hidden="true" />
              </span>
              <h1
                id="finish-title"
                className="font-display text-[clamp(36px,6vw,48px)] leading-tight tracking-tight"
              >
                Workout complete.
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                You made time to move. This workout is now part of your activity.
              </p>
              {activity.isFetching && <LoadingState>Updating your progress…</LoadingState>}
              {activity.isError && (
                <Feedback retry={() => void activity.refetch()}>{activity.error.message}</Feedback>
              )}
              {!activity.isFetching && activity.isSuccess && (
                <>
                  <dl className="my-8 grid grid-cols-2 gap-6">
                    <div>
                      <dt className="text-xs text-muted">Completed workouts</dt>
                      <dd className="mt-2 text-4xl font-medium tabular-nums">
                        {activity.data.completedCount.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Active days this week</dt>
                      <dd className="mt-2 text-4xl font-medium tabular-nums">
                        {activity.data.activeDaysThisWeek}
                      </dd>
                    </div>
                  </dl>
                  {completionMilestone(activity.data.completedCount) ===
                    activity.data.completedCount && (
                    <p className="mb-7 border-t border-line pt-5 text-sm font-semibold">
                      {activity.data.completedCount === 1
                        ? 'Your first workout. A good start.'
                        : `You reached your ${activity.data.completedCount}-workout milestone.`}
                    </p>
                  )}
                </>
              )}
              <Link
                to="/app"
                className={buttonClassName({ variant: 'primary', className: 'w-full' })}
              >
                Back to dashboard
              </Link>
              <Button
                className="mt-3 w-full"
                variant="ghost"
                pending={finish.pending}
                onClick={finish.undo}
              >
                Undo completion
              </Button>
              {finish.error && <Feedback>{finish.error.message}</Feedback>}
            </>
          ) : (
            <>
              <p className="mb-5 text-xs text-muted">
                Level {workout.data.level} · {workout.data.estimatedMinutes} min est.
              </p>
              <h1
                id="finish-title"
                className="font-display text-[clamp(36px,6vw,48px)] leading-tight tracking-tight"
              >
                Finished your workout?
              </h1>
              <p className="mt-5 text-sm leading-relaxed text-muted">
                Mark it complete to add it to your activity. You can use this saved plan again for
                another workout.
              </p>
              {finish.undone && (
                <Feedback tone="info">Completion removed. Your plan is still saved.</Feedback>
              )}
              {finish.error && (
                <Feedback retry={finish.restart} retryLabel="Start a new confirmation">
                  {finish.error.message}
                </Feedback>
              )}
              <Button
                variant="primary"
                className="mt-8 w-full"
                pending={finish.pending}
                onClick={finish.confirm}
              >
                {finish.pending ? 'Saving completion…' : 'Mark workout complete'}
              </Button>
            </>
          )}
        </section>
      )}
    </div>
  )
}
