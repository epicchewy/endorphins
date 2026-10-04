import { auth } from '~/auth/server'
import { setResponseHeader } from '@tanstack/react-start/server'
import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

export const requireUser = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  const { userId, isAuthenticated } = await auth()
  if (!isAuthenticated || !userId) throw redirect({ to: '/sign-in/$', params: { _splat: '' } })
})
