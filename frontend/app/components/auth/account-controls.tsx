import { useAuth, UserButton } from '~/auth/client'
import { Link } from '@tanstack/react-router'
import { buttonClassName } from '~/components/ui/button'

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
            to="/workouts"
            className="inline-flex min-h-11 items-center text-[13px] font-bold whitespace-nowrap hover:text-focus max-[600px]:text-xs"
          >
            My workouts
          </Link>
          <UserButton appearance={{ elements: { userButtonTrigger: { padding: '8px' } } }} />
        </>
      ) : (
        <>
          <Link
            to="/sign-in/$"
            params={{ _splat: '' }}
            className="inline-flex min-h-11 items-center text-[13px] font-bold whitespace-nowrap hover:text-focus max-[600px]:text-xs"
          >
            Sign in
          </Link>
          <Link
            to="/sign-up/$"
            params={{ _splat: '' }}
            className={buttonClassName({
              size: 'small',
              className: 'border-ink bg-ink text-background max-[600px]:hidden',
            })}
          >
            Get started
          </Link>
        </>
      )}
    </div>
  )
}
