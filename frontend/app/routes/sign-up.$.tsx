import { SignUp } from '~/auth/client'
import { createFileRoute } from '@tanstack/react-router'
import { safeAppPath } from '~/services/app-navigation'
import { AuthPage } from '~/components/auth/auth-page'

export const Route = createFileRoute('/sign-up/$')({
  validateSearch: (search: Record<string, unknown>): { redirect_url?: string } => ({
    redirect_url:
      typeof search.redirect_url === 'string' ? safeAppPath(search.redirect_url) : undefined,
  }),
  component: Page,
})
function Page() {
  const search = Route.useSearch()
  return (
    <AuthPage signup>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl={search.redirect_url ?? '/app/onboarding'}
      />
    </AuthPage>
  )
}
