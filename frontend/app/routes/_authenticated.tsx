import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useAuth } from '~/auth/client'
import { Link } from '@tanstack/react-router'
import { SkipLink } from '~/components/ui/skip-link'
import { SiteHeader } from '~/components/site-header'
import { SiteFooter } from '~/components/site-footer'
import { requireUser } from '~/server/auth'

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: () => requireUser(),
  component: AccountLayout,
})
function AccountLayout() {
  const { isLoaded, isSignedIn } = useAuth()
  return (
    <div className="w-full" id="top">
      <SkipLink href="#account-content" />
      <SiteHeader />
      <main
        id="account-content"
        className="mx-auto min-h-[calc(100svh-190px)] w-[min(calc(100%-var(--page-gutter)*2),var(--page-width))] pt-16 pb-20 [--library-summary-height:290px] max-[900px]:[--library-summary-height:550px] max-[600px]:pt-9 max-[600px]:pb-12 print:m-0 print:block print:w-full print:max-w-none print:p-0"
      >
        {!isLoaded ? (
          <output>Loading your account…</output>
        ) : !isSignedIn ? (
          <p>
            Your session has ended.{' '}
            <Link to="/sign-in/$" params={{ _splat: '' }}>
              Sign in again
            </Link>
            .
          </p>
        ) : (
          <Outlet />
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
