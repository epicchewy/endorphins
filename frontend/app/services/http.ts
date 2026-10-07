export type GetToken = () => Promise<string | null>

export class APIError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = 'unavailable',
    readonly requestId?: string,
  ) {
    super(message)
    this.name = 'APIError'
  }
}

function errorMessage(status: number, code?: string) {
  if (code === 'account_deleted')
    return 'This account has been deleted. Sign in with another account.'
  if (code === 'invalid_level') return 'Choose a level from 1 to 5.'
  if (code === 'invalid_timezone') return 'Your time zone could not be used. Reload and try again.'
  if (code === 'completion_undone')
    return 'This completion was undone. Open the finish screen again to record a new workout.'
  if (code === 'invalid_page') return 'These filters couldn’t be used. Clear them and try again.'
  if (code === 'idempotency_conflict')
    return 'This request was already used for another workout. Start a new attempt.'
  if (status === 401) return 'Your session has ended. Please sign in again.'
  if (status === 404) return 'This workout couldn’t be found in your account.'
  if (status === 422) return 'Choose 30-120 minutes and a level from 1 to 5.'
  if (status === 400) return 'Check your selections and try again.'
  return 'Your workouts are unavailable just now. Please try again.'
}

export async function request<T>(
  path: string,
  getToken: GetToken,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken()
  if (!token) throw new APIError(errorMessage(401), 401, 'unauthenticated')
  let response: Response
  try {
    const headers = new Headers(options.headers)
    headers.set('Content-Type', 'application/json')
    headers.set('Authorization', `Bearer ${token}`)
    response = await fetch(path, {
      ...options,
      headers,
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
    })
  } catch {
    throw new Error('We couldn’t reach your workouts. Check your connection and try again.')
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const code =
      body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
        ? body.code
        : 'unavailable'
    const requestId =
      body && typeof body === 'object' && 'requestId' in body && typeof body.requestId === 'string'
        ? body.requestId
        : (response.headers.get('X-Request-ID') ?? undefined)
    // Never display arbitrary infrastructure details from a failed upstream.
    throw new APIError(errorMessage(response.status, code), response.status, code, requestId)
  }
  return response.json()
}
