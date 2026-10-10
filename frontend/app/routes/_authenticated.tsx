import { createFileRoute, Outlet, Link } from '@tanstack/react-router'
import { useAuth } from '~/auth/client'
import { LoadingState } from '~/components/ui/feedback'
import { requireUser } from '~/server/auth'

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  head: () => ({ meta: [{ name: 'robots', content: 'noindex' }] }),
  // The server checks entry. SessionBoundary and the API protect later session changes.
  // Search edits must not wait for another auth round trip on each key press.
  beforeLoad: ({ location, cause }) =>
    cause === 'stay' ? undefined : requireUser({ data: location.href }),
  component: Authenticated,
})
function Authenticated() {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) return <LoadingState>Loading your account…</LoadingState>
  if (!isSignedIn)
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        Your session has ended.{' '}
        <Link to="/sign-in/$" params={{ _splat: '' }}>
          Sign in again
        </Link>
        .
      </main>
    )
  return <Outlet />
}
