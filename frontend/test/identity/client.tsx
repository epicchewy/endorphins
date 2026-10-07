// External identity fixture, included only by `vite build --mode e2e`.
// Application requests still carry signed JWTs to the real Go verifier.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const cookieName = 'endorphins_test_session'
type Session = { id: string; user: { id: string }; getToken: () => Promise<string> }
const Identity = createContext<{ session: Session | null; isLoaded: boolean }>({
  session: null,
  isLoaded: false,
})

function readSession(): Session | null {
  const cookie = document.cookie.split('; ').find((part) => part.startsWith(`${cookieName}=`))
  if (!cookie) return null
  const token = decodeURIComponent(cookie.slice(cookieName.length + 1))
  try {
    const claims = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof claims.sub !== 'string' || typeof claims.sid !== 'string') return null
    return { id: claims.sid, user: { id: claims.sub }, getToken: async () => token }
  } catch {
    return null
  }
}

export function ClerkProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<{ session: Session | null; isLoaded: boolean }>({
    session: null,
    isLoaded: false,
  })
  useEffect(() => {
    const refresh = () => setIdentity({ session: readSession(), isLoaded: true })
    refresh()
    window.addEventListener('endorphins:test-session', refresh)
    return () => window.removeEventListener('endorphins:test-session', refresh)
  }, [])
  return <Identity.Provider value={identity}>{children}</Identity.Provider>
}

export function useSession() {
  return useContext(Identity)
}

export function useAuth() {
  const { session, isLoaded } = useSession()
  return {
    isLoaded,
    isSignedIn: Boolean(session),
    sessionId: session?.id,
    userId: session?.user.id,
  }
}

export function useClerk() {
  return {
    get session() {
      return readSession()
    },
    redirectToSignIn: ({ redirectUrl }: { redirectUrl: string }) => {
      window.location.assign(`/sign-in?returnTo=${encodeURIComponent(redirectUrl)}`)
    },
  }
}

export function UserButton() {
  return (
    <button
      type="button"
      className="account-link"
      onClick={() => {
        document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Strict`
        window.dispatchEvent(new Event('endorphins:test-session'))
        window.location.assign('/')
      }}
    >
      Sign out
    </button>
  )
}

export function SignIn({
  fallbackRedirectUrl = '/app',
  forceRedirectUrl,
}: {
  fallbackRedirectUrl?: string
  forceRedirectUrl?: string
}) {
  const [pending, setPending] = useState(false)
  const signIn = async () => {
    setPending(true)
    const response = await fetch(`/api/__fixture/token?subject=browser_${crypto.randomUUID()}`)
    if (!response.ok) throw new Error('Test identity service unavailable')
    const { token } = await response.json()
    document.cookie = `${cookieName}=${encodeURIComponent(token)}; Path=/; SameSite=Strict`
    const destination =
      forceRedirectUrl ??
      new URLSearchParams(window.location.search).get('redirect_url') ??
      new URLSearchParams(window.location.search).get('returnTo') ??
      fallbackRedirectUrl
    window.location.assign(
      destination.startsWith('/') && !destination.startsWith('//') ? destination : '/app',
    )
  }
  return (
    <button
      type="button"
      className="button primary"
      disabled={pending}
      onClick={() => void signIn()}
    >
      Continue with test identity
    </button>
  )
}

export const SignUp = SignIn
