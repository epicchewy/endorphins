import { ArrowUpRight, Check } from 'lucide-react'
import { useReducer } from 'react'
import { Button } from '~/components/ui/button'
import { FieldDescription, FieldLegend, FieldSet } from '~/components/ui/field'
import { Feedback } from '~/components/ui/feedback'
import { Input } from '~/components/ui/input'
import { RadioOption } from '~/components/ui/radio-option'
import { cn } from '~/lib/utils'
import type { GenerateInput } from '~/services/workouts'

import { workoutLevels as levels } from '~/services/workout-levels'

const presets = [30, 45, 60]

// The custom cell keeps the typed text. It is empty while a preset is chosen.
function durationDraft(minutes: number, text = '') {
  return {
    source: minutes,
    text: Number(text) === minutes || !presets.includes(minutes) ? String(minutes) : '',
  }
}
function editDuration(
  state: ReturnType<typeof durationDraft>,
  patch: Partial<ReturnType<typeof durationDraft>>,
) {
  return { ...state, ...patch }
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
  const [duration, dispatch] = useReducer(editDuration, value.durationMinutes, durationDraft)
  if (duration.source !== value.durationMinutes)
    dispatch(durationDraft(value.durationMinutes, duration.text))
  const preset = presets.includes(value.durationMinutes)
  const currentLevel = levels.find((level) => level.number === value.level) ?? levels[1]
  return (
    <form
      className="rounded-xl border bg-card p-7 max-[1150px]:p-6 max-[360px]:p-5"
      aria-label="Workout preferences"
      onSubmit={(event) => {
        event.preventDefault()
        onGenerate()
      }}
    >
      <h2 className="text-2xl font-extrabold max-[600px]:text-[23px]">Choose your workout</h2>
      <p className="mt-2 text-sm text-muted-foreground max-[900px]:mt-1">
        Set your time and level.
      </p>
      <FieldSet disabled={pending} className="mt-7 gap-3 max-[900px]:mt-6">
        <FieldLegend variant="label" className="mb-0 font-bold">
          Duration
        </FieldLegend>
        <div className="grid grid-cols-4 gap-2 max-[360px]:grid-cols-2">
          {presets.map((minutes) => (
            <RadioOption
              key={minutes}
              name="duration"
              value={minutes}
              checked={value.durationMinutes === minutes}
              onChange={() => onChange({ durationMinutes: minutes })}
            >
              <span className="text-[22px] font-bold tabular-nums">
                {minutes}
                <small className="ml-[3px] text-xs font-medium">min</small>
              </span>
            </RadioOption>
          ))}
          <Input
            id="custom-duration"
            name="duration"
            aria-label="Custom duration"
            aria-describedby="custom-duration-hint"
            autoComplete="off"
            placeholder="Custom"
            type="number"
            inputMode="numeric"
            min="30"
            max="120"
            step="1"
            required={!preset}
            value={duration.text}
            className={cn(
              'h-auto min-h-14 px-1 text-center text-[22px] font-bold tabular-nums [appearance:textfield] placeholder:text-sm placeholder:font-medium hover:bg-muted dark:bg-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
              !preset && 'border-foreground',
            )}
            onChange={(event) => {
              dispatch({ source: value.durationMinutes, text: event.target.value })
              const minutes = event.target.valueAsNumber
              if (Number.isInteger(minutes) && minutes >= 30 && minutes <= 120) {
                onChange({ durationMinutes: minutes })
              }
            }}
          />
        </div>
        <FieldDescription id="custom-duration-hint" className="text-xs">
          Or enter 30–120 minutes.
        </FieldDescription>
      </FieldSet>
      <FieldSet disabled={pending} className="mt-7 gap-3 max-[900px]:mt-6">
        <FieldLegend variant="label" className="mb-0 font-bold">
          Level
        </FieldLegend>
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
              {level.number}
            </RadioOption>
          ))}
        </div>
        <div className="min-h-16 max-[900px]:min-h-12 max-[600px]:min-h-[58px]" aria-live="polite">
          <strong className="text-sm font-bold">{currentLevel.title}</strong>
          <p className="mt-[5px] text-xs leading-[1.7] text-muted-foreground">
            {currentLevel.detail}
          </p>
        </div>
      </FieldSet>
      {error && <Feedback>{error}</Feedback>}
      <Button type="submit" size="lg" className="mt-6 w-full" pending={pending}>
        {pending ? 'Building your workout…' : 'Generate my workout'}
        {!pending && <ArrowUpRight aria-hidden="true" />}
      </Button>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Check size={14} aria-hidden="true" />
        Your plan saves when it is ready.
      </p>
    </form>
  )
}
