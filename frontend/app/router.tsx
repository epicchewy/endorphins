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
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
