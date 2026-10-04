import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router'
import { ArrowUpRight, Plus, UserRound } from 'lucide-react'
import { useAccount } from '~/hooks/use-account'
import { useWorkouts, useWorkoutSummary } from '~/hooks/use-workouts'
import { WorkoutLibrary } from '~/components/workout/workout-library'
import { PageHeading } from '~/components/ui/page-heading'
import { Button, buttonClassName } from '~/components/ui/button'
import { EmptyState, Feedback, LoadingState } from '~/components/ui/feedback'
import { librarySearch, librarySearchDefaults } from '~/services/library-search'

export const Route = createFileRoute('/_authenticated/workouts/')({
  validateSearch: librarySearch,
  search: { middlewares: [stripSearchParams(librarySearchDefaults)] },
  component: History,
})

function History() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const account = useAccount()
  const history = useWorkouts(search)
  const summary = useWorkoutSummary(search)
  const workouts = history.data?.pages.flatMap((page) => page.items) ?? []
  const filtered = Boolean(search.q?.trim() || search.level)
  return (
    <>
      <PageHeading
        title="Ready when you are."
        description="Your workouts. Your starting points. All in one place."
        actions={
          <>
            <Link to="/account" className={buttonClassName({ variant: 'ghost' })}>
              <UserRound size={18} aria-hidden="true" /> Account
            </Link>
            <Link to="/" hash="builder" className={buttonClassName({ variant: 'primary' })}>
              <Plus size={18} aria-hidden="true" /> Build a workout
            </Link>
          </>
        }
      />
      {account.isError && (
        <Feedback retry={() => void account.refetch()} retryLabel="Retry account">
          {account.error.message}
        </Feedback>
      )}
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
              className="mt-0 mb-14 min-h-(--library-summary-height) items-center justify-center max-[600px]:mb-9"
              retry={() => void summary.refetch()}
              retryLabel="Retry statistics"
            >
              {summary.error.message}
            </Feedback>
          ) : (
            <LoadingState className="mt-0 mb-14 min-h-(--library-summary-height) items-center justify-center max-[600px]:mb-9">
              Loading your library statistics…
            </LoadingState>
          )
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
              title="Your next move starts here."
              action={
                <Link to="/" hash="builder" className={buttonClassName({ variant: 'primary' })}>
                  Create my first workout <ArrowUpRight size={18} />
                </Link>
              }
            >
              Build a workout around your time and level. We’ll save it here for you.
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
