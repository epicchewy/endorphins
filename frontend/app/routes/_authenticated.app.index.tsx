import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowUpRight, Check, Plus, Trophy } from 'lucide-react'
import { useActivity } from '~/hooks/use-activity'
import { useWorkouts } from '~/hooks/use-workouts'
import type { Workout } from '~/services/workouts'
import type { Activity } from '~/services/activity'
import { completionMilestone, completionMilestones } from '~/services/activity'
import { buttonVariants } from '~/components/ui/button-variants'
import { cn } from '~/lib/utils'
import { PageHeading } from '~/components/ui/page-heading'
import { Feedback, LoadingState } from '~/components/ui/feedback'
import { LocalDate } from '~/components/ui/local-date'
import roomToMove from '~/assets/images/room-to-move-768.webp'
import roomToMoveLarge from '~/assets/images/room-to-move-1448.webp'

export const Route = createFileRoute('/_authenticated/app/')({ component: Dashboard })
function Dashboard() {
  const activity = useActivity()
  const plans = useWorkouts(1)
  const latest = plans.data?.pages[0]?.items[0]
  if (activity.isPending || plans.isPending)
    return <LoadingState>Loading your dashboard…</LoadingState>
  if (activity.isError)
    return <Feedback retry={() => void activity.refetch()}>{activity.error.message}</Feedback>
  if (plans.isError)
    return <Feedback retry={() => void plans.refetch()}>{plans.error.message}</Feedback>
  const data = activity.data
  return (
    <>
      <PageHeading
        title="Your dashboard"
        description={
          data.completedCount === 0
            ? 'Make a little room for movement.'
            : data.completedCount === 1
              ? 'One workout complete. A good start.'
              : 'Your completed workouts, week by week.'
        }
        actions={
          (latest || data.completedCount > 0) && (
            <Link to="/app/new" className={buttonVariants()}>
              <Plus size={18} aria-hidden="true" />
              New workout
            </Link>
          )
        }
      />
      {data.completedCount === 0 ? (
        <DashboardStart latest={latest} />
      ) : (
        <>
          {latest && latest.completedCount === 0 && <UpNext workout={latest} />}
          <DashboardActivity data={data} />
        </>
      )}
    </>
  )
}

function DashboardStart({ latest }: { latest?: Workout }) {
  return (
    <section
      className="grid grid-cols-[1fr_.8fr] items-center gap-12 rounded-xl border border-border bg-card p-10 max-[700px]:grid-cols-1 max-[700px]:gap-7 max-[600px]:p-6"
      aria-labelledby="start-title"
    >
      <div>
        <p className="mb-4 text-xs text-muted-foreground">
          {latest ? 'Saved and ready' : 'At home · No equipment'}
        </p>
        <h2
          id="start-title"
          className="font-display text-[clamp(32px,4vw,44px)] leading-tight tracking-tight"
        >
          {latest ? 'Your workout is ready.' : 'Start with one workout.'}
        </h2>
        <p className="mt-4 max-w-[40ch] text-sm leading-relaxed text-muted-foreground">
          {latest
            ? 'Your plan is saved. Open it when you are ready, then mark it complete after you work out.'
            : 'Choose your time and level. We will save a full-body plan that you can use at home.'}
        </p>
        <Link
          to={latest ? '/app/workouts/$workoutId' : '/app/new'}
          params={{ workoutId: latest?.id ?? '' }}
          className={cn(buttonVariants(), 'mt-6')}
        >
          {latest ? 'Open workout' : 'Create my first workout'}{' '}
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
      {latest ? (
        <div className="border-l border-border pl-10 max-[700px]:border-t max-[700px]:border-l-0 max-[700px]:pt-6 max-[700px]:pl-0">
          <p className="text-xs text-muted-foreground">Latest saved plan</p>
          <p className="mt-3 font-display text-4xl">
            {latest.estimatedMinutes} <span className="text-xl">min est.</span>
          </p>
          <p className="mt-3 text-sm">
            Level {latest.level} · {latest.focus} focus
          </p>
        </div>
      ) : (
        <img
          src={roomToMove}
          srcSet={`${roomToMove} 768w, ${roomToMoveLarge} 1448w`}
          sizes="(max-width: 700px) calc(100vw - 88px), 540px"
          alt="Floor space and a wall are all you need"
          width="1448"
          height="1086"
          className="aspect-[4/3] w-full rounded-lg object-cover"
        />
      )}
    </section>
  )
}

// The newest saved plan, while it is still to do.
function UpNext({ workout }: { workout: Workout }) {
  return (
    <Link
      to="/app/workouts/$workoutId"
      params={{ workoutId: workout.id }}
      className="mb-8 flex items-center justify-between gap-6 rounded-xl border border-border bg-card px-8 py-6 transition-colors hover:border-input max-[600px]:px-5 max-[600px]:py-5"
    >
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">Ready when you are</span>
        <span className="mt-1 block text-lg font-semibold first-letter:uppercase">
          {workout.focus} focus
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          Level {workout.level} · About {workout.estimatedMinutes} min
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-2 text-sm font-bold">
        <span className="max-[600px]:sr-only">Open workout</span>
        <ArrowUpRight size={20} aria-hidden="true" />
      </span>
    </Link>
  )
}

function DashboardActivity({ data }: { data: Activity }) {
  const milestone = completionMilestone(data.completedCount)
  const nextMilestone = completionMilestones.find((value) => value > data.completedCount)
  const maxWeek = Math.max(1, ...data.weeks.map((week) => week.count))
  return (
    <>
      <section
        aria-label="Workout activity totals"
        className="mb-10 grid grid-cols-[1.2fr_1fr_1.2fr] items-center gap-8 rounded-xl border border-border bg-card p-8 max-[800px]:grid-cols-2 max-[600px]:gap-6 max-[600px]:p-5"
      >
        <dl>
          <dt className="text-sm text-muted-foreground">Completed workouts</dt>
          <dd
            data-testid="completed-total"
            className="mt-2 text-[clamp(64px,7vw,92px)] leading-none font-medium tracking-tight tabular-nums"
          >
            {data.completedCount.toLocaleString()}
          </dd>
          <dd className="mt-3 text-xs text-muted-foreground">Every workout you finish counts.</dd>
        </dl>
        <dl className="border-l border-border pl-8 max-[600px]:pl-5">
          <dt className="text-sm text-muted-foreground">Active days this week</dt>
          <dd className="mt-3 text-5xl font-medium tracking-tight tabular-nums">
            {data.activeDaysThisWeek}
            <span className="ml-2 text-base text-muted-foreground">/ 7</span>
          </dd>
          <dd className="mt-4 text-xs text-muted-foreground">Weeks start on Monday.</dd>
        </dl>
        <div className="rounded-lg bg-primary/15 p-5 max-[800px]:col-span-full">
          <Trophy size={24} strokeWidth={1.5} className="mb-3 text-emphasis" aria-hidden="true" />
          <p className="text-sm font-semibold">
            {milestone === 1 ? 'First workout complete' : `${milestone} workouts complete`}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {nextMilestone
              ? `${nextMilestone - data.completedCount} more to your ${nextMilestone}-workout milestone.`
              : 'You reached 50 workouts. Keep going at your pace.'}
          </p>
          <ol aria-label="Completion milestones" className="mt-4 flex justify-between gap-2">
            {completionMilestones.map((value) => (
              <li
                key={value}
                className={`flex size-9 items-center justify-center rounded-full text-xs font-semibold tabular-nums max-[360px]:size-8 ${data.completedCount >= value ? 'bg-primary text-primary-foreground' : 'border border-input text-muted-foreground'}`}
              >
                {value}
                <span className="sr-only">
                  {' '}
                  workouts{data.completedCount >= value ? ', reached' : ', upcoming'}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <div className="grid grid-cols-[1fr_1.1fr] gap-8 max-[800px]:grid-cols-1">
        <section
          aria-labelledby="activity-title"
          className="rounded-xl border border-border bg-card p-7 max-[600px]:p-5"
        >
          <h2 id="activity-title" className="text-lg font-semibold">
            Your last four weeks
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Completed workouts · Weeks start on Monday
          </p>
          <ol className="mt-8 grid grid-cols-4 gap-5">
            {data.weeks.map((week, index) => (
              <li key={week.start} className="flex flex-col items-center text-xs">
                <span className="mb-3 text-sm font-semibold tabular-nums">
                  {week.count}
                  <span className="sr-only"> completed workouts</span>
                </span>
                <div
                  aria-hidden="true"
                  className="flex h-32 w-full max-w-12 items-end border-b border-border"
                >
                  <div
                    className={`w-full rounded-t-lg ${index === 3 ? 'bg-primary' : 'bg-input'}`}
                    style={{ height: `${(week.count / maxWeek) * 100}%` }}
                  />
                </div>
                <LocalDate value={week.start} className="mt-3 text-muted-foreground" />
                {index === 3 && <span className="mt-1 text-muted-foreground">This week</span>}
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="recent-title">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="recent-title" className="text-lg font-semibold">
              Recent workouts
            </h2>
            <Link
              to="/app/workouts"
              className="inline-flex min-h-11 items-center text-xs font-semibold underline underline-offset-4"
            >
              Saved workouts
            </Link>
          </div>
          <ul className="border-t border-border">
            {data.recent.map((item) => (
              <li key={item.id}>
                <Link
                  to="/app/workouts/$workoutId"
                  params={{ workoutId: item.workoutId }}
                  className="flex min-h-20 items-center justify-between gap-4 border-b border-border py-4 hover:text-emphasis"
                >
                  <span>
                    <span className="block text-sm font-semibold first-letter:uppercase">
                      {item.focus} focus
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Level {item.level} · <LocalDate value={item.completedAt} />
                    </span>
                  </span>
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-emphasis">
                    <Check size={17} aria-hidden="true" />
                    <span className="sr-only">Completed</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
