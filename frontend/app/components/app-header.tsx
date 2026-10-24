import { Link } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { UserButton } from '~/auth/client'
import { Brand } from './brand'
import { ThemeControl } from './theme'

export function AppHeader({ onboarding = false }: { onboarding?: boolean }) {
  return (
    <header className="border-b border-border print:hidden">
      <div className="mx-auto flex w-[min(calc(100%-var(--page-gutter)*2),var(--page-width))] flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4">
        <Brand app />
        <div className="flex items-center gap-3 min-[700px]:order-last min-[700px]:ml-auto">
          <ThemeControl />
          <UserButton appearance={{ elements: { userButtonTrigger: { padding: '8px' } } }}>
            <UserButton.MenuItems>
              <UserButton.Link
                label="Settings"
                labelIcon={<Settings size={16} aria-hidden="true" />}
                href="/app/account"
              />
            </UserButton.MenuItems>
          </UserButton>
        </div>
        {!onboarding && (
          <nav
            aria-label="App navigation"
            className="order-last flex w-full gap-6 text-sm font-medium min-[700px]:order-none min-[700px]:mr-auto min-[700px]:w-auto"
          >
            {[
              { to: '/app', label: 'Dashboard' },
              { to: '/app/workouts', label: 'Saved workouts' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to !== '/app/workouts' }}
                activeProps={{ className: 'text-emphasis border-emphasis' }}
                className="inline-flex min-h-11 items-center border-b-2 border-transparent hover:text-emphasis"
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
