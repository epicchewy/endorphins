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
  const filtered = Boolean(search.q?.trim() || search.level)
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4 max-[600px]:mb-5">
        <h2 className="font-display text-4xl font-normal leading-[1.12] tracking-[-0.025em] max-[600px]:text-3xl">
          Your saved plans
        </h2>
        <output className="text-xs text-muted" aria-live="polite">
          {summary
            ? `${workouts.length} of ${summary.count} ${filtered ? 'matching ' : ''}plans`
            : 'Loading saved-plan count…'}
        </output>
      </div>
      {!summary && summaryState}
      {(filtered || !summary || summary.count > 0) && (
        <div className="mb-5 grid grid-cols-[minmax(0,1fr)_minmax(140px,180px)_minmax(140px,180px)] gap-3 max-[600px]:grid-cols-2">
          <SearchInput
            wrapperClassName="min-w-0 max-[600px]:col-span-full"
            aria-label="Find an exercise or body area"
            name="q"
            autoComplete="off"
            placeholder="Find an exercise or body area…"
            value={search.q ?? ''}
            maxLength={400}
            onChange={(event) => onSearchChange({ q: event.target.value }, true)}
          />
          <Select
            aria-label="Filter by level"
            name="level"
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
            name="sort"
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
      )}
      {children}
      {workouts.length > 0 && (
        <ul className="m-0 list-none border-t border-line p-0">
          {workouts.map((workout) => (
            <li
              key={workout.id}
              className="[content-visibility:auto] [contain-intrinsic-size:auto_140px]"
            >
              <Link
                to="/app/workouts/$workoutId"
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
