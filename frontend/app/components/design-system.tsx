import { useState } from 'react'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn } from '~/lib/utils'
import { Brand } from './brand'
import { ThemeControl } from './theme'
import { Button } from './ui/button'
import { buttonVariants } from './ui/button-variants'
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from './ui/field'
import { EmptyState, Feedback, LoadingState } from './ui/feedback'
import { Input } from './ui/input'
import { NativeSelect, NativeSelectOption } from './ui/native-select'
import { RadioOption } from './ui/radio-option'
import { SkipLink } from './ui/skip-link'

const colors = [
  'background',
  'card',
  'foreground',
  'muted-foreground',
  'border',
  'primary',
  'ring',
  'destructive',
]

function ComponentPreview({ theme }: { theme: 'light' | 'dark' }) {
  const [duration, setDuration] = useState(45)
  const [error, setError] = useState(true)
  const id = (name: string) => `${theme}-${name}`
  return (
    <section
      className="rounded-xl border bg-background p-8 text-foreground max-[600px]:p-5"
      data-theme={theme}
      aria-label={`${theme} component preview`}
    >
      <div className="mb-6 flex items-baseline justify-between gap-4 max-[600px]:flex-col max-[600px]:gap-2">
        <h2 className="font-display text-[38px] leading-[1.2] font-normal">
          {theme === 'light' ? 'Light' : 'Dark'}
        </h2>
        <span className="text-xs text-muted-foreground">Same components. Same tokens.</span>
      </div>
      <div className="grid grid-cols-4 gap-4 max-[600px]:grid-cols-2 max-[600px]:gap-2">
        {colors.map((color) => (
          <div key={color} className="min-w-0">
            <span
              className="mb-2 block h-12 rounded-lg border border-input"
              style={{ background: `var(--${color})` }}
            />
            <code className="font-body text-xs">{color}</code>
          </div>
        ))}
      </div>
      <section className="mt-12 border-t pt-6" aria-labelledby={id('actions')}>
        <h3 className="text-xl" id={id('actions')}>
          Actions
        </h3>
        <p className="mt-2 mb-6 text-sm leading-[1.7] text-muted-foreground">
          One clear primary action. A visible focus ring. Room to tap. Hover changes color only.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button>
            Generate <ArrowUpRight aria-hidden="true" />
          </Button>
          <Button variant="outline">Print</Button>
          <Button variant="ghost">Back</Button>
          <Button variant="outline" disabled>
            Unavailable
          </Button>
          <Button variant="outline" pending>
            Saving…
          </Button>
        </div>
      </section>
      <section className="mt-12 border-t pt-6" aria-labelledby={id('fields')}>
        <h3 className="text-xl" id={id('fields')}>
          Fields & choices
        </h3>
        <p className="mt-2 mb-6 text-sm leading-[1.7] text-muted-foreground">
          Native keyboard behavior, persistent labels, and contextual feedback.
        </p>
        <div className="grid grid-cols-2 items-start gap-x-4 gap-y-6 max-[600px]:grid-cols-1">
          <Field>
            <FieldLabel htmlFor={id('duration')}>Duration</FieldLabel>
            <Input
              id={id('duration')}
              aria-describedby={id('duration-hint')}
              type="number"
              min={30}
              max={120}
              value={duration}
              onChange={(event) => setDuration(event.target.valueAsNumber || 30)}
            />
            <FieldDescription id={id('duration-hint')}>
              Between 30 and 120 minutes.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={id('level')}>Your level</FieldLabel>
            <NativeSelect id={id('level')} className="w-full" defaultValue="2">
              {[1, 2, 3, 4, 5].map((value) => (
                <NativeSelectOption key={value} value={value}>
                  Level {value}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field data-invalid="true" className="col-span-full">
            <FieldLabel htmlFor={id('invalid')}>Validation example</FieldLabel>
            <Input
              id={id('invalid')}
              aria-invalid="true"
              aria-describedby={id('invalid-error')}
              value="20"
              readOnly
            />
            <FieldError id={id('invalid-error')}>
              Choose a duration of at least 30 minutes.
            </FieldError>
          </Field>
        </div>
        <FieldSet className="mt-7 gap-3">
          <FieldLegend variant="label" className="mb-0 font-bold">
            Preset duration
          </FieldLegend>
          <div className="grid grid-cols-3 gap-2">
            {[30, 45, 60].map((minutes) => (
              <RadioOption
                name={id('preset')}
                key={minutes}
                value={minutes}
                checked={duration === minutes}
                onChange={() => setDuration(minutes)}
              >
                <span className="text-sm font-semibold">{minutes} min</span>
              </RadioOption>
            ))}
          </div>
        </FieldSet>
      </section>
      <section className="mt-12 border-t pt-6" aria-labelledby={id('feedback')}>
        <h3 className="text-xl" id={id('feedback')}>
          Feedback & states
        </h3>
        <p className="mt-2 mb-6 text-sm leading-[1.7] text-muted-foreground">
          Keep context when something fails. Put recovery beside the message.
        </p>
        <Feedback
          tone={error ? 'error' : 'info'}
          title={error ? 'We couldn’t save your workout.' : 'Ready to try again.'}
          retry={() => setError(!error)}
          retryLabel={error ? 'Try again' : 'Show error state'}
        >
          {error ? 'Your current plan is unchanged.' : 'Your previous plan is still available.'}
        </Feedback>
        <LoadingState>Finding your saved workouts…</LoadingState>
        <EmptyState
          className="mt-4"
          title="A fresh start."
          action={
            <Button>
              Build a workout <ArrowUpRight aria-hidden="true" />
            </Button>
          }
        >
          Your generated workouts will be saved here.
        </EmptyState>
      </section>
    </section>
  )
}

export function DesignSystem() {
  return (
    <div
      className="mx-auto w-[min(calc(100%-var(--page-gutter)*2),var(--page-width))] pb-16"
      id="top"
    >
      <SkipLink href="#system-content">Skip to component library</SkipLink>
      <header className="flex min-h-20 items-center justify-between border-b">
        <Brand />
        <ThemeControl />
      </header>
      <main id="system-content">
        <div className="max-w-[800px] py-12">
          <Link
            to="/"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-3.5 mb-6')}
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back to Endorphins
          </Link>
          <h1 className="font-display text-[clamp(40px,5vw,68px)] leading-[1.1] font-normal tracking-tight">
            Built with intention.
          </h1>
          <p className="mt-6 max-w-[62ch] text-base leading-[1.8] text-muted-foreground">
            The Endorphins component library. Sharp Serif for expression, Inter for clarity, and one
            warm orange to move things forward.
          </p>
          <dl className="mt-8 grid grid-cols-2 gap-6 max-[600px]:grid-cols-1">
            <div>
              <dt className="mb-2 text-xs text-muted-foreground">Spacing</dt>
              <dd className="text-sm leading-[1.6]">4 / 8 / 12 / 16 / 24 / 32 / 48 / 64</dd>
            </div>
            <div>
              <dt className="mb-2 text-xs text-muted-foreground">Shape</dt>
              <dd className="text-sm leading-[1.6]">8px controls / 12px surfaces</dd>
            </div>
            <div>
              <dt className="mb-2 text-xs text-muted-foreground">Touch</dt>
              <dd className="text-sm leading-[1.6]">48px controls / 44px minimum</dd>
            </div>
            <div>
              <dt className="mb-2 text-xs text-muted-foreground">Motion</dt>
              <dd className="text-sm leading-[1.6]">Color and focus changes only</dd>
            </div>
          </dl>
        </div>
        <div className="grid grid-cols-2 items-start gap-6 max-[900px]:grid-cols-1">
          <ComponentPreview theme="light" />
          <ComponentPreview theme="dark" />
        </div>
      </main>
    </div>
  )
}
