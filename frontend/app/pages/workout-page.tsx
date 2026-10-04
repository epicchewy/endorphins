import { useRef, useState } from 'react'
import { useAuth, useClerk } from '~/auth/client'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowUpRight, Check, MoveUpRight } from 'lucide-react'
import { SkipLink } from '~/components/ui/skip-link'
import { buttonClassName } from '~/components/ui/button'
import { SiteHeader } from '~/components/site-header'
import { SiteFooter } from '~/components/site-footer'
import { WorkoutBuilder } from '~/components/workout/workout-builder'
import { WorkoutPreview } from '~/components/workout/workout-preview'
import { WorkoutSheet } from '~/components/workout/workout-sheet'
import { WorkoutStatus } from '~/components/workout/workout-status'
import { useGenerateWorkout } from '~/hooks/use-generate-workout'
import { preferencesFromSearch, workoutReturnPath } from '~/services/workout-preferences'
import type { GenerateInput, Workout } from '~/services/workouts'

const route = getRouteApi('/')

export function WorkoutPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const clerk = useClerk()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const preferences = preferencesFromSearch(search)
  const [workout, setWorkout] = useState<Workout | null>(null)
  const generator = useGenerateWorkout()
  const generationError = generator.error
    ? `${generator.error.message}${workout ? ' Your previous workout is unchanged.' : ''}`
    : undefined
  const resultRef = useRef<HTMLDivElement>(null)
  const generate = (input: GenerateInput) => {
    if (!isSignedIn) {
      void clerk.redirectToSignIn({ redirectUrl: workoutReturnPath(input) })
      return
    }
    generator.mutate(input, {
      onSuccess: (result) => {
        setWorkout(result)
        requestAnimationFrame(() => {
          resultRef.current
            ?.querySelector<HTMLElement>('#workout-title')
            ?.focus({ preventScroll: true })
          if (window.matchMedia('(max-width: 900px)').matches)
            resultRef.current?.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
              block: 'start',
            })
        })
      },
    })
  }
  return (
    <div className="w-full" id="top">
      <SkipLink href="#builder">Skip to workout builder</SkipLink>
      <SiteHeader landing />
      <main>
        <section
          className="mx-auto grid w-[min(calc(100%-var(--page-gutter)*2),var(--page-width))] grid-cols-[0.83fr_1.17fr] items-stretch gap-[clamp(24px,3vw,48px)] pt-12 pb-16 max-[900px]:grid-cols-2 max-[900px]:gap-7 max-[600px]:grid-cols-1 max-[600px]:gap-6 max-[600px]:pt-8 max-[600px]:pb-[42px] print:hidden"
          aria-labelledby="page-title"
        >
          <div className="flex flex-col items-start justify-center pb-[30px] max-[600px]:pb-0 motion-safe:[&>*]:animate-arrive motion-safe:[&>:nth-child(2)]:[animation-delay:60ms] motion-safe:[&>:nth-child(3)]:[animation-delay:120ms] motion-safe:[&>:nth-child(4)]:[animation-delay:180ms]">
            <p className="mb-[30px] text-[13px] font-medium max-[900px]:mb-[22px] max-[900px]:max-w-[230px] max-[900px]:leading-[1.7] max-[600px]:mb-6 max-[600px]:max-w-none max-[600px]:text-xs">
              A little movement. A lot to feel good about.
            </p>
            <h1
              id="page-title"
              className="font-display text-[clamp(56px,6.25vw,90px)] font-normal leading-[1.06] tracking-[-0.035em] max-[900px]:text-[clamp(42px,6.2vw,56px)] max-[600px]:text-[clamp(48px,15.4vw,82px)] max-[360px]:text-[48px]"
            >
              Make your
              <br />
              next move.
            </h1>
            <p className="mt-7 max-w-[405px] text-[clamp(16px,1.3vw,18px)] leading-[1.7] text-pretty max-[900px]:text-[15px] max-[600px]:mt-6 max-[600px]:max-w-[380px] max-[600px]:leading-[1.75]">
              Full-body workouts that fit your time. Built in seconds. Saved for whenever you’re
              ready.
            </p>
            <a
              className={buttonClassName({
                variant: 'primary',
                className:
                  'mt-7 min-h-[58px] gap-9 max-[600px]:mt-6 max-[600px]:min-h-14 max-[600px]:w-full max-[600px]:justify-between',
              })}
              href="#builder"
            >
              Build a workout <ArrowUpRight size={21} />
            </a>
          </div>
          <figure className="flex min-w-0 flex-col motion-safe:animate-arrive">
            <img
              className="h-[clamp(460px,39vw,560px)] w-full object-cover object-[66%_center] max-[900px]:h-[510px] max-[600px]:aspect-[1.1] max-[600px]:h-auto max-[600px]:object-[70%_center]"
              src="/images/training-studio.jpg"
              alt="An athlete stretching in a sunlit training studio"
              width="1536"
              height="1024"
              fetchPriority="high"
            />
          </figure>
        </section>
        <section
          data-testid="workout-studio"
          className="mx-auto w-[min(calc(100%-var(--page-gutter)*2),var(--page-width))] border-t border-line pt-12 pb-[72px] max-[600px]:pt-9 max-[600px]:pb-12 print:m-0 print:block print:w-full print:max-w-none print:border-0 print:p-0"
          id="builder"
          aria-labelledby="studio-title"
        >
          <div className="mb-8 flex items-end justify-between gap-6 max-[600px]:mb-6 print:hidden">
            <div>
              <h2
                id="studio-title"
                className="font-display text-[clamp(36px,3.9vw,56px)] font-normal leading-[1.12] tracking-[-0.025em] max-[600px]:text-[clamp(34px,9vw,46px)]"
              >
                Your time. Your pace.
              </h2>
              <p className="mt-3 text-[15px] leading-[1.7] text-muted max-[600px]:text-[13px]">
                Choose your starting point. We’ll build the plan.
              </p>
            </div>
            <span className="text-xs text-muted max-[600px]:hidden">
              30-120 minutes · Five levels
            </span>
          </div>
          <div className="grid grid-cols-[350px_minmax(0,1fr)] items-start gap-8 max-[1150px]:grid-cols-[310px_minmax(0,1fr)] max-[1150px]:gap-6 max-[900px]:grid-cols-1 max-[900px]:gap-8 print:block">
            <div className="min-[1100px]:sticky min-[1100px]:top-6 print:hidden">
              <WorkoutBuilder
                value={preferences}
                onChange={(patch) => {
                  void navigate({
                    search: (previous) => {
                      const current = preferencesFromSearch(previous)
                      return {
                        minutes: patch.durationMinutes ?? current.durationMinutes,
                        level: patch.level ?? current.level,
                      }
                    },
                    hash: 'builder',
                    replace: true,
                    resetScroll: false,
                  })
                  generator.reset()
                }}
                onGenerate={() => generate(preferences)}
                pending={!isLoaded || generator.isPending}
                signedIn={Boolean(isSignedIn)}
                error={workout ? undefined : generationError}
                hasWorkout={workout !== null}
              />
              <p className="px-2 pt-4 text-xs leading-[1.8] text-muted">
                Bodyweight movements and exercises with light weights. Review your plan before you
                begin.
              </p>
            </div>
            <div
              className="min-w-0 print:block print:w-full"
              ref={resultRef}
              aria-busy={generator.isPending}
            >
              {workout ? (
                <WorkoutSheet
                  key={workout.id}
                  workout={workout}
                  pending={generator.isPending}
                  error={generationError}
                  onShuffle={() =>
                    generate({ durationMinutes: workout.requestedMinutes, level: workout.level })
                  }
                  changed={
                    preferences.durationMinutes !== workout.requestedMinutes ||
                    preferences.level !== workout.level
                  }
                />
              ) : (
                <WorkoutPreview minutes={preferences.durationMinutes} />
              )}
            </div>
          </div>
          {workout && (
            <p className="mt-5 flex flex-wrap items-center justify-end gap-2 text-xs max-[600px]:justify-start print:hidden">
              <Check size={16} /> Saved to your account.{' '}
              <Link
                to="/workouts"
                className="inline-flex min-h-11 items-center gap-[5px] underline underline-offset-4"
              >
                See all your workouts <ArrowUpRight size={14} />
              </Link>
            </p>
          )}
          <WorkoutStatus status={generator.status} workout={workout} />
        </section>
        <section
          className="mx-auto grid w-[min(calc(100%-var(--page-gutter)*2),var(--page-width))] grid-cols-2 items-center gap-[clamp(32px,6vw,88px)] border-t border-line py-20 max-[900px]:gap-8 max-[600px]:grid-cols-1 max-[600px]:py-12 print:hidden"
          id="how-it-works"
          aria-labelledby="how-title"
        >
          <div className="h-[630px] max-[1150px]:h-[580px] max-[900px]:h-[600px] max-[600px]:aspect-[1.15] max-[600px]:h-auto">
            <img
              className="h-full w-full object-cover object-[47%_center]"
              src="/images/before-training.jpg"
              alt="Lacing up training shoes beside an orange bench"
              width="1536"
              height="1024"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div>
            <h2
              id="how-title"
              className="font-display text-[clamp(40px,4.2vw,60px)] font-normal leading-[1.12] tracking-[-0.03em] max-[900px]:text-[40px] max-[600px]:text-[clamp(38px,10vw,54px)]"
            >
              Less thinking.
              <br />
              More doing.
            </h2>
            <p className="mt-[22px] text-[15px] leading-[1.7] text-muted max-[900px]:text-sm max-[600px]:mt-[18px]">
              The hardest part shouldn’t be making a plan.
            </p>
            <dl className="mt-[18px] [&>div]:border-b [&>div]:border-line [&>div]:py-[22px] [&_dt]:text-[17px] [&_dt]:font-bold [&_dt]:tracking-[-0.3px] max-[600px]:[&_dt]:text-base [&_dd]:mt-2 [&_dd]:max-w-[400px] [&_dd]:text-[13px] [&_dd]:leading-[1.85] [&_dd]:text-muted">
              <div>
                <dt>Find your starting point.</dt>
                <dd>Pick your time and level. From a steady 30 minutes to a longer challenge.</dd>
              </div>
              <div>
                <dt>Get the whole picture.</dt>
                <dd>
                  Three body areas, clear sets and reps, and an honest time estimate. Longer plans
                  include a warm-up.
                </dd>
              </div>
              <div>
                <dt>Take it with you.</dt>
                <dd>
                  Follow one exercise at a time or print your plan. Every workout is saved for
                  another day.
                </dd>
              </div>
            </dl>
            <a
              className="group mt-[18px] inline-flex min-h-11 items-center gap-4 text-sm font-bold [&_svg]:transition-transform [&_svg]:duration-180 hover:[&_svg]:translate-x-[3px] hover:[&_svg]:-translate-y-[3px]"
              href="#builder"
            >
              Build a workout <MoveUpRight size={18} />
            </a>
          </div>
        </section>
        <section
          className="mx-auto flex w-[min(calc(100%-var(--page-gutter)*2),var(--page-width))] items-end justify-between gap-9 pt-12 pb-[72px] max-[900px]:items-center max-[600px]:flex-col max-[600px]:items-start max-[600px]:gap-7 max-[600px]:pt-8 max-[600px]:pb-12 print:hidden"
          aria-label="Make room for movement"
        >
          <p className="font-display text-[clamp(36px,4.3vw,62px)] font-normal leading-[1.12] tracking-[-0.025em] max-[900px]:text-[40px] max-[600px]:text-[clamp(30px,8vw,44px)]">
            Any day can be
            <br />
            <span className="text-muted">a good day to move.</span>
          </p>
          <a
            className={buttonClassName({
              variant: 'primary',
              className: 'mb-[5px] shrink-0 max-[600px]:w-full max-[600px]:justify-between',
            })}
            href="#builder"
          >
            Build a workout <ArrowUpRight size={21} />
          </a>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
