import { useState } from 'react'
import { ArrowLeft, ArrowUpRight, Check } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Brand } from './brand'
import { ThemeControl } from './theme'
import { Button, buttonClassName } from './ui/button'
import { Field, Input, RadioOption, SearchInput, Select } from './ui/field'
import { EmptyState, Feedback, LoadingState } from './ui/feedback'
import { Presence } from './ui/presence'
import { SkipLink } from './ui/skip-link'

const colors = ['background', 'surface', 'ink', 'muted', 'line', 'accent', 'focus', 'error']

function ComponentPreview({ theme }: { theme: 'light' | 'dark' }) {
  const [duration, setDuration] = useState(45)
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('2')
  const [error, setError] = useState(true)
  const [step, setStep] = useState(1)
  const id = (name: string) => `${theme}-${name}`
  return (
    <section
      className="rounded-panel border border-line bg-background p-8 text-ink max-[600px]:p-5"
      data-theme={theme}
      aria-label={`${theme} component preview`}
    >
      <div className="mb-6 flex items-baseline justify-between gap-4 max-[600px]:flex-col max-[600px]:gap-2">
        <h2 className="font-display text-[38px] leading-[1.2] font-normal">
          {theme === 'light' ? 'Light' : 'Dark'}
        </h2>
        <span className="text-xs text-muted">Same components. Same tokens.</span>
      </div>
      <div className="grid grid-cols-4 gap-4 max-[600px]:grid-cols-2 max-[600px]:gap-2">
        {colors.map((color) => (
          <div key={color} className="min-w-0">
            <span
              className="mb-2 block h-12 rounded-control border border-line-strong"
              style={{ background: `var(--${color})` }}
            />
            <code className="font-body text-xs">{color}</code>
          </div>
        ))}
      </div>
      <section className="mt-12 border-t border-line pt-6" aria-labelledby={id('actions')}>
        <h3 className="text-xl tracking-tight" id={id('actions')}>
          Actions
        </h3>
        <p className="mt-2 mb-6 text-sm leading-[1.7] text-muted">
          One clear primary action. A visible focus ring. Room to tap.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => setStep((current) => current + 1)}>
            Next move <ArrowUpRight size={18} aria-hidden="true" />
          </Button>
          <Button onClick={() => setStep(1)}>Reset preview</Button>
          <Button variant="ghost" onClick={() => setQuery('')}>
            Clear search
          </Button>
          <Button disabled>Unavailable</Button>
          <Button pending>Saving…</Button>
        </div>
      </section>
      <section className="mt-12 border-t border-line pt-6" aria-labelledby={id('fields')}>
        <h3 className="text-xl tracking-tight" id={id('fields')}>
          Fields & choices
        </h3>
        <p className="mt-2 mb-6 text-sm leading-[1.7] text-muted">
          Native keyboard behavior, persistent labels, and contextual feedback.
        </p>
        <div className="grid grid-cols-2 items-start gap-x-4 gap-y-6 max-[600px]:grid-cols-1">
          <Field label="Duration" htmlFor={id('duration')} hint="Between 30 and 120 minutes.">
            <Input
              id={id('duration')}
              aria-describedby={id('duration-hint')}
              type="number"
              min={30}
              max={120}
              value={duration}
              onChange={(event) => setDuration(event.target.valueAsNumber || 30)}
            />
          </Field>
          <Field label="Your level" htmlFor={id('level')}>
            <Select
              id={id('level')}
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  Level {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field className="col-span-full" label="Search your workouts" htmlFor={id('search')}>
            <SearchInput
              id={id('search')}
              placeholder="Exercise or body area"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
          <Field
            className="col-span-full"
            label="Validation example"
            htmlFor={id('invalid')}
            error="Choose a duration of at least 30 minutes."
          >
            <Input
              id={id('invalid')}
              aria-invalid="true"
              aria-describedby={id('invalid-error')}
              value="20"
              readOnly
            />
          </Field>
        </div>
        <fieldset className="mt-7.5 min-w-0 border-0 p-0 max-[900px]:mt-6 max-[600px]:mt-7">
          <legend className="mb-3.5 p-0 text-sm font-bold">Preset duration</legend>
          <div className="grid grid-cols-3 gap-2">
            {[30, 45, 60].map((minutes) => (
              <RadioOption
                name={id('preset')}
                key={minutes}
                value={minutes}
                checked={duration === minutes}
                onChange={() => setDuration(minutes)}
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold max-[600px]:gap-1">
                  {minutes} min{' '}
                  {duration === minutes && (
                    <Check className="max-[600px]:w-3" size={14} aria-hidden="true" />
                  )}
                </span>
              </RadioOption>
            ))}
          </div>
        </fieldset>
      </section>
      <section className="mt-12 border-t border-line pt-6" aria-labelledby={id('feedback')}>
        <h3 className="text-xl tracking-tight" id={id('feedback')}>
          Feedback & states
        </h3>
        <p className="mt-2 mb-6 text-sm leading-[1.7] text-muted">
          Keep context when something fails. Put recovery beside the message.
        </p>
        <Feedback
          tone={error ? 'error' : 'info'}
          title={error ? 'We couldn’t save your workout.' : 'Ready to try again.'}
          retry={() => setError((value) => !value)}
          retryLabel={error ? 'Try again' : 'Show error state'}
        >
          {error ? 'Your current plan is unchanged.' : 'Your previous plan is still available.'}
        </Feedback>
        <LoadingState>Finding your saved workouts…</LoadingState>
        <EmptyState
          className="mt-4"
          title="A fresh start."
          action={
            <Button variant="primary" onClick={() => setStep((current) => current + 1)}>
              Build a workout <ArrowUpRight size={18} aria-hidden="true" />
            </Button>
          }
        >
          Your generated workouts will be saved here.
        </EmptyState>
      </section>
      <section className="mt-12 border-t border-line pt-6" aria-labelledby={id('motion')}>
        <h3 className="text-xl tracking-tight" id={id('motion')}>
          A little movement
        </h3>
        <p className="mt-2 mb-6 text-sm leading-[1.7] text-muted">
          A 180ms transition marks a changed step. Reduced motion removes movement.
        </p>
        <div className="min-h-[90px] overflow-hidden rounded-control bg-surface p-6 text-[22px]">
          <Presence identity={step} direction={1}>
            <output aria-live="polite">Step {step}. Make it count.</output>
          </Presence>
        </div>
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
      <header className="flex min-h-20 items-center justify-between border-b border-line">
        <Brand />
        <ThemeControl />
      </header>
      <main id="system-content">
        <div className="max-w-[800px] py-12">
          <Link
            to="/"
            className={buttonClassName({
              variant: 'ghost',
              size: 'small',
              className: '-ml-3.5 mb-6',
            })}
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back to Endorphins
          </Link>
          <h1 className="font-display text-[clamp(40px,5vw,68px)] leading-[1.1] font-normal tracking-tight">
            Built with intention.
          </h1>
          <p className="mt-6 max-w-[62ch] text-base leading-[1.8] text-muted">
            The Endorphins component library. Sharp Serif for expression, Inter for clarity, and one
            warm orange to move things forward.
          </p>
          <dl className="mt-8 grid grid-cols-2 gap-6 max-[600px]:grid-cols-1">
            <div>
              <dt className="mb-2 text-xs text-muted">Spacing</dt>
              <dd className="text-sm leading-[1.6]">4 / 8 / 12 / 16 / 24 / 32 / 48 / 64</dd>
            </div>
            <div>
              <dt className="mb-2 text-xs text-muted">Shape</dt>
              <dd className="text-sm leading-[1.6]">8px controls / 12px surfaces</dd>
            </div>
            <div>
              <dt className="mb-2 text-xs text-muted">Touch</dt>
              <dd className="text-sm leading-[1.6]">48px controls / 44px minimum</dd>
            </div>
            <div>
              <dt className="mb-2 text-xs text-muted">Motion</dt>
              <dd className="text-sm leading-[1.6]">180ms state / reduced motion aware</dd>
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
