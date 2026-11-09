import * as Sentry from '@sentry/tanstackstart-react'
import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'
import { APIError } from './services/http'

// One more read attempt, except for a request the API rejected: it would fail again.
function retryQuery(count: number, error: Error) {
  return !(error instanceof APIError && error.status >= 400 && error.status < 500) && count < 1
}

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: retryQuery },
      // Writes report connectivity failures at once and never repeat on their own.
      // A manual retry reuses the idempotency key its hook holds.
      mutations: { networkMode: 'always', retry: false },
    },
  })
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    // Route error boundaries catch render errors before Sentry's global handlers see them.
    defaultOnCatch: (error) => Sentry.captureException(error),
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  // Without a DSN (local dev, e2e builds) Sentry stays off and sends nothing.
  if (!router.isServer && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
      tracesSampleRate: 0.1,
    })
  }
  return router
}
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
