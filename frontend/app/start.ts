import { clerkMiddleware } from '~/auth/server'
import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from '@sentry/tanstackstart-react'
import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

// Sentry's middleware comes first so it reports failures from the middleware after it.
export const startInstance = createStart(() => {
  return {
    requestMiddleware: [sentryGlobalRequestMiddleware, csrfMiddleware, clerkMiddleware()],
    functionMiddleware: [sentryGlobalFunctionMiddleware],
  }
})
