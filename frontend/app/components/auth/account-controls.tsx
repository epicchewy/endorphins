import { useAuth, UserButton } from '~/auth/client'
import { Link } from '@tanstack/react-router'

export function AccountControls() {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded)
    return (
      <span
        className="block min-h-11 min-w-[154px] max-[600px]:min-w-[70px]"
        aria-label="Loading account"
      />
    )
  return (
    <div className="flex items-center gap-4 max-[1150px]:gap-3 max-[600px]:gap-2">
      {isSignedIn ? (
        <>
          <Link
            to="/app"
            className="inline-flex min-h-11 items-center text-[13px] font-bold whitespace-nowrap hover:text-focus max-[600px]:text-xs"
          >
            Dashboard
          </Link>
          <UserButton appearance={{ elements: { userButtonTrigger: { padding: '8px' } } }} />
        </>
      ) : (
        <Link
          to="/sign-in/$"
          params={{ _splat: '' }}
          className="inline-flex min-h-11 items-center text-[13px] font-bold whitespace-nowrap hover:text-focus max-[600px]:text-xs"
        >
          Sign in
        </Link>
      )}
    </div>
  )
}
