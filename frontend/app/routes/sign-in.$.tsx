import { SignIn } from '~/auth/client'
import { createFileRoute } from '@tanstack/react-router'
import { AuthPage } from '~/components/auth/auth-page'

export const Route = createFileRoute('/sign-in/$')({ component: Page })
function Page() {
  return (
    <AuthPage>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
    </AuthPage>
  )
}
