import type { ReactNode } from 'react'
import { AlertCircle, LoaderCircle } from 'lucide-react'
import { Button } from './button'
import { cn } from './cn'

export function Feedback({
  title,
  children,
  tone = 'error',
  retry,
  retryLabel = 'Try again',
  id,
  className,
}: {
  title?: string
  children: ReactNode
  tone?: 'error' | 'info'
  retry?: () => void
  retryLabel?: string
  id?: string
  className?: string
}) {
  return (
    <div
      id={id}
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'my-4.5 flex items-start gap-3 rounded-control border p-4 text-sm leading-[1.7] print:hidden',
        tone === 'error'
          ? 'border-current bg-error-bg text-error'
          : 'border-line-strong bg-accent-soft text-ink',
        className,
      )}
    >
      {tone === 'error' && <AlertCircle className="mt-0.5" size={19} aria-hidden="true" />}
      <div className="min-w-0">
        {title && <strong className="mb-1 block">{title}</strong>}
        <div>{children}</div>
        {retry && (
          <Button size="small" className="mt-3" onClick={retry}>
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
const stateSurface =
  'flex flex-col items-center justify-center gap-4 rounded-panel border border-line bg-surface px-6 py-16 text-center max-[600px]:px-5 max-[600px]:py-12'
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn(stateSurface, className)}>
      <h3 className="text-2xl font-bold tracking-[-0.5px] max-[600px]:text-[22px]">{title}</h3>
      {children && <div className="max-w-[45ch] text-sm leading-[1.8] text-muted">{children}</div>}
      {action}
    </div>
  )
}
export function LoadingState({
  children = 'Loading…',
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <output
      className={cn(stateSurface, 'min-h-[180px] text-sm text-muted', className)}
      aria-live="polite"
      aria-atomic="true"
    >
      <LoaderCircle
        className="animate-spin motion-reduce:animate-none"
        size={22}
        aria-hidden="true"
      />
      <span>{children}</span>
    </output>
  )
}
