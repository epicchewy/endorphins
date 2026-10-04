// The test route guard validates the fixture JWT against the real API.
import { createMiddleware } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

export const clerkMiddleware = () => createMiddleware().server(({ next }) => next())

export async function auth() {
  const token = getCookie('endorphins_test_session')
  if (!token) return { isAuthenticated: false, userId: null }
  const response = await fetch(`${process.env.API_ORIGIN}/api/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) return { isAuthenticated: false, userId: null }
  const user = await response.json()
  return { isAuthenticated: true, userId: user.clerkUserId }
}
