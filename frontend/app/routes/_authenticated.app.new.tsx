import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { WorkoutBuilder } from '~/components/workout/workout-builder'
import { useAccount, useAccountSession } from '~/hooks/use-account'
import { useGenerateWorkout } from '~/hooks/use-generate-workout'
import { workoutSearch, preferencesFromSearch } from '~/services/workout-preferences'

export const Route = createFileRoute('/_authenticated/app/new')({
  validateSearch: workoutSearch,
  search: { middlewares: [stripSearchParams({ minutes: 45 })] },
  component: NewWorkout,
})
function NewWorkout() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const account = useAccount()
  const { isCurrentSession } = useAccountSession()
  const generator = useGenerateWorkout()
  const preferences = preferencesFromSearch(search, account.data?.defaultLevel ?? 1)
  return (
    <div className="mx-auto grid max-w-[940px] grid-cols-[1fr_380px] items-start gap-16 max-[800px]:max-w-[480px] max-[800px]:grid-cols-1 max-[800px]:gap-8">
      <div className="pt-5 max-[800px]:pt-0">
        <p className="mb-5 text-xs font-medium text-muted">At home · No equipment</p>
        <h1 className="font-display text-[clamp(40px,5vw,56px)] leading-[1.1] tracking-tight">
          Make time
          <br className="max-[800px]:hidden" /> to move.
        </h1>
        <p className="mt-5 max-w-[38ch] text-sm leading-relaxed text-muted">
          Choose a time and level. Your full-body plan will save to your account, ready when you
          are.
        </p>
        <dl className="mt-8 space-y-5 text-sm">
          <div>
            <dt className="font-semibold">Floor space and a wall</dt>
            <dd className="mt-1 text-muted">Bodyweight exercises for your home.</dd>
          </div>
          <div>
            <dt className="font-semibold">Legs, upper body, and core</dt>
            <dd className="mt-1 text-muted">Clear sets, reps, and exercise notes.</dd>
          </div>
          <div>
            <dt className="font-semibold">Go at your own pace</dt>
            <dd className="mt-1 text-muted">Time estimates help you plan your day.</dd>
          </div>
        </dl>
      </div>
      <WorkoutBuilder
        value={preferences}
        onChange={(patch) => {
          generator.reset()
          void navigate({
            search: (previous) => ({
              ...previous,
              ...(patch.durationMinutes !== undefined ? { minutes: patch.durationMinutes } : {}),
              ...(patch.level !== undefined ? { level: patch.level } : {}),
            }),
            replace: true,
            resetScroll: false,
          })
        }}
        onGenerate={() =>
          generator.mutate(preferences, {
            onSuccess: (workout) => {
              if (isCurrentSession())
                void navigate({ to: '/app/workouts/$workoutId', params: { workoutId: workout.id } })
            },
          })
        }
        pending={generator.isPending}
        error={generator.error?.message}
      />
    </div>
  )
}
