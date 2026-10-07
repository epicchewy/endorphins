import { useRef, useState } from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { ArrowRight, Check, House } from 'lucide-react'
import { useAccount, useUpdateAccount } from '~/hooks/use-account'
import { AppHeader } from '~/components/app-header'
import { Button } from '~/components/ui/button'
import { RadioOption } from '~/components/ui/field'
import { Feedback, LoadingState } from '~/components/ui/feedback'
import { SkipLink } from '~/components/ui/skip-link'
import { safeAppPath } from '~/services/app-navigation'
import { workoutLevels } from '~/services/workout-levels'
import homeWorkout from '~/assets/images/home-workout-768.webp'
import homeWorkoutLarge from '~/assets/images/home-workout-1122.webp'

export const Route = createFileRoute('/_authenticated/app_/onboarding')({
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: safeAppPath(search.next),
  }),
  component: Onboarding,
})
function Onboarding() {
  const account = useAccount()
  const update = useUpdateAccount()
  const { next = '/app' } = Route.useSearch()
  const destination = next === '/app' ? '/app/new' : next
  const [step, setStep] = useState(0)
  const [level, setLevel] = useState(1)
  const heading = useRef<HTMLHeadingElement>(null)
  return (
    <>
      <SkipLink href="#onboarding" />
      <AppHeader onboarding />
      <main
        id="onboarding"
        className={`mx-auto px-5 py-12 max-[600px]:py-8 ${step === 0 ? 'max-w-[1080px]' : 'max-w-[620px]'}`}
      >
        {account.isPending ? (
          <LoadingState>Opening your account…</LoadingState>
        ) : account.isError ? (
          <Feedback retry={() => void account.refetch()}>{account.error.message}</Feedback>
        ) : account.data.onboardingCompletedAt ? (
          <Navigate to={destination} replace />
        ) : (
          <>
            <ol
              aria-label="Getting started"
              className="mb-8 flex items-center gap-3 text-xs font-medium text-muted"
            >
              <li
                aria-current={step === 0 ? 'step' : undefined}
                className={step === 0 ? 'text-ink' : undefined}
              >
                Welcome
              </li>
              <li aria-hidden="true">
                <ArrowRight size={14} />
              </li>
              <li
                aria-current={step === 1 ? 'step' : undefined}
                className={step === 1 ? 'text-ink' : undefined}
              >
                Your level
              </li>
            </ol>
            {step === 0 ? (
              <div className="grid grid-cols-[1.2fr_1fr] items-center gap-14 max-[900px]:grid-cols-1">
                <div>
                  <House
                    size={32}
                    strokeWidth={1.5}
                    className="mb-6 text-focus"
                    aria-hidden="true"
                  />
                  <h1
                    ref={heading}
                    tabIndex={-1}
                    className="font-display text-[clamp(40px,7vw,56px)] leading-[1.1] tracking-tight"
                  >
                    Welcome home.
                  </h1>
                  <p className="mt-5 text-lg leading-relaxed">
                    A bit of space is all you need to get moving.
                  </p>
                  <dl className="my-8 grid grid-cols-2 gap-x-7 gap-y-6 text-sm max-[600px]:grid-cols-1 max-[600px]:gap-5">
                    {[
                      [
                        'Work out at home',
                        'Every new plan uses bodyweight exercises. You only need floor space and a wall.',
                      ],
                      [
                        'Choose your time and level',
                        'Work your legs, upper body, and core. Move at your own pace. Times are estimates.',
                      ],
                      [
                        'Keep your plan',
                        'Your plan saves to your account. Follow the exercises, print it, or use it another day.',
                      ],
                      [
                        'See your progress',
                        'After you work out, mark it complete. Your dashboard tracks completed workouts and active days.',
                      ],
                    ].map(([title, body]) => (
                      <div key={title}>
                        <dt className="font-semibold">{title}</dt>
                        <dd className="mt-2 leading-relaxed text-muted">{body}</dd>
                      </div>
                    ))}
                  </dl>
                  <Button
                    variant="primary"
                    className="w-full justify-between"
                    onClick={() => {
                      setLevel(account.data.defaultLevel)
                      setStep(1)
                      requestAnimationFrame(() => heading.current?.focus())
                    }}
                  >
                    Choose my level <ArrowRight size={18} aria-hidden="true" />
                  </Button>
                </div>
                <img
                  src={homeWorkout}
                  srcSet={`${homeWorkout} 768w, ${homeWorkoutLarge} 1122w`}
                  sizes="448px"
                  width="1122"
                  height="1402"
                  alt="A simple stretch at home"
                  className="aspect-[4/5] w-full rounded-panel object-cover max-[900px]:hidden"
                />
              </div>
            ) : (
              <>
                <h1
                  ref={heading}
                  tabIndex={-1}
                  className="font-display text-[clamp(36px,6vw,48px)] leading-tight tracking-tight"
                >
                  Find your starting level.
                </h1>
                <p className="mt-4 mb-7 text-sm leading-relaxed text-muted">
                  Start with Light if you are new to exercise. You can change the level for any
                  workout.
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    update.mutate({ defaultLevel: level, completeOnboarding: true })
                  }}
                >
                  <fieldset className="grid gap-3" disabled={update.isPending}>
                    <legend className="sr-only">Default workout level</legend>
                    {workoutLevels.map((item) => (
                      <RadioOption
                        key={item.number}
                        name="default-level"
                        value={item.number}
                        checked={level === item.number}
                        onChange={() => {
                          setLevel(item.number)
                          update.reset()
                        }}
                        className="justify-start gap-4 px-5 py-4"
                      >
                        <span className="text-lg font-semibold">{item.number}</span>
                        <span>
                          <span className="block text-sm font-semibold">{item.title}</span>
                          <span className="mt-1 block text-xs leading-relaxed opacity-80">
                            {item.detail}
                          </span>
                        </span>
                        {level === item.number && (
                          <Check size={18} className="ml-auto" aria-hidden="true" />
                        )}
                      </RadioOption>
                    ))}
                  </fieldset>
                  {update.isError && <Feedback>{update.error.message}</Feedback>}
                  <Button
                    type="submit"
                    variant="primary"
                    pending={update.isPending}
                    className="mt-7 w-full justify-between"
                  >
                    {update.isPending ? 'Saving your level…' : 'Set up my workout'}{' '}
                    <ArrowRight size={18} aria-hidden="true" />
                  </Button>
                  <Button
                    className="mt-3 w-full"
                    variant="ghost"
                    disabled={update.isPending}
                    onClick={() => {
                      setStep(0)
                      requestAnimationFrame(() => heading.current?.focus())
                    }}
                  >
                    Back
                  </Button>
                </form>
              </>
            )}
          </>
        )}
      </main>
    </>
  )
}
