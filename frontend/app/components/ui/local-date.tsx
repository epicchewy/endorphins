import { ClientOnly } from '@tanstack/react-router'

// Keep the first render stable, then use the reader's locale and time zone.
export function LocalDate({
  value,
  month = 'short',
  year,
  className,
}: {
  value: string
  month?: 'short' | 'long'
  year?: 'numeric'
  className?: string
}) {
  return (
    <time dateTime={value} className={className}>
      <ClientOnly fallback={value.slice(0, 10)}>
        {new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString(undefined, {
          month,
          day: 'numeric',
          year,
        })}
      </ClientOnly>
    </time>
  )
}
