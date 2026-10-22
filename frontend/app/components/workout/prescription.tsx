import type { Exercise } from '~/services/workouts'
import { cn } from '~/components/ui/cn'

export function Prescription({
  exercise,
  size = 'default',
}: {
  exercise: Exercise
  size?: 'default' | 'focus'
}) {
  const prominent = size === 'focus'
  return (
    <span
      className={cn(
        'flex flex-col whitespace-nowrap tabular-nums',
        prominent ? 'mt-6 items-start gap-1' : 'items-end',
      )}
    >
      <strong
        className={
          prominent
            ? 'text-4xl font-extrabold tracking-[-1px]'
            : 'text-lg leading-snug font-bold print:text-sm'
        }
      >
        {exercise.duration ? (
          `${exercise.rounds} × ${exercise.duration}s`
        ) : (
          <>
            {exercise.reps}{' '}
            <span
              className={
                prominent
                  ? 'ml-1.5 text-sm font-medium tracking-normal'
                  : 'text-[13px] font-medium text-muted'
              }
            >
              reps
            </span>
          </>
        )}
      </strong>
      {exercise.duration && (
        <small className="text-[13px] text-muted">
          {exercise.rest ?? 0}s rest{prominent && ' per round'}
        </small>
      )}
    </span>
  )
}
