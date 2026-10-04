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
        'flex flex-col gap-1 whitespace-nowrap tabular-nums',
        prominent ? 'mt-6 items-start' : 'items-end',
      )}
    >
      <strong
        className={
          prominent
            ? 'text-4xl font-extrabold tracking-[-1px]'
            : 'text-base font-bold max-[600px]:text-sm'
        }
      >
        {exercise.duration ? (
          `${exercise.rounds} × ${exercise.duration}s`
        ) : (
          <>
            {exercise.reps}{' '}
            <span
              className={
                prominent ? 'ml-1.5 text-sm font-medium tracking-normal' : 'text-xs font-medium'
              }
            >
              reps
            </span>
          </>
        )}
      </strong>
      {exercise.duration && (
        <small className={cn('text-muted', prominent ? 'text-[13px]' : 'text-xs')}>
          {exercise.rest ?? 0}s rest per round
        </small>
      )}
    </span>
  )
}
