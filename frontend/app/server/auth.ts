import { auth } from '~/auth/server'
import { setResponseHeader } from '@tanstack/react-start/server'
import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

import { safeAppPath } from '~/services/app-navigation'

export const requireUser = createServerFn({ method: 'GET' })
  .validator((value: unknown) => safeAppPath(value))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const { userId, isAuthenticated } = await auth()
    if (!isAuthenticated || !userId)
      throw redirect({ to: '/sign-in/$', params: { _splat: '' }, search: { redirect_url: data } })
  })
