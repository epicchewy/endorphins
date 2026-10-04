import { SignUp } from '~/auth/client'
import { createFileRoute } from '@tanstack/react-router'
import { AuthPage } from '~/components/auth/auth-page'

export const Route = createFileRoute('/sign-up/$')({ component: Page })
function Page() {
  return (
    <AuthPage signup>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/" />
    </AuthPage>
  )
}
