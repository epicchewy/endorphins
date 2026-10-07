import type { ReactNode } from 'react'
import { Brand } from '~/components/brand'
import { ThemeControl } from '~/components/theme'
import { ArrowLeft, Check } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { SkipLink } from '~/components/ui/skip-link'

export function AuthPage({ children, signup = false }: { children: ReactNode; signup?: boolean }) {
  return (
    <div className="min-h-svh">
      <SkipLink href="#auth-content" />
      <header className="flex h-20 items-center justify-between border-b border-line px-(--page-gutter) max-[600px]:h-18">
        <Brand />
        <ThemeControl />
      </header>
      <main
        id="auth-content"
        className="min-h-[calc(100svh-80px)] max-[600px]:min-h-[calc(100svh-72px)]"
      >
        <div className="flex min-w-0 flex-col items-center px-6 pt-11 pb-16 max-[600px]:px-5 max-[600px]:pt-5 max-[600px]:pb-12 [&_.cl-rootBox]:w-[min(400px,100%)] [&_.cl-cardBox]:w-full [&_.cl-cardBox]:rounded-panel [&_.cl-cardBox]:border [&_.cl-cardBox]:border-line [&_.cl-cardBox]:shadow-none">
          <Link
            to="/"
            className="inline-flex min-h-11 w-[min(400px,100%)] items-center gap-2.5 text-[13px] font-semibold underline-offset-4 hover:underline"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back to Endorphins
          </Link>
          <div className="mt-6.5 mb-8 w-[min(400px,100%)] max-[600px]:my-6">
            <h1 className="font-display text-[clamp(36px,3.1vw,44px)] leading-[1.15] font-normal tracking-tight max-[600px]:text-[38px]">
              {signup ? 'Create your account.' : 'Welcome back.'}
            </h1>
            <p className="mt-3 text-sm leading-[1.8] text-muted">
              {signup
                ? 'Save your home workouts and track your progress.'
                : 'Sign in and pick up where you left off.'}
            </p>
          </div>
          {children}
          <p className="mt-6.5 flex items-center gap-[7px] text-xs text-muted">
            <Check size={15} aria-hidden="true" /> Your workouts, saved in one place.
          </p>
        </div>
      </main>
    </div>
  )
}
