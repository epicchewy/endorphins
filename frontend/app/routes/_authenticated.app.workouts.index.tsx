import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router'
import { ArrowUpRight, Plus } from 'lucide-react'
import { useWorkouts, useWorkoutSummary } from '~/hooks/use-workouts'
import { WorkoutLibrary } from '~/components/workout/workout-library'
import { PageHeading } from '~/components/ui/page-heading'
import { Button, buttonClassName } from '~/components/ui/button'
import { EmptyState, Feedback, LoadingState } from '~/components/ui/feedback'
import { librarySearch, librarySearchDefaults } from '~/services/library-search'

export const Route = createFileRoute('/_authenticated/app/workouts/')({
  validateSearch: librarySearch,
  search: { middlewares: [stripSearchParams(librarySearchDefaults)] },
  component: History,
})

function History() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const history = useWorkouts(search)
  const summary = useWorkoutSummary(search)
  const workouts = history.data?.pages.flatMap((page) => page.items) ?? []
  const filtered = Boolean(search.q?.trim() || search.level)
  return (
    <>
      <PageHeading
        title="Saved workouts"
        description="Keep a plan for another day, or create a new one."
        actions={
          <Link to="/app/new" className={buttonClassName({ variant: 'primary' })}>
            <Plus size={18} aria-hidden="true" /> New workout
          </Link>
        }
      />
      <WorkoutLibrary
        workouts={workouts}
        search={search}
        onSearchChange={(patch, replace = false) => {
          void navigate({
            search: (current) => ({ ...current, ...patch }),
            replace,
            resetScroll: false,
          })
        }}
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
        {history.isSuccess &&
          workouts.length === 0 &&
          (filtered ? (
            <EmptyState
              title="No matching plans."
              action={
                <Button onClick={() => void navigate({ search: {}, resetScroll: false })}>
                  Clear filters
                </Button>
              }
            >
              Try another exercise or level. Search includes every workout in your library.
            </EmptyState>
          ) : (
            <EmptyState
              title="No saved workouts yet."
              action={
                <Link to="/app/new" className={buttonClassName({ variant: 'primary' })}>
                  Create my first workout <ArrowUpRight size={18} aria-hidden="true" />
                </Link>
              }
            >
              Choose your time and level. We’ll save your plan here.
            </EmptyState>
          ))}
      </WorkoutLibrary>
      {history.hasNextPage && (
        <div className="flex justify-center pt-7">
          <Button pending={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>
            {history.isFetchingNextPage ? 'Loading more…' : 'Load more workouts'}
          </Button>
        </div>
      )}
    </>
  )
}
