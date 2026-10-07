import { lazy, Suspense, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Clock3, Printer, RefreshCw, Sunrise, List, Play } from 'lucide-react'
import { usePrintDetails } from '~/hooks/use-print-details'
import type { Workout } from '~/services/workouts'
import { Button } from '~/components/ui/button'
import { Feedback, LoadingState } from '~/components/ui/feedback'
import { cn } from '~/components/ui/cn'
import { Prescription } from './prescription'

const WorkoutFocus = lazy(() =>
  import('./workout-focus').then((module) => ({ default: module.WorkoutFocus })),
)
const blockColors = ['bg-accent', 'bg-chart-upper', 'bg-chart-core']
const viewButton =
  'min-h-11 min-w-0 border-0 bg-transparent px-3 py-2.5 text-sm font-semibold aria-pressed:bg-surface aria-pressed:text-ink max-[600px]:flex-1'
const actionButton = 'min-h-11 px-3 py-2.5 text-xs max-[600px]:flex-1'

export function WorkoutSheet({
  workout,
  pending,
  error,
  onShuffle,
  children,
}: {
  workout: Workout
  pending: boolean
  error?: string
  onShuffle: () => void
  children: ReactNode
}) {
  const printRef = usePrintDetails()
  const [view, setView] = useState<'plan' | 'focus'>('plan')
  const overviewButton = useRef<HTMLButtonElement>(null)
  const count = workout.blocks.reduce((sum, block) => sum + block.exercises.length, 0)
  const stats = [
    { label: 'Estimated time', value: workout.estimatedMinutes, unit: ' min' },
    { label: 'Exercises', value: count },
    { label: 'Body areas', value: workout.blocks.length },
  ]
  const allocation = [
    ...(workout.warmupMinutes > 0
      ? [{ name: 'Warm-up', minutes: workout.warmupMinutes, color: 'bg-inverse-muted' }]
      : []),
    ...workout.blocks.map((block, index) => ({
      name: block.name,
      minutes: block.estimatedMinutes,
      color: blockColors[index] ?? 'bg-chart-core',
    })),
  ]
  return (
    <article ref={printRef} className="print:block print:w-full" aria-labelledby="workout-title">
      <div className="rounded-panel bg-inverse p-8 text-inverse-ink max-[600px]:p-6 max-[360px]:p-5 print:border print:border-[#919a9e] print:bg-white print:p-5 print:text-ink">
        <div className="flex justify-between gap-4 text-xs text-inverse-muted max-[600px]:gap-2 print:text-muted">
          <span>Saved workout plan</span>
          <span>Level {workout.level} · Full body</span>
        </div>
        <h1
          id="workout-title"
          tabIndex={-1}
          className="mt-6 font-display text-[clamp(34px,3.2vw,46px)] leading-[1.16] font-normal tracking-tight focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-accent max-[600px]:text-[38px] print:text-[34px]"
        >
          Full-body workout
        </h1>
        <dl
          aria-label="Workout statistics"
          className="mt-6.5 flex gap-[clamp(24px,4vw,64px)] max-[1150px]:gap-7.5 max-[600px]:justify-between max-[600px]:gap-0 print:mt-3 print:gap-12"
        >
          {stats.map(({ label, value, unit }) => (
            <div className="flex flex-col-reverse" key={label}>
              <dt className="mt-1 text-xs text-inverse-muted print:text-muted">{label}</dt>
              <dd className="font-body text-[44px] leading-[1.2] font-medium tracking-[-0.05em] tabular-nums max-[600px]:text-4xl print:text-[34px]">
                {value}
                {unit && (
                  <small className="text-base font-medium max-[600px]:text-xs">{unit}</small>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-6.5 flex h-2 gap-[3px] overflow-hidden print:hidden" aria-hidden="true">
          {allocation.map((part) => (
            <span
              key={part.name}
              className={cn('min-w-px', part.color)}
              style={{ flex: part.minutes }}
            />
          ))}
        </div>
        <dl
          className="mt-3.5 flex justify-between gap-3 max-[600px]:grid max-[600px]:grid-cols-2 max-[600px]:gap-3.5 print:mt-4.5"
          aria-label="Estimated time by block"
        >
          {allocation.map((part) => (
            <div
              key={part.name}
              className="flex flex-col gap-[5px] max-[600px]:flex-row max-[600px]:items-center max-[600px]:justify-between max-[600px]:gap-1"
            >
              <dt className="flex items-center gap-[5px] text-xs capitalize">
                <span
                  className={cn('inline-block size-[7px] print:hidden', part.color)}
                  aria-hidden="true"
                />
                {part.name}
              </dt>
              <dd className="pl-3 text-xs text-inverse-muted max-[600px]:pl-0 print:pl-0 print:text-muted">
                {part.minutes} min
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div
        data-testid="workout-toolbar"
        className="my-6 flex flex-wrap items-center justify-between gap-3 max-[600px]:flex-col max-[600px]:items-stretch print:hidden"
      >
        <fieldset className="m-0 inline-flex min-w-0 gap-1 rounded-control border-0 bg-line p-1 max-[600px]:flex">
          <legend className="sr-only">Workout view</legend>
          <Button
            variant="ghost"
            className={viewButton}
            ref={overviewButton}
            aria-pressed={view === 'plan'}
            onClick={() => setView('plan')}
          >
            <List size={16} aria-hidden="true" /> Plan overview
          </Button>
          <Button
            variant="ghost"
            className={viewButton}
            aria-pressed={view === 'focus'}
            onClick={() => setView('focus')}
          >
            <Play size={15} aria-hidden="true" /> Exercise view
          </Button>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
          {children}
          <Button variant="secondary" className={actionButton} onClick={() => window.print()}>
            <Printer size={17} aria-hidden="true" />
            <span>Print / save PDF</span>
          </Button>
          <Button
            variant="secondary"
            className={actionButton}
            pending={pending}
            onClick={onShuffle}
            aria-describedby={error ? 'workout-result-error' : undefined}
          >
            {!pending && <RefreshCw size={17} aria-hidden="true" />} Shuffle
          </Button>
        </div>
      </div>
      {error && <Feedback id="workout-result-error">{error}</Feedback>}
      {view === 'focus' && (
        <Suspense fallback={<LoadingState>Opening exercise view…</LoadingState>}>
          <WorkoutFocus
            workout={workout}
            onExit={() => {
              setView('plan')
              overviewButton.current?.focus()
            }}
          >
            {children}
          </WorkoutFocus>
        </Suspense>
      )}
      <div
        data-testid="workout-overview"
        className={cn(view === 'focus' && 'hidden', 'print:block')}
      >
        {workout.warmupMinutes > 0 && (
          <div className="flex items-center gap-3.5 rounded-control bg-accent-soft p-5 max-[600px]:gap-2.5 max-[600px]:p-4 print:mt-5">
            <Sunrise size={24} strokeWidth={1.6} className="max-[600px]:w-5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold max-[600px]:text-xs">A little warm-up first</h2>
              <p className="mt-1 text-xs leading-[1.6] text-muted">
                Ease into movement before your first block.
              </p>
            </div>
            <strong className="ml-auto text-[13px] whitespace-nowrap max-[600px]:text-xs">
              {workout.warmupMinutes} min
            </strong>
          </div>
        )}
        <p className="mt-5 text-xs leading-[1.8] text-muted">
          Work through each block in order. Repeat all exercises for the number of sets shown.
        </p>
        {workout.blocks.map((block, index) => (
          <section className="mt-7 print:mt-5" key={block.name} aria-labelledby={`block-${index}`}>
            <div className="flex items-center justify-between gap-5 border-b border-line-strong pb-3.5 print:break-after-avoid">
              <h2
                id={`block-${index}`}
                className="font-body text-[26px] leading-[1.1] font-semibold tracking-tight capitalize max-[600px]:text-2xl print:text-[26px]"
              >
                {block.name}
              </h2>
              <div className="flex items-center gap-3.5 text-xs max-[600px]:gap-2.5">
                <strong>
                  {block.sets} {block.sets === 1 ? 'set' : 'sets'}
                </strong>
                <span className="flex items-center gap-1 text-muted">
                  <Clock3 size={13} aria-hidden="true" /> ~{block.estimatedMinutes} min
                </span>
              </div>
            </div>
            <ol className="m-0 list-none p-0">
              {block.exercises.map((exercise, exerciseIndex) => (
                <li key={exercise.name}>
                  <details className="group border-b border-line print:break-inside-avoid">
                    <summary className="flex cursor-pointer list-none items-center gap-4 rounded-sm px-1 py-5 hover:bg-surface max-[600px]:gap-2.5 print:py-2.5 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-4.5 text-xs text-muted tabular-nums max-[600px]:hidden">
                        {String(exerciseIndex + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1 text-[15px] leading-normal font-bold max-[600px]:text-[13px] print:text-xs">
                        {exercise.name}
                        <small className="mt-[5px] block text-xs font-normal text-muted capitalize">
                          {exercise.duration ? 'Timed rounds' : 'Repetitions'} ·{' '}
                          {exercise.difficulty}
                        </small>
                      </span>
                      <Prescription exercise={exercise} />
                      <ChevronDown
                        aria-hidden="true"
                        className="text-muted transition-transform duration-180 group-open:rotate-180 print:hidden"
                        size={16}
                      />
                    </summary>
                    <div className="max-w-[660px] px-[38px] pb-5.5 text-[13px] leading-[1.8] text-muted max-[600px]:px-1.5 max-[600px]:pb-5 max-[600px]:text-xs print:pb-3 print:text-[10px]">
                      <p>{exercise.description || 'No additional notes for this exercise.'}</p>
                      <p className="mt-2">
                        Complete this exercise once in each of the {block.sets}{' '}
                        {block.sets === 1 ? 'set' : 'sets'} in this block.
                      </p>
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <p className="mt-6 text-xs leading-[1.8] text-muted print:text-[10px]">
        Built for {workout.requestedMinutes} minutes, with a {workout.estimatedMinutes}-minute
        estimate{workout.warmupMinutes ? ' including warm-up' : ''}. Actual time depends on your
        pace and rest. Review the exercise notes before you begin.
      </p>
    </article>
  )
}
