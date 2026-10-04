import type { ReactNode } from 'react'
import { Brand } from '~/components/brand'
import { ThemeControl } from '~/components/theme'
import { ArrowLeft, Check } from 'lucide-react'
import { Link } from '@tanstack/react-router'

export function AuthPage({ children, signup = false }: { children: ReactNode; signup?: boolean }) {
  return (
    <div className="min-h-svh">
      <header className="flex h-20 items-center justify-between border-b border-line px-(--page-gutter) max-[600px]:h-18">
        <Brand />
        <ThemeControl />
      </header>
      <main className="grid min-h-[calc(100svh-80px)] grid-cols-2 max-[900px]:grid-cols-1 max-[600px]:min-h-[calc(100svh-72px)]">
        <div className="relative min-h-[720px] overflow-hidden bg-inverse max-[900px]:hidden">
          <img
            className="absolute size-full object-cover object-[72%_center]"
            src="/images/training-studio.jpg"
            alt="An athlete making time for a stretch in a daylight studio"
            width="1536"
            height="1024"
          />
          <div className="relative flex h-full min-h-[inherit] flex-col justify-end bg-[linear-gradient(transparent_45%,rgb(0_0_0/0.72))] p-12 text-white">
            <p className="mb-5 text-sm">A little movement goes a long way.</p>
            <h2 className="font-display text-[clamp(56px,5.6vw,80px)] leading-[1.1] font-normal tracking-tight">
              Make room
              <br />
              for you.
            </h2>
          </div>
        </div>
        <div className="flex min-w-0 flex-col items-center px-6 pt-11 pb-16 max-[600px]:px-5 max-[600px]:pt-5 max-[600px]:pb-12 [&_.cl-rootBox]:w-[min(400px,100%)] [&_.cl-cardBox]:w-full [&_.cl-cardBox]:rounded-panel [&_.cl-cardBox]:border [&_.cl-cardBox]:border-line [&_.cl-cardBox]:shadow-none">
          <Link
            to="/"
            className="inline-flex min-h-11 w-[min(400px,100%)] items-center gap-2.5 text-[13px] font-semibold underline-offset-4 hover:underline"
          >
            <ArrowLeft size={16} /> Back to Endorphins
          </Link>
          <div className="mt-6.5 mb-8 w-[min(400px,100%)] max-[600px]:my-6">
            <h1 className="font-display text-[clamp(36px,3.1vw,44px)] leading-[1.15] font-normal tracking-tight max-[600px]:text-[38px]">
              {signup ? 'Your next chapter.' : 'Good to see you.'}
            </h1>
            <p className="mt-3 text-sm leading-[1.8] text-muted">
              {signup
                ? 'Create an account. Find your rhythm.'
                : 'Sign in and pick up where you left off.'}
            </p>
          </div>
          {children}
          <p className="mt-6.5 flex items-center gap-[7px] text-xs text-muted">
            <Check size={15} /> Your workouts, saved in one place.
          </p>
        </div>
      </main>
    </div>
  )
}
