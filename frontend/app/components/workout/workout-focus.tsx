import { useRef, useState, type ReactNode } from 'react'
import { Presence } from '~/components/ui/presence'
import { Button } from '~/components/ui/button'
import { EmptyState } from '~/components/ui/feedback'
import { ArrowLeft, ArrowRight, Sunrise } from 'lucide-react'
import type { Workout } from '~/services/workouts'
import { workoutSteps } from '~/services/workout-insights'
import { Prescription } from './prescription'

export function WorkoutFocus({
  workout,
  onExit,
  children,
}: {
  workout: Workout
  onExit: () => void
  children: ReactNode
}) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<-1 | 1>(1)
  const focusRef = useRef<HTMLDivElement>(null)
  const steps = workoutSteps(workout)
  const step = steps[index]
  const go = (next: number) => {
    setDirection(next > index ? 1 : -1)
    setIndex(Math.max(0, Math.min(steps.length - 1, next)))
    focusRef.current?.focus({ preventScroll: true })
  }
  if (!step) return <EmptyState title="No exercises in this plan." />
  return (
    <div
      data-testid="exercise-view"
      className="rounded-panel border border-line bg-surface p-7 max-[600px]:p-5 print:hidden"
    >
      <div className="flex items-center justify-between gap-4 text-xs text-muted">
        <span>Move at your own pace.</span>
        <span>
          Step {index + 1} of {steps.length}
        </span>
      </div>
      <progress
        className="mt-4 block h-1 w-full appearance-none border-0 bg-line text-accent [&::-webkit-progress-bar]:bg-line [&::-webkit-progress-value]:bg-accent [&::-moz-progress-bar]:bg-accent"
        value={index + 1}
        max={steps.length}
        aria-label="Position in your workout plan"
      />
      <div
        className="min-h-[340px] pt-9 pb-6 max-[600px]:min-h-[360px]"
        ref={focusRef}
        tabIndex={-1}
        aria-label="Exercise instructions"
      >
        <Presence identity={index} className="flex flex-col items-start" direction={direction}>
          {step.kind === 'warmup' ? (
            <>
              <span className="flex items-center gap-2.5 text-xs font-bold text-muted capitalize">
                <Sunrise size={19} aria-hidden="true" /> Before you begin
              </span>
              <h2 className="mt-5 font-display text-[clamp(34px,3.4vw,50px)] leading-[1.16] font-normal tracking-tight [overflow-wrap:anywhere] max-[600px]:text-[clamp(30px,8.7vw,42px)]">
                Warm up
              </h2>
              <div className="mt-6 text-4xl font-extrabold tracking-[-1px]">
                {step.minutes}
                <span className="ml-1.5 text-sm font-medium tracking-normal">minutes</span>
              </div>
              <p className="mt-5 max-w-[540px] text-sm leading-[1.85] text-muted max-[600px]:text-[13px]">
                Ease into movement before your first block. Review the exercise notes before you
                begin.
              </p>
            </>
          ) : (
            <>
              <span className="flex items-center gap-2.5 text-xs font-bold text-muted capitalize">
                {step.blockName} <span>·</span> Set {step.set} of {step.sets}
              </span>
              <h2 className="mt-5 font-display text-[clamp(34px,3.4vw,50px)] leading-[1.16] font-normal tracking-tight [overflow-wrap:anywhere] max-[600px]:text-[clamp(30px,8.7vw,42px)]">
                {step.exercise.name}
              </h2>
              <Prescription exercise={step.exercise} size="focus" />
              <p className="mt-5 max-w-[540px] text-sm leading-[1.85] text-muted max-[600px]:text-[13px]">
                {step.exercise.description ||
                  'No additional notes for this exercise. Move at a comfortable, controlled pace.'}
              </p>
              <span className="mt-4 text-xs text-muted capitalize">
                {step.exercise.difficulty} variation
              </span>
            </>
          )}
        </Presence>
      </div>
      <div className="flex justify-between gap-4 max-[600px]:gap-2.5">
        <Button
          className="min-w-[130px] max-[600px]:min-w-0 max-[600px]:flex-1 max-[600px]:p-3 max-[600px]:text-xs"
          variant="secondary"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          <ArrowLeft size={18} aria-hidden="true" /> Previous
        </Button>
        {index < steps.length - 1 ? (
          <Button
            className="min-w-[130px] max-[600px]:min-w-0 max-[600px]:flex-1 max-[600px]:p-3 max-[600px]:text-xs"
            variant="primary"
            onClick={() => go(index + 1)}
          >
            Next <ArrowRight size={18} aria-hidden="true" />
          </Button>
        ) : (
          <div className="min-w-[130px] max-[600px]:min-w-0 max-[600px]:flex-1 [&>a]:w-full">
            {children}
          </div>
        )}
      </div>
      <Button variant="ghost" className="mt-4" onClick={onExit}>
        Back to plan
      </Button>
      <p className="mt-6 text-xs leading-[1.8] text-muted">
        Follow each set in order. Use Previous and Next at your pace. Mark your workout complete
        after you finish.
      </p>
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        Step {index + 1} of {steps.length}:{' '}
        {step.kind === 'warmup'
          ? `${step.minutes}-minute warm-up`
          : `${step.exercise.name}, set ${step.set} of ${step.sets}`}
      </output>
    </div>
  )
}
