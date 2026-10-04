import type { ComponentProps, ReactNode } from 'react'
import { Search } from 'lucide-react'
import { cn } from './cn'

const control =
  'w-full min-w-0 min-h-12 rounded-control border border-line-strong bg-surface px-3 py-2.5 text-base leading-normal text-ink transition-colors duration-(--motion-standard) enabled:hover:border-ink aria-invalid:border-error disabled:cursor-not-allowed disabled:opacity-55'

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode
  htmlFor: string
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid min-w-0 gap-2', className)}>
      <label className="text-sm font-semibold" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs leading-[1.7] text-muted" id={`${htmlFor}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="text-xs leading-[1.7] text-error" id={`${htmlFor}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className={cn(control, 'placeholder:text-muted placeholder:opacity-100', className)}
    />
  )
}
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      {...props}
      className={cn(control, 'cursor-pointer [&_option]:bg-surface [&_option]:text-ink', className)}
    />
  )
}
export function SearchInput({
  wrapperClassName,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { wrapperClassName?: string }) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-muted focus-within:outline-3 focus-within:outline-offset-4 focus-within:outline-focus',
        wrapperClassName,
      )}
    >
      <Search size={18} aria-hidden="true" />
      <Input
        {...props}
        type="search"
        className={cn(
          'border-0 bg-transparent px-0 outline-none focus-visible:outline-none',
          className,
        )}
      />
    </div>
  )
}
export function RadioOption({
  children,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type' | 'children'> & { children: ReactNode }) {
  return (
    <label
      className={cn(
        'relative flex min-h-[58px] cursor-pointer items-center justify-center rounded-control border border-line-strong transition-colors duration-(--motion-standard) hover:border-ink hover:bg-background has-checked:border-ink has-checked:bg-ink has-checked:text-background has-focus-visible:outline-3 has-focus-visible:outline-offset-4 has-focus-visible:outline-focus has-disabled:cursor-not-allowed has-disabled:opacity-55',
        className,
      )}
    >
      <input
        {...props}
        type="radio"
        className="absolute inset-0 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      {children}
    </label>
  )
}
