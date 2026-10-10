import { Button } from '~/components/ui/button'
import { buttonClassName } from '~/components/ui/button-styles'
import { ClerkProvider } from '~/auth/client'
import type { ReactNode } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Link, Scripts } from '@tanstack/react-router'
import '@fontsource-variable/inter/standard.css'
import '~/app.css'
import sharpSerif from '~/assets/fonts/sharp-serif-text-pdf-preview-regular.woff2?url'
import inter from '@fontsource-variable/inter/files/inter-latin-standard-normal.woff2?url'
import { ThemeProvider, themeScript } from '~/components/theme'
import { SessionBoundary } from '~/components/auth/session-boundary'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { title: 'Endorphins | Work out at home' },
      {
        name: 'description',
        content:
          'Home workouts with no equipment. Choose your time and level, save your plan, and track completed workouts.',
      },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      {
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        href: sharpSerif,
        crossOrigin: 'anonymous',
      },
      { rel: 'preload', as: 'font', type: 'font/woff2', href: inter, crossOrigin: 'anonymous' },
    ],
  }),
  shellComponent: Document,
  component: SessionBoundary,
  notFoundComponent: () => (
    <main className="mx-auto my-[10vh] max-w-[640px] px-6 py-20 text-center">
      <h1 className="font-display text-[clamp(40px,6vw,56px)] font-normal leading-[1.12] tracking-[-0.025em]">
        Page not found
      </h1>
      <p className="my-6 leading-[1.8] text-muted">That page doesn’t exist.</p>
      <Link to="/" className={buttonClassName({ variant: 'primary' })}>
        Go home
      </Link>
    </main>
  ),
  errorComponent: ({ reset }) => (
    <main className="mx-auto my-[10vh] max-w-[640px] px-6 py-20 text-center">
      <h1 className="font-display text-[clamp(40px,6vw,56px)] font-normal leading-[1.12] tracking-[-0.025em]">
        Could not load this page
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/app"
          signUpFallbackRedirectUrl="/app/onboarding"
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
