import type { ReactNode } from 'react'

export function SkipLink({
  href,
  children = 'Skip to content',
}: {
  href: string
  children?: ReactNode
}) {
  return (
    <a
      href={href}
      className="pointer-events-none fixed top-3 left-3 z-100 rounded-control bg-ink px-5 py-3.5 text-surface [clip-path:inset(50%)] focus:pointer-events-auto focus:[clip-path:none] print:hidden"
    >
      {children}
    </a>
  )
}
