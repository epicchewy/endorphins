import { SignIn } from '~/auth/client'
import { createFileRoute } from '@tanstack/react-router'
import { safeAppPath } from '~/services/app-navigation'
import { AuthPage } from '~/components/auth/auth-page'

export const Route = createFileRoute('/sign-in/$')({
  validateSearch: (search: Record<string, unknown>): { redirect_url?: string } => ({
    redirect_url:
      typeof search.redirect_url === 'string' ? safeAppPath(search.redirect_url) : undefined,
  }),
  component: Page,
})
function Page() {
  const search = Route.useSearch()
  return (
    <AuthPage>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl={search.redirect_url ?? '/app'}
      />
    </AuthPage>
  )
}
