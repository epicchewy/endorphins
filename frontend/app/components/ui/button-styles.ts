import { cn } from './cn'

export type ButtonStyle = {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'default' | 'small' | 'icon'
  className?: string
}

const variants = {
  primary:
    'border-accent bg-accent text-accent-ink not-disabled:hover:-translate-y-0.5 not-disabled:hover:border-accent-hover not-disabled:hover:bg-accent-hover',
  secondary:
    'border-line-strong bg-surface text-ink not-disabled:hover:border-ink not-disabled:hover:bg-surface-raised',
  ghost: 'border-transparent bg-transparent text-ink not-disabled:hover:bg-surface-raised',
}
const sizes = {
  default: 'min-h-12 px-5 py-3',
  small: 'min-h-11 px-3.5 py-2',
  icon: 'size-12 p-0',
}

export function buttonClassName({
  variant = 'secondary',
  size = 'default',
  className,
}: ButtonStyle = {}) {
  return cn(
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-control border text-center text-sm leading-normal font-bold no-underline transition-[background,border-color,transform] duration-(--motion-standard) ease-standard not-disabled:active:translate-y-0 not-disabled:active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress',
    variants[variant],
    sizes[size],
    className,
  )
}
