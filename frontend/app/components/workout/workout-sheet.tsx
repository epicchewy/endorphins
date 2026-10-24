import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Check, List, Play, Printer, Repeat } from 'lucide-react'
import type { Workout } from '~/services/workouts'
import type { WorkoutCompletion } from '~/hooks/use-activity'
import { Button } from '~/components/ui/button'
import { Feedback, LoadingState } from '~/components/ui/feedback'
import { LocalDate } from '~/components/ui/local-date'
import { cn } from '~/lib/utils'
import { Prescription } from './prescription'

const WorkoutFocus = lazy(() =>
  import('./workout-focus').then((module) => ({ default: module.WorkoutFocus })),
)
const actionButton = 'px-4 max-[600px]:px-3'

// The plan's completion history sets its actions. A plan to do ends with Mark complete.
// A completed plan shows when it was done; the exercise view can record it again.
// `result` is the outcome of a completion on this page, shown above the plan.
export function WorkoutSheet({
  workout,
  finish,
  result,
}: {
  workout: Workout
  finish: WorkoutCompletion
  result?: ReactNode
}) {
  const [steps, setSteps] = useState(false)
  const count = workout.blocks.reduce((sum, block) => sum + block.exercises.length, 0)
  const done = workout.completedCount > 0
  const complete = (className: string, onSuccess?: () => void) => (
    <Button
      className={className}
      pending={finish.pending}
      onClick={() => finish.confirm({ onSuccess })}
    >
      {!finish.pending && <Check size={18} aria-hidden="true" />}
      {finish.pending ? 'Saving…' : 'Mark complete'}
    </Button>
  )
  // Before a completion exists, any error belongs to the Mark complete action.
  const error = !finish.completion && finish.error && (
    <Feedback retry={finish.restart} retryLabel="Start a new confirmation">
      {finish.error.message}
    </Feedback>
  )
  return (
    <article className="print:block print:w-full" aria-labelledby="workout-title">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pb-8 max-[600px]:pb-6 print:pb-4">
        <div className="min-w-0">
          <h1
            id="workout-title"
            tabIndex={-1}
            className="font-display text-[32px] leading-[1.15] font-normal tracking-tight focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-primary max-[600px]:text-[28px] print:text-2xl"
          >
            Full-body workout
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground print:text-xs">
            Level {workout.level} · About {workout.estimatedMinutes} min · {count} exercises ·{' '}
            <span className="whitespace-nowrap">
              Saved <LocalDate value={workout.createdAt} month="long" year="numeric" />
            </span>
          </p>
          {workout.lastCompletedAt && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold print:hidden">
              <Check size={16} className="shrink-0 text-emphasis" aria-hidden="true" />
              <span>
                {workout.completedCount === 1
                  ? 'Completed'
                  : `Completed ${workout.completedCount} times · Last`}{' '}
                <LocalDate value={workout.lastCompletedAt} month="long" year="numeric" />
              </span>
            </p>
          )}
        </div>
        <div
          data-testid="workout-toolbar"
          className="flex gap-2 max-[600px]:grid max-[600px]:w-full max-[600px]:grid-cols-2 print:hidden"
        >
          <Button
            variant="outline"
            size="sm"
            className={actionButton}
            onClick={() => setSteps(!steps)}
          >
            {steps ? (
              <>
                <List size={17} aria-hidden="true" /> Back to plan
              </>
            ) : (
              <>
                <Play size={17} aria-hidden="true" /> {done ? 'Start again' : 'Start workout'}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={actionButton}
            onClick={() => window.print()}
          >
            <Printer size={17} aria-hidden="true" /> Print
          </Button>
        </div>
      </header>
      {result}
      {steps && (
        <Suspense fallback={<LoadingState>Opening exercise view…</LoadingState>}>
          <WorkoutFocus workout={workout}>{complete('w-full', () => setSteps(false))}</WorkoutFocus>
          {error}
        </Suspense>
      )}
      <div data-testid="workout-overview" className={cn(steps && 'hidden', 'print:block')}>
        {workout.warmupMinutes > 0 && (
          <section
            aria-labelledby="warmup-title"
            className="mb-8 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-input pb-3 print:mb-4"
          >
            <h2 id="warmup-title" className="text-xl font-semibold print:text-base">
              Warm-up
            </h2>
            <span className="text-sm text-muted-foreground">~{workout.warmupMinutes} min</span>
            <p className="text-sm text-muted-foreground">
              Stretch and get your blood flowing before the first block.
            </p>
          </section>
        )}
        <div className="grid gap-10 min-[900px]:grid-cols-3 min-[900px]:gap-8 min-[1150px]:gap-10 max-[899px]:max-w-[720px] print:block">
          {workout.blocks.map((block, index) => (
            <section
              key={block.name}
              className="min-w-0 print:mt-5"
              aria-labelledby={`block-${index}`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2
                  id={`block-${index}`}
                  className="text-xl font-semibold first-letter:uppercase print:text-base"
                >
                  {block.name}
                </h2>
                <span className="text-sm whitespace-nowrap text-muted-foreground">
                  ~{block.estimatedMinutes} min
                </span>
              </div>
              <p className="mt-1 border-b border-input pb-3 text-sm print:pb-1.5">
                {block.sets > 1 ? (
                  <strong className="inline-flex items-center gap-1 font-semibold text-emphasis print:text-foreground">
                    <Repeat size={14} aria-hidden="true" /> {block.sets} sets
                  </strong>
                ) : (
                  <strong className="font-semibold">1 set</strong>
                )}{' '}
                <span className="text-muted-foreground">of the following</span>
              </p>
              <ol className="m-0 list-none p-0">
                {block.exercises.map((exercise) => (
                  <li
                    key={exercise.name}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border py-3 print:break-inside-avoid print:py-1.5"
                  >
                    <div>
                      <p className="text-base leading-snug font-semibold print:text-sm">
                        {exercise.name}
                      </p>
                      {exercise.description && (
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground print:mt-0 print:text-xs">
                          {exercise.description}
                        </p>
                      )}
                    </div>
                    <Prescription exercise={exercise} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
        {!done && (
          <div className="mt-8 print:hidden">
            {!steps && error}
            <div className="flex justify-end">{complete('max-[600px]:w-full')}</div>
          </div>
        )}
      </div>
    </article>
  )
}
