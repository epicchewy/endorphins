// Return paths stay inside the authenticated application.
export function safeAppPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/app'
  try {
    const url = new URL(value, 'https://endorphins.invalid')
    if (
      url.pathname === '/account' ||
      url.pathname === '/workouts' ||
      url.pathname.startsWith('/workouts/')
    )
      url.pathname = '/app' + url.pathname
    if (
      url.origin !== 'https://endorphins.invalid' ||
      (url.pathname !== '/app' && !url.pathname.startsWith('/app/')) ||
      url.pathname.replace(/\/+$/, '') === '/app/onboarding'
    )
      return '/app'
    return url.pathname + url.search + url.hash
  } catch {
    return '/app'
  }
}
