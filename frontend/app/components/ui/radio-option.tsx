import type { ComponentProps, ReactNode } from 'react'
import { cn } from '~/lib/utils'

// A native radio drawn as a choice chip. shadcn has no native radio card, and the native
// input keeps arrow-key selection and form validation. Group chips in a FieldSet.
export function RadioOption({
  children,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type' | 'children'> & { children: ReactNode }) {
  return (
    <label
      className={cn(
        'relative flex min-h-14 cursor-pointer items-center justify-center rounded-lg border border-input transition-colors not-has-checked:hover:bg-muted has-checked:border-foreground has-checked:bg-foreground has-checked:text-background has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:opacity-50',
        className,
      )}
    >
      <input
        {...props}
        type="radio"
        className="absolute inset-0 m-0 size-full cursor-pointer opacity-0 outline-none disabled:cursor-not-allowed"
      />
      {children}
    </label>
  )
}
