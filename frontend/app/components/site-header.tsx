import { Brand } from './brand'
import { AccountControls } from './auth/account-controls'
import { ThemeControl } from './theme'
export function SiteHeader() {
  return (
    <header className="mx-auto flex h-20 w-[min(calc(100%-var(--page-gutter)*2),var(--page-width))] items-center justify-between gap-4 border-b border-line max-[600px]:h-18 print:hidden">
      <Brand />
      <a
        href="#how-it-works"
        className="mr-auto ml-8 inline-flex min-h-11 items-center text-sm font-medium max-[800px]:hidden"
      >
        How it works
      </a>
      <div className="flex items-center gap-3">
        <ThemeControl className="max-[600px]:hidden" />
        <AccountControls />
      </div>
    </header>
  )
}
