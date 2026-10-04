import { ArrowUpRight, Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Field, Input, RadioOption } from '~/components/ui/field'
import { Feedback } from '~/components/ui/feedback'
import { Presence } from '~/components/ui/presence'
import type { GenerateInput } from '~/services/workouts'

const levels = [
  { number: 1, title: 'Starting your rhythm', detail: 'Lower reps and foundational variations.' },
  { number: 2, title: 'Finding your rhythm', detail: 'A little more volume. A steady challenge.' },
  { number: 3, title: 'Building momentum', detail: 'More reps and demanding variations.' },
  { number: 4, title: 'Going a little further', detail: 'Higher volume for experienced movers.' },
  { number: 5, title: 'Meeting the challenge', detail: 'The most demanding exercise variations.' },
]
export function WorkoutBuilder({
  value,
  onChange,
  onGenerate,
  pending,
  error,
  hasWorkout,
  signedIn = true,
}: {
  value: GenerateInput
  onChange: (input: Partial<GenerateInput>) => void
  onGenerate: () => void
  pending: boolean
  error: string | undefined
  hasWorkout: boolean
  signedIn?: boolean
}) {
  const [customTimeExpanded, setCustomTime] = useState(false)
  const customTime = customTimeExpanded || ![30, 45, 60].includes(value.durationMinutes)
  const [durationDraft, setDurationDraft] = useState({
    source: value.durationMinutes,
    text: String(value.durationMinutes),
  })
  if (durationDraft.source !== value.durationMinutes) {
    setDurationDraft({ source: value.durationMinutes, text: String(value.durationMinutes) })
  }
  const currentLevel = levels.find((level) => level.number === value.level) ?? levels[1]
  return (
    <form
      className="rounded-panel border border-line bg-surface p-7 max-[1150px]:p-6 max-[900px]:grid max-[900px]:grid-cols-2 max-[900px]:gap-x-8 max-[600px]:block max-[360px]:p-5"
      aria-label="Workout preferences"
      onSubmit={(event) => {
        event.preventDefault()
        onGenerate()
      }}
    >
      <div className="col-span-full">
        <h3 className="text-2xl font-extrabold tracking-[-0.7px] max-[600px]:text-[23px]">
          Make it yours.
        </h3>
        <p className="mt-2 text-sm text-muted max-[900px]:mt-1">Two choices. One fresh plan.</p>
      </div>
      <fieldset
        disabled={pending}
        className="mt-7.5 min-w-0 border-0 p-0 max-[900px]:mt-6 max-[600px]:mt-7"
      >
        <legend className="mb-3.5 p-0 text-sm font-bold">Your time</legend>
        <div className="grid grid-cols-3 gap-2">
          {[30, 45, 60].map((minutes) => (
            <RadioOption
              key={minutes}
              name="duration"
              value={minutes}
              checked={!customTime && value.durationMinutes === minutes}
              onChange={() => {
                setCustomTime(false)
                onChange({ durationMinutes: minutes })
              }}
            >
              <span className="text-[22px] font-bold tabular-nums">
                {minutes}
                <small className="ml-[3px] text-xs font-medium">min</small>
              </span>
            </RadioOption>
          ))}
        </div>
        <Button
          variant="ghost"
          className="min-h-11 w-full justify-between px-0 text-left text-xs text-muted"
          type="button"
          aria-expanded={customTime}
          onClick={() => {
            setDurationDraft({ source: value.durationMinutes, text: String(value.durationMinutes) })
            if (customTime && ![30, 45, 60].includes(value.durationMinutes)) {
              onChange({ durationMinutes: 45 })
            }
            setCustomTime(!customTime)
          }}
        >
          {customTime ? 'Use a preset duration' : 'Have a different amount of time?'}
          <span className="text-lg" aria-hidden="true">
            {customTime ? '−' : '+'}
          </span>
        </Button>
        <Presence present={customTime}>
          <Field
            className="mt-2 grid-cols-[1fr_90px] items-center [&>p]:col-span-full"
            label="Duration"
            htmlFor="custom-duration"
            hint="30–120 minutes"
          >
            <Input
              id="custom-duration"
              aria-describedby="custom-duration-hint"
              type="number"
              min="30"
              max="120"
              step="1"
              required
              value={durationDraft.text}
              onChange={(event) => {
                setCustomTime(true)
                setDurationDraft({ source: value.durationMinutes, text: event.target.value })
                const minutes = event.target.valueAsNumber
                if (Number.isInteger(minutes) && minutes >= 30 && minutes <= 120) {
                  onChange({ durationMinutes: minutes })
                }
              }}
            />
          </Field>
        </Presence>
      </fieldset>
      <fieldset
        disabled={pending}
        className="mt-7.5 min-w-0 border-0 p-0 max-[900px]:mt-6 max-[600px]:mt-7"
      >
        <legend className="mb-3.5 p-0 text-sm font-bold">Your level</legend>
        <div className="grid grid-cols-5 gap-2">
          {levels.map((level) => (
            <RadioOption
              className="min-h-12 text-[15px] font-bold"
              key={level.number}
              name="level"
              value={level.number}
              aria-label={`Level ${level.number}: ${level.title}`}
              checked={value.level === level.number}
              onChange={() => onChange({ level: level.number })}
            >
              <span>{level.number}</span>
              {value.level === level.number && (
                <Check className="absolute top-[3px] right-[3px]" size={12} aria-hidden="true" />
              )}
            </RadioOption>
          ))}
        </div>
        <div
          className="mt-4 min-h-16 max-[900px]:min-h-12 max-[600px]:min-h-[58px]"
          aria-live="polite"
        >
          <strong className="text-sm font-bold">{currentLevel.title}</strong>
          <p className="mt-[5px] text-xs leading-[1.7] text-muted">{currentLevel.detail}</p>
        </div>
      </fieldset>
      {error && <Feedback className="col-span-full">{error}</Feedback>}
      <Button
        variant="primary"
        className="col-span-full mt-6 min-h-14 w-full justify-between p-4 text-sm max-[900px]:mt-5 max-[600px]:mt-5.5"
        type="submit"
        pending={pending}
      >
        <span>
          {pending
            ? 'Building your workout…'
            : !signedIn
              ? 'Sign in to build my workout'
              : hasWorkout
                ? 'Generate a new workout'
                : 'Generate my workout'}
        </span>
        {!pending && <ArrowUpRight size={20} aria-hidden="true" />}
      </Button>
      <p className="col-span-full mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
        <Check size={14} aria-hidden="true" />
        {signedIn
          ? 'Every workout, saved to your account.'
          : 'Create an account to save every workout.'}
      </p>
    </form>
  )
}
