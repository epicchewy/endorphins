import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowUpRight, Plus } from 'lucide-react'
import { useWorkouts, useWorkoutSummary } from '~/hooks/use-workouts'
import { WorkoutLibrary } from '~/components/workout/workout-library'
import { PageHeading } from '~/components/ui/page-heading'
import { Button } from '~/components/ui/button'
import { buttonVariants } from '~/components/ui/button-variants'
import { EmptyState, Feedback, LoadingState } from '~/components/ui/feedback'

export const Route = createFileRoute('/_authenticated/app/workouts/')({
  component: History,
})

function History() {
  const history = useWorkouts()
  const summary = useWorkoutSummary()
  const workouts = history.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <>
      <PageHeading
        title="Saved workouts"
        description="Keep a plan for another day, or create a new one."
        actions={
          <Link to="/app/new" className={buttonVariants()}>
            <Plus size={18} aria-hidden="true" /> New workout
          </Link>
        }
      />
      <WorkoutLibrary
        workouts={workouts}
        summary={summary.data}
        summaryState={
          summary.isError ? (
            <Feedback
              className="m-0 border-0 bg-transparent p-0 text-xs"
              retry={() => void summary.refetch()}
              retryLabel="Retry saved-plan count"
            >
              {summary.error.message}
            </Feedback>
          ) : undefined
        }
      >
        {history.isPending && <LoadingState>Loading your saved workouts…</LoadingState>}
        {history.isError && (
          <Feedback
            retry={() =>
              void (history.isFetchNextPageError ? history.fetchNextPage() : history.refetch())
            }
          >
            {history.error.message}
          </Feedback>
        )}
        {history.isSuccess && workouts.length === 0 && (
          <EmptyState
            title="No saved workouts yet."
            action={
              <Link to="/app/new" className={buttonVariants()}>
                Create my first workout <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            }
          >
            Choose your time and level. We’ll save your plan here.
          </EmptyState>
        )}
      </WorkoutLibrary>
      {history.hasNextPage && (
        <div className="flex justify-center pt-7">
          <Button
            variant="outline"
            pending={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            {history.isFetchingNextPage ? 'Loading more…' : 'Load more workouts'}
          </Button>
        </div>
      )}
    </>
  )
}
