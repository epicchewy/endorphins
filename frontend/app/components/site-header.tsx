import { Link } from '@tanstack/react-router'
import { Brand } from './brand'
import { AccountControls } from './auth/account-controls'
import { ThemeControl } from './theme'

export function SiteHeader({ landing = false }: { landing?: boolean }) {
  return (
    <header className="mx-auto flex h-20 w-[min(calc(100%-var(--page-gutter)*2),var(--page-width))] items-center justify-between gap-6 border-b border-line max-[1150px]:gap-3 max-[600px]:h-18 max-[600px]:gap-1.5 print:hidden">
      <Brand />
      <nav
        aria-label="Main navigation"
        className="flex items-center gap-7 text-[13px] font-semibold max-[1150px]:gap-4.5 max-[900px]:hidden"
      >
        {landing ? (
          <a
            className="inline-flex min-h-11 items-center transition-colors duration-180 hover:text-focus"
            href="#builder"
          >
            Build a workout
          </a>
        ) : (
          <Link
            className="inline-flex min-h-11 items-center transition-colors duration-180 hover:text-focus"
            to="/"
            hash="builder"
          >
            Build a workout
          </Link>
        )}
        {landing && (
          <a
            className="inline-flex min-h-11 items-center transition-colors duration-180 hover:text-focus"
            href="#how-it-works"
          >
            How it works
          </a>
        )}
      </nav>
      <div className="flex items-center gap-4 max-[1150px]:gap-3 max-[600px]:gap-2 max-[360px]:gap-0.5">
        <ThemeControl className="max-[600px]:hidden" />
        <AccountControls />
      </div>
    </header>
  )
}
