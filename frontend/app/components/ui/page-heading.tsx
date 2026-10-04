import type { ReactNode } from 'react'

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-10 flex items-end justify-between gap-6 max-[600px]:mb-7 max-[600px]:block print:hidden">
      <div>
        <h1 className="font-display text-[clamp(36px,3.9vw,56px)] font-normal leading-[1.12] tracking-[-0.025em] max-[900px]:text-[46px] max-[600px]:text-[clamp(36px,10vw,50px)]">
          {title}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.7] text-muted max-[600px]:text-[13px]">
          {description}
        </p>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2 max-[600px]:mt-6 max-[600px]:flex-wrap">
          {actions}
        </div>
      )}
    </header>
  )
}
