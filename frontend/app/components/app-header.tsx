import { Link } from '@tanstack/react-router'
import { UserButton } from '~/auth/client'
import { Brand } from './brand'
import { ThemeControl } from './theme'

export function AppHeader({ onboarding = false }: { onboarding?: boolean }) {
  return (
    <header className="border-b border-line print:hidden">
      <div className="mx-auto flex w-[min(calc(100%-var(--page-gutter)*2),var(--page-width))] flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4">
        <Brand app />
        <div className="flex items-center gap-3 min-[700px]:order-last min-[700px]:ml-auto">
          <ThemeControl />
          <UserButton appearance={{ elements: { userButtonTrigger: { padding: '8px' } } }} />
        </div>
        {!onboarding && (
          <nav
            aria-label="App navigation"
            className="order-last flex w-full gap-6 text-sm font-medium min-[700px]:order-none min-[700px]:mr-auto min-[700px]:w-auto"
          >
            {[
              { to: '/app', label: 'Dashboard' },
              { to: '/app/workouts', label: 'Saved workouts' },
              { to: '/app/account', label: 'Account' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to !== '/app/workouts' }}
                activeProps={{ className: 'text-focus border-focus' }}
                className="inline-flex min-h-11 items-center border-b-2 border-transparent hover:text-focus"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}
