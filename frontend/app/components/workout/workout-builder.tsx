import { ArrowUpRight, Check } from 'lucide-react'
import { useReducer } from 'react'
import { Button } from '~/components/ui/button'
import { Field, Input, RadioOption } from '~/components/ui/field'
import { Feedback } from '~/components/ui/feedback'
import { Presence } from '~/components/ui/presence'
import type { GenerateInput } from '~/services/workouts'

import { workoutLevels as levels } from '~/services/workout-levels'

function durationEditor(minutes: number) {
  return { expanded: false, source: minutes, text: String(minutes) }
}
type DurationAction =
  | { type: 'sync'; minutes: number }
  | { type: 'preset'; minutes: number }
  | { type: 'custom'; expanded: boolean; minutes: number }
  | { type: 'draft'; source: number; text: string }
function editDuration(state: ReturnType<typeof durationEditor>, action: DurationAction) {
  switch (action.type) {
    case 'sync':
      return { ...state, source: action.minutes, text: String(action.minutes) }
    case 'preset':
      return durationEditor(action.minutes)
    case 'custom':
      return { expanded: action.expanded, source: action.minutes, text: String(action.minutes) }
    case 'draft':
      return { expanded: true, source: action.source, text: action.text }
  }
}

export function WorkoutBuilder({
  value,
  onChange,
  onGenerate,
  pending,
  error,
}: {
  value: GenerateInput
  onChange: (input: Partial<GenerateInput>) => void
  onGenerate: () => void
  pending: boolean
  error: string | undefined
}) {
  const [duration, dispatch] = useReducer(editDuration, value.durationMinutes, durationEditor)
  if (duration.source !== value.durationMinutes)
    dispatch({ type: 'sync', minutes: value.durationMinutes })
  const customTime = duration.expanded || ![30, 45, 60].includes(value.durationMinutes)
  const currentLevel = levels.find((level) => level.number === value.level) ?? levels[1]
  return (
    <form
      className="rounded-panel border border-line bg-surface p-7 max-[1150px]:p-6 max-[360px]:p-5"
      aria-label="Workout preferences"
      onSubmit={(event) => {
        event.preventDefault()
        onGenerate()
      }}
    >
      <div className="col-span-full">
        <h2 className="text-2xl font-extrabold tracking-[-0.7px] max-[600px]:text-[23px]">
          Choose your workout
        </h2>
        <p className="mt-2 text-sm text-muted max-[900px]:mt-1">Set your time and level.</p>
      </div>
      <fieldset
        disabled={pending}
        className="mt-7.5 min-w-0 border-0 p-0 max-[900px]:mt-6 max-[600px]:mt-7"
      >
        <legend className="mb-3.5 p-0 text-sm font-bold">Duration</legend>
        <div className="grid grid-cols-3 gap-2">
          {[30, 45, 60].map((minutes) => (
            <RadioOption
              key={minutes}
              name="duration"
              value={minutes}
              checked={!customTime && value.durationMinutes === minutes}
              onChange={() => {
                dispatch({ type: 'preset', minutes })
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
            if (customTime && ![30, 45, 60].includes(value.durationMinutes)) {
              onChange({ durationMinutes: 45 })
            }
            dispatch({ type: 'custom', expanded: !customTime, minutes: value.durationMinutes })
          }}
        >
          {customTime ? 'Use a preset duration' : 'Custom duration'}
          <span className="text-lg" aria-hidden="true">
            {customTime ? '−' : '+'}
          </span>
        </Button>
        <Presence present={customTime}>
          <Field
            className="mt-2 grid-cols-[1fr_90px] items-center [&>p]:col-span-full"
            label="Duration"
            htmlFor="custom-duration"
            hint="30-120 minutes"
          >
            <Input
              id="custom-duration"
              name="duration"
              autoComplete="off"
              aria-describedby="custom-duration-hint"
              type="number"
              min="30"
              max="120"
              step="1"
              required
              value={duration.text}
              onChange={(event) => {
                dispatch({ type: 'draft', source: value.durationMinutes, text: event.target.value })
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
        <legend className="mb-3.5 p-0 text-sm font-bold">Level</legend>
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
        <span>{pending ? 'Building your workout…' : 'Generate my workout'}</span>
        {!pending && <ArrowUpRight size={20} aria-hidden="true" />}
      </Button>
      <p className="col-span-full mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
        <Check size={14} aria-hidden="true" />
        Your plan saves when it is ready.
      </p>
    </form>
  )
}
