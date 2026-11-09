import type { components } from '~/types/api.gen'

type ErrorEnvelope = components['schemas']['Error']
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

// The API writes the copy for failures it decides. These cover what only the
// browser can see: no session, no connection, or no usable API response.
const signedOut = 'Your session has ended. Please sign in again.'
const unavailable = 'Your workouts are unavailable just now. Please try again.'

function errorEnvelope(body: unknown): ErrorEnvelope | undefined {
  if (!body || typeof body !== 'object') return undefined
  const { message, code, requestId } = body as Record<string, unknown>
  if (typeof message !== 'string' || typeof code !== 'string' || typeof requestId !== 'string')
    return undefined
  return { message, code, requestId }
}

export async function request<T>(
  path: string,
  getToken: GetToken,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken()
  if (!token) throw new APIError(signedOut, 401, 'unauthenticated')
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
    const envelope = errorEnvelope(await response.json().catch(() => null))
    // Show the API's copy for request errors. A server or upstream failure gets generic
    // copy, so infrastructure details never reach the page.
    throw new APIError(
      envelope && response.status < 500 ? envelope.message : unavailable,
      response.status,
      envelope?.code,
      envelope?.requestId ?? response.headers.get('X-Request-ID') ?? undefined,
    )
  }
  return response.json()
}
