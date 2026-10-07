import { Brand } from './brand'
import { ThemeControl } from './theme'

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-[min(calc(100%-var(--page-gutter)*2),var(--page-width))] items-center justify-between gap-6 border-t border-line py-7 max-[600px]:flex-wrap max-[600px]:gap-x-5 max-[600px]:gap-y-3 max-[600px]:py-5 print:hidden">
      <Brand
        className="text-[22px] max-[600px]:text-xl"
        markClassName="size-6 max-[600px]:size-6"
      />
      <p className="text-xs text-muted max-[600px]:order-3 max-[600px]:w-full">
        Home workouts. No equipment.
      </p>
      <div className="hidden max-[600px]:block">
        <ThemeControl compact={false} />
      </div>
      <a
        className="inline-flex min-h-11 items-center text-xs text-muted hover:text-focus"
        href="#top"
      >
        Back to top ↑
      </a>
    </footer>
  )
}
