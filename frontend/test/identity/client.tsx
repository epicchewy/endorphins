// External identity fixture, included only by `vite build --mode e2e`.
// Application requests still carry signed JWTs to the real Go verifier.
import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from 'react'

const cookieName = 'endorphins_test_session'
type Session = { id: string; user: { id: string }; getToken: () => Promise<string> }
const Identity = createContext<{ session: Session | null; isLoaded: boolean }>({
  session: null,
  isLoaded: false,
})

function readToken() {
  const cookie = document.cookie.split('; ').find((part) => part.startsWith(`${cookieName}=`))
  return cookie ? cookie.slice(cookieName.length + 1) : ''
}

function parseSession(encodedToken: string): Session | null {
  if (!encodedToken) return null
  try {
    const token = decodeURIComponent(encodedToken)
    const claims = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof claims.sub !== 'string' || typeof claims.sid !== 'string') return null
    return { id: claims.sid, user: { id: claims.sub }, getToken: async () => token }
  } catch {
    return null
  }
}

function subscribe(listener: () => void) {
  window.addEventListener('endorphins:test-session', listener)
  return () => window.removeEventListener('endorphins:test-session', listener)
}

export function ClerkProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribe, readToken, () => undefined)
  const identity = useMemo(
    () => ({
      session: token ? parseSession(token) : null,
      isLoaded: token !== undefined,
    }),
    [token],
  )
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
      return parseSession(readToken())
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
  const [pending, startTransition] = useTransition()
  const signIn = async () => {
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
      onClick={() => startTransition(signIn)}
    >
      Continue with test identity
    </button>
  )
}

export const SignUp = SignIn
