import { Button as ButtonPrimitive } from '@base-ui/react/button'
import type { VariantProps } from 'class-variance-authority'
import { buttonVariants } from '~/components/ui/button-variants'
import { cn } from '~/lib/utils'
import { Spinner } from '~/components/ui/spinner'

// `pending` disables the button and adds a spinner, so an action cannot be sent twice.
function Button({
  className,
  variant = 'default',
  size = 'default',
  pending = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { pending?: boolean }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {children}
      {pending && <Spinner />}
    </ButtonPrimitive>
  )
}

export { Button }
