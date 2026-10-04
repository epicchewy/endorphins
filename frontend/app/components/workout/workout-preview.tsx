import { ArrowUpRight } from 'lucide-react'

export function WorkoutPreview({ minutes }: { minutes: number }) {
  const validTime = Number.isFinite(minutes) && minutes >= 30 && minutes <= 120
  return (
    <div
      className="flex min-h-[590px] flex-col max-[900px]:min-h-[430px] max-[600px]:min-h-[450px]"
      aria-label="Workout preview"
    >
      <div className="flex flex-1 flex-col justify-between gap-10 rounded-panel bg-inverse p-[clamp(24px,3vw,44px)] text-inverse-ink max-[600px]:gap-9 max-[600px]:px-6 max-[600px]:py-7">
        <span className="text-sm text-inverse-muted">Your next workout starts here.</span>
        <div className="flex items-center gap-7 max-[600px]:gap-5 max-[360px]:gap-3">
          <strong className="font-body text-[clamp(80px,8.3vw,120px)] leading-none font-semibold tracking-[-0.06em] text-accent tabular-nums max-[900px]:text-[88px] max-[360px]:text-[74px]">
            {validTime ? minutes : '?'}
          </strong>
          <div>
            <span className="text-sm font-bold tracking-[0.07em] max-[600px]:text-xs">MINUTES</span>
            <p className="mt-3 text-lg leading-[1.65] max-[600px]:text-[15px]">
              Carve out the time.
              <br />
              We’ll handle the plan.
            </p>
          </div>
        </div>
        <div
          className="flex justify-between gap-5 border-t border-[#4b5052] pt-6 text-sm max-[600px]:gap-3 max-[600px]:text-xs"
          aria-label="Body areas"
        >
          <span>Legs</span>
          <span>Upper body</span>
          <span>Core</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-5 border-b border-line px-2 py-7">
        <div>
          <h3 className="text-xl font-bold tracking-[-0.4px] max-[600px]:text-lg">
            A fresh mix, every time.
          </h3>
          <p className="mt-2 max-w-[340px] text-sm leading-[1.7] text-muted max-[600px]:text-xs">
            Your exercises, sets, and time breakdown will appear here.
          </p>
        </div>
        <ArrowUpRight size={26} aria-hidden="true" />
      </div>
      <p className="px-2 pt-4 text-xs leading-[1.8] text-muted">
        This is your requested duration. Your actual estimate appears with your generated workout.
      </p>
    </div>
  )
}
