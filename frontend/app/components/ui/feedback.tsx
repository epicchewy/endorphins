import type { ReactNode } from 'react'
import { AlertCircle, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from './alert'
import { Button } from './button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from './empty'
import { Spinner } from './spinner'
import { cn } from '~/lib/utils'

// Errors announce as alerts and information as status. Recovery sits beside the message.
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
  const error = tone === 'error'
  return (
    <Alert
      id={id}
      role={error ? 'alert' : 'status'}
      variant={error ? 'destructive' : 'default'}
      className={cn('my-4.5 px-4 py-3 print:hidden', error && 'border-destructive/40', className)}
    >
      {error ? <AlertCircle aria-hidden="true" /> : <Info aria-hidden="true" />}
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>
        {children}
        {retry && (
          <Button size="sm" variant="outline" className="mt-3 flex" onClick={retry}>
            {retryLabel}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

const stateSurface = 'border bg-card py-16 max-[600px]:px-5 max-[600px]:py-12'
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
    <Empty className={cn(stateSurface, className)}>
      <EmptyHeader>
        <EmptyTitle>
          <h3 className="text-2xl font-bold max-[600px]:text-[22px]">{title}</h3>
        </EmptyTitle>
        {children && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
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
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'flex min-h-[180px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-6 text-sm text-muted-foreground',
        stateSurface,
        className,
      )}
    >
      <Spinner className="size-5" />
      <span>{children}</span>
    </output>
  )
}
