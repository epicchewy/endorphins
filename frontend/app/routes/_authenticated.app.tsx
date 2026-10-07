import { useEffect } from 'react'
import { createFileRoute, Outlet, useRouter } from '@tanstack/react-router'
import { useAccount } from '~/hooks/use-account'
import { AppHeader } from '~/components/app-header'
import { LoadingState, Feedback } from '~/components/ui/feedback'
import { SkipLink } from '~/components/ui/skip-link'
import { safeAppPath } from '~/services/app-navigation'

export const Route = createFileRoute('/_authenticated/app')({ component: App })
function App() {
  const account = useAccount()
  const router = useRouter()
  const navigate = Route.useNavigate()
  useEffect(() => {
    if (account.data && !account.data.onboardingCompletedAt)
      void navigate({
        to: '/app/onboarding',
        search: { next: safeAppPath(router.state.location.href) },
        replace: true,
      })
  }, [account.data, navigate, router])
  return (
    <>
      <SkipLink href="#app-content" />
      <AppHeader />
      <main
        id="app-content"
        className="mx-auto w-[min(calc(100%-var(--page-gutter)*2),var(--page-width))] py-10 max-[600px]:py-7 print:w-full print:p-0"
      >
        {account.isPending ? (
          <LoadingState>Opening your account…</LoadingState>
        ) : account.isError ? (
          <Feedback retry={() => void account.refetch()}>{account.error.message}</Feedback>
        ) : !account.data.onboardingCompletedAt ? (
          <LoadingState>Opening your welcome…</LoadingState>
        ) : (
          <Outlet />
        )}
      </main>
    </>
  )
}
