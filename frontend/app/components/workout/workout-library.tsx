import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { LocalDate } from '~/components/ui/local-date'
import type { Workout, WorkoutSummary } from '~/services/workouts'

export function WorkoutLibrary({
  workouts,
  summary,
  summaryState,
  children,
}: {
  workouts: Workout[]
  summary?: WorkoutSummary
  summaryState?: ReactNode
  children?: ReactNode
}) {
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4 max-[600px]:mb-5">
        <h2 className="font-display text-4xl font-normal leading-[1.12] tracking-[-0.025em] max-[600px]:text-3xl">
          Your saved plans
        </h2>
        <output className="text-xs text-muted-foreground" aria-live="polite">
          {summary
            ? `${workouts.length < summary.count ? `${workouts.length} of ` : ''}${summary.count} ${summary.count === 1 ? 'plan' : 'plans'}`
            : 'Loading saved-plan count…'}
        </output>
      </div>
      {!summary && summaryState}
      {children}
      {workouts.length > 0 && (
        <ul className="m-0 list-none border-t border-border p-0">
          {workouts.map((workout) => (
            <li
              key={workout.id}
              className="[content-visibility:auto] [contain-intrinsic-size:auto_140px]"
            >
              <Link
                to="/app/workouts/$workoutId"
                params={{ workoutId: workout.id }}
                className="flex items-center gap-[30px] border-b border-border px-3 py-6 transition-colors hover:bg-card max-[600px]:gap-[18px] max-[600px]:px-0 max-[360px]:gap-3"
              >
                <div className="flex min-w-[84px] flex-col items-center border-r border-border pr-7 max-[600px]:min-w-[60px] max-[600px]:pr-4">
                  <strong className="font-body text-[44px] font-medium leading-[1.1] tracking-[-0.05em] tabular-nums max-[600px]:text-4xl">
                    {workout.estimatedMinutes}
                  </strong>
                  <span className="mt-1.5 text-xs tracking-[0.05em] text-muted-foreground">
                    MIN EST.
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-xs text-muted-foreground">
                    Full body · Level {workout.level}
                  </span>
                  <h3 className="mt-[5px] text-[21px] font-bold tracking-[-0.5px] max-[600px]:text-[17px]">
                    <span className="capitalize">{workout.focus}</span> focus
                  </h3>
                  <p className="mt-[7px] flex flex-wrap gap-2 text-xs leading-[1.8] text-muted-foreground max-[600px]:gap-[5px]">
                    <LocalDate value={workout.createdAt} year="numeric" />
                    <span>·</span>
                    {workout.blocks.reduce((sum, block) => sum + block.exercises.length, 0)}{' '}
                    exercises
                  </p>
                </div>
                <span className="ml-auto flex items-center gap-3.5 text-xs font-bold whitespace-nowrap max-[600px]:gap-0">
                  <span className="max-[600px]:sr-only">View plan</span>{' '}
                  <ArrowUpRight className="max-[600px]:w-5" size={23} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
