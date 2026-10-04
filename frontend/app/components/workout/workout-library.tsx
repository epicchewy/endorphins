import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { SearchInput, Select } from '~/components/ui/field'
import type { Workout, WorkoutSummary } from '~/services/workouts'
import type { LibrarySearch } from '~/services/library-search'

export function WorkoutLibrary({
  workouts,
  search,
  onSearchChange,
  summary,
  summaryState,
  children,
}: {
  workouts: Workout[]
  search: LibrarySearch
  onSearchChange: (patch: LibrarySearch, replace?: boolean) => void
  summary?: WorkoutSummary
  summaryState?: ReactNode
  children?: ReactNode
}) {
  const maxCount = Math.max(1, ...(summary?.levels.map((item) => item.count) ?? []))
  const filtered = Boolean(search.q?.trim() || search.level)
  return (
    <>
      {summary ? (
        <section
          className="mb-14 grid min-h-(--library-summary-height) grid-cols-[1.4fr_1fr] overflow-hidden rounded-panel border border-line bg-surface max-[900px]:grid-cols-1 max-[600px]:mb-9"
          aria-label="Saved plan statistics"
        >
          <div className="p-8 max-[1150px]:p-[26px] max-[600px]:px-5 max-[600px]:py-6">
            <h2 className="text-[17px] font-bold">A little perspective.</h2>
            <dl className="mt-[30px] grid grid-cols-3 justify-between gap-6 max-[1150px]:gap-4 max-[600px]:mt-6 max-[600px]:gap-3 [&>div]:flex [&>div]:flex-col-reverse [&_dt]:mt-2 [&_dt]:text-xs [&_dt]:text-muted [&_dd]:font-body [&_dd]:text-[48px] [&_dd]:font-medium [&_dd]:leading-[1.2] [&_dd]:tracking-[-0.05em] [&_dd]:tabular-nums [&_dd]:wrap-anywhere max-[600px]:[&_dd]:text-[clamp(28px,8vw,40px)]">
              <div>
                <dt>Saved plans</dt>
                <dd>{summary.count}</dd>
              </div>
              <div>
                <dt>Planned minutes</dt>
                <dd>{summary.plannedMinutes.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Avg. duration</dt>
                <dd>
                  {summary.averageMinutes.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  <small className="font-body text-sm font-medium max-[600px]:text-xs"> min</small>
                </dd>
              </div>
            </dl>
            <p className="mt-[26px] max-w-[440px] text-xs leading-[1.8] text-muted">
              {filtered
                ? 'Based on every plan matching your filters.'
                : 'Based on all your saved plans.'}{' '}
              These are generated workouts, not completed sessions.
            </p>
          </div>
          <div className="border-l border-line p-8 max-[900px]:border-t max-[900px]:border-l-0 max-[600px]:px-5 max-[600px]:py-6">
            <h3 className="text-sm font-bold">Your mix of levels</h3>
            <div className="mt-5 flex justify-between gap-3.5 max-[900px]:max-w-[480px]">
              {summary.levels.map(({ level, count }) => (
                <div
                  className="flex flex-1 flex-col items-center gap-2 text-xs text-muted"
                  key={level}
                >
                  <span className="text-ink tabular-nums">{count}</span>
                  <div
                    className="flex h-[100px] w-full max-w-11 items-end border-b border-line-strong"
                    aria-hidden="true"
                  >
                    <div
                      className="w-full bg-accent"
                      style={{ height: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span>
                    Level {level}
                    <span className="sr-only">
                      : {count} saved {count === 1 ? 'plan' : 'plans'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        summaryState
      )}
      <div className="mb-6 flex items-center justify-between gap-4 max-[600px]:mb-5">
        <h2 className="font-display text-4xl font-normal leading-[1.12] tracking-[-0.025em] max-[600px]:text-3xl">
          Your workouts.
        </h2>
        <output className="text-xs text-muted" aria-live="polite">
          {summary
            ? `${workouts.length} of ${summary.count} ${filtered ? 'matching ' : ''}plans`
            : 'Your saved plans'}
        </output>
      </div>
      <div className="mb-5 grid grid-cols-[minmax(0,1fr)_minmax(140px,180px)_minmax(140px,180px)] gap-3 max-[600px]:grid-cols-2">
        <SearchInput
          wrapperClassName="min-w-0 max-[600px]:col-span-full"
          aria-label="Find an exercise or body area"
          placeholder="Find an exercise or body area"
          value={search.q ?? ''}
          maxLength={400}
          onChange={(event) => onSearchChange({ q: event.target.value }, true)}
        />
        <Select
          aria-label="Filter by level"
          value={search.level ?? 'all'}
          onChange={(event) =>
            onSearchChange({
              level: event.target.value === 'all' ? undefined : Number(event.target.value),
            })
          }
        >
          <option value="all">All levels</option>
          {[1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={level}>
              Level {level}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Sort workouts"
          value={search.sort ?? 'newest'}
          onChange={(event) =>
            onSearchChange({
              sort: event.target.value === 'shortest' ? 'shortest' : 'newest',
            })
          }
        >
          <option value="newest">Newest first</option>
          <option value="shortest">Shortest first</option>
        </Select>
      </div>
      {children}
      {workouts.length > 0 && (
        <ul className="m-0 list-none border-t border-line p-0">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <Link
                to="/workouts/$workoutId"
                params={{ workoutId: workout.id }}
                search={search}
                className="group flex items-center gap-[30px] border-b border-line px-3 py-6 transition-colors duration-180 hover:bg-surface max-[600px]:gap-[18px] max-[600px]:px-0 max-[360px]:gap-3"
              >
                <div className="flex min-w-[84px] flex-col items-center border-r border-line pr-7 max-[600px]:min-w-[60px] max-[600px]:pr-4">
                  <strong className="font-body text-[44px] font-medium leading-[1.1] tracking-[-0.05em] tabular-nums max-[600px]:text-4xl">
                    {workout.estimatedMinutes}
                  </strong>
                  <span className="mt-1.5 text-xs tracking-[0.05em] text-muted">MIN EST.</span>
                </div>
                <div className="min-w-0">
                  <span className="text-xs text-muted">Full body · Level {workout.level}</span>
                  <h3 className="mt-[5px] text-[21px] font-bold tracking-[-0.5px] max-[600px]:text-[17px]">
                    <span className="capitalize">{workout.focus}</span> focus
                  </h3>
                  <p className="mt-[7px] flex flex-wrap gap-2 text-xs leading-[1.8] text-muted max-[600px]:gap-[5px]">
                    <time dateTime={workout.createdAt}>
                      {new Date(workout.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </time>
                    <span>·</span>
                    {workout.blocks.reduce((sum, block) => sum + block.exercises.length, 0)}{' '}
                    exercises
                  </p>
                </div>
                <span className="ml-auto flex items-center gap-3.5 text-xs font-bold whitespace-nowrap max-[600px]:gap-0">
                  <span className="max-[600px]:sr-only">View plan</span>{' '}
                  <ArrowUpRight
                    className="transition-transform duration-180 group-hover:translate-x-[3px] group-hover:-translate-y-[3px] max-[600px]:w-5"
                    size={23}
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
