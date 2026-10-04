import { Button, buttonClassName } from '~/components/ui/button'
import { ClerkProvider } from '~/auth/client'
import type { ReactNode } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Link, Scripts } from '@tanstack/react-router'
import '@fontsource-variable/inter/standard.css'
import '~/app.css'
import { ThemeProvider } from '~/components/theme'
import { SessionBoundary } from '~/components/auth/session-boundary'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { title: 'Endorphins | Make your next move' },
      {
        name: 'description',
        content:
          'Full-body workouts that fit your time. Choose your level, build a plan, and keep every workout in one place.',
      },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'theme-color', content: '#F2F3F3' },
    ],
    links: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  }),
  shellComponent: Document,
  component: SessionBoundary,
  notFoundComponent: () => (
    <main className="mx-auto my-[10vh] max-w-[640px] px-6 py-20 text-center">
      <h1 className="font-display text-[clamp(40px,6vw,56px)] font-normal leading-[1.12] tracking-[-0.025em]">
        A little off track.
      </h1>
      <p className="my-6 leading-[1.8] text-muted">That page doesn’t exist.</p>
      <Link to="/" className={buttonClassName({ variant: 'primary' })}>
        Build a workout
      </Link>
    </main>
  ),
  errorComponent: ({ reset }) => (
    <main className="mx-auto my-[10vh] max-w-[640px] px-6 py-20 text-center">
      <h1 className="font-display text-[clamp(40px,6vw,56px)] font-normal leading-[1.12] tracking-[-0.025em]">
        Let’s take a breath.
      </h1>
      <p className="my-6 leading-[1.8] text-muted">Something went wrong loading this page.</p>
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
    </main>
  ),
})
function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
          afterSignOutUrl="/"
          appearance={{
            variables: {
              colorPrimary: 'var(--ink)',
              colorPrimaryForeground: 'var(--surface)',
              colorNeutral: 'var(--ink)',
              colorBackground: 'var(--surface)',
              colorInput: 'var(--surface)',
              colorInputForeground: 'var(--ink)',
              colorDanger: 'var(--error)',
              colorRing: 'var(--focus)',
              colorForeground: 'var(--ink)',
              colorMutedForeground: 'var(--muted)',
              fontFamily: "'Inter Variable', sans-serif",
              borderRadius: '8px',
            },
          }}
        >
          <ThemeProvider>{children}</ThemeProvider>
          <Scripts />
        </ClerkProvider>
      </body>
    </html>
  )
}
