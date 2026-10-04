import { Link } from '@tanstack/react-router'
import { cn } from './ui/cn'

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M20 4v9m0 14v9M4 20h9m14 0h9M8.7 8.7l6.4 6.4m9.8 9.8 6.4 6.4m0-22.6-6.4 6.4m-9.8 9.8-6.4 6.4"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="20" cy="20" r="3" fill="currentColor" />
    </svg>
  )
}
export function Brand({
  className,
  markClassName,
}: { className?: string; markClassName?: string } = {}) {
  return (
    <Link
      to="/"
      className={cn(
        'inline-flex min-h-11 items-center gap-[9px] text-[25px] leading-none font-extrabold tracking-[-1.2px] whitespace-nowrap max-[600px]:gap-1.5 max-[600px]:text-[23px] max-[360px]:text-xl',
        className,
      )}
      aria-label="Endorphins home"
    >
      <BrandMark
        className={cn(
          'size-[29px] text-accent max-[600px]:size-[25px] max-[360px]:w-[21px]',
          markClassName,
        )}
      />
      <span>
        endorphins<span className="text-accent">.</span>
      </span>
    </Link>
  )
}
