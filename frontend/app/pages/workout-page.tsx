import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useAuth } from '~/auth/client'
import { SiteHeader } from '~/components/site-header'
import { SiteFooter } from '~/components/site-footer'
import { SkipLink } from '~/components/ui/skip-link'
import { buttonClassName } from '~/components/ui/button'
import homeWorkout from '~/assets/images/home-workout-768.webp'
import homeWorkoutLarge from '~/assets/images/home-workout-1122.webp'
import roomToMove from '~/assets/images/room-to-move-768.webp'
import roomToMoveLarge from '~/assets/images/room-to-move-1448.webp'

export function WorkoutPage() {
  const { isSignedIn } = useAuth()
  return (
    <div id="top">
      <SkipLink href="#home-content" />
      <SiteHeader landing />
      <main
        id="home-content"
        className="mx-auto w-[min(calc(100%-var(--page-gutter)*2),var(--page-width))]"
      >
        <section className="grid grid-cols-[1fr_1fr] items-center gap-16 py-12 max-[768px]:grid-cols-1 max-[768px]:gap-8 max-[768px]:py-8">
          <div>
            <p className="mb-6 text-sm text-muted">Home workouts. No equipment.</p>
            <h1 className="font-display text-[clamp(42px,5.4vw,72px)] leading-[1.08] tracking-tight">
              Your workout.
              <br />
              Your living room.
            </h1>
            <p className="mt-6 max-w-[35ch] text-lg leading-relaxed text-muted">
              A full-body plan for your time and level. All you need is floor space and a wall.
            </p>
            <Link
              to={isSignedIn ? '/app' : '/sign-up/$'}
              params={{ _splat: '' }}
              className={buttonClassName({
                variant: 'primary',
                className: 'mt-8 gap-8 max-[600px]:w-full max-[600px]:justify-between',
              })}
            >
              {isSignedIn ? 'Open my dashboard' : 'Get started'}
              <ArrowUpRight size={20} aria-hidden="true" />
            </Link>
          </div>
          <img
            src={homeWorkout}
            srcSet={`${homeWorkout} 768w, ${homeWorkoutLarge} 1122w`}
            sizes="(max-width: 768px) calc(100vw - 40px), 448px"
            alt="A woman doing a standing stretch in her living room"
            width="1122"
            height="1402"
            fetchPriority="high"
            className="aspect-[4/5] w-full max-w-[448px] justify-self-end rounded-panel object-cover max-[768px]:max-w-none max-[768px]:aspect-[4/3] max-[768px]:object-top"
          />
        </section>
        <section
          id="how-it-works"
          aria-labelledby="how-title"
          className="border-t border-line py-14 max-[600px]:py-10"
        >
          <h2
            id="how-title"
            className="max-w-[22ch] font-display text-[clamp(32px,3.5vw,46px)] leading-tight tracking-tight"
          >
            A plan for today. Progress over time.
          </h2>
          <div className="mt-9 grid grid-cols-[.8fr_1fr] items-center gap-16 max-[768px]:grid-cols-1 max-[768px]:gap-8">
            <img
              src={roomToMove}
              srcSet={`${roomToMove} 768w, ${roomToMoveLarge} 1448w`}
              sizes="(max-width: 768px) calc(100vw - 40px), (max-width: 1440px) 42vw, 559px"
              alt="Clear floor space beside a living room wall"
              width="1448"
              height="1086"
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full rounded-panel object-cover"
            />
            <ol className="grid gap-7">
              {[
                [
                  'Choose your workout',
                  'Set your time and level. Get exercises for legs, upper body, and core.',
                ],
                [
                  'Work out your way',
                  'Follow one exercise at a time, print your plan, or open it later.',
                ],
                [
                  'Mark it complete',
                  'See your completed workouts and active days. Reuse a plan whenever you like.',
                ],
              ].map(([title, body]) => (
                <li key={title} className="max-w-[42ch]">
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
