import type { ComponentProps } from 'react'
import { LoaderCircle } from 'lucide-react'
import { buttonClassName, type ButtonStyle } from './button-styles'

export function Button({
  variant,
  size,
  className,
  pending = false,
  disabled,
  type = 'button',
  children,
  ...props
}: ComponentProps<'button'> & ButtonStyle & { pending?: boolean }) {
  return (
    <button
      {...props}
      type={type}
      className={buttonClassName({ variant, size, className })}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {children}
      {pending && (
        <LoaderCircle
          className="animate-spin motion-reduce:animate-none"
          size={18}
          aria-hidden="true"
        />
      )}
    </button>
  )
}
