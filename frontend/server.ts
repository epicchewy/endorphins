import { realpath } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

const clientDir = resolve(import.meta.dir, 'build/client')
const clientRoot = await realpath(clientDir)
// Assets are immutable for the process lifetime; compress once, not on every request.
const compressedAssets = new Map<string, Uint8Array<ArrayBuffer>>()
for await (const asset of new Bun.Glob('assets/**/*.{js,css}').scan(clientRoot)) {
  const path = await realpath(resolve(clientRoot, asset))
  if (path.startsWith(clientRoot + sep)) {
    compressedAssets.set(path, Bun.gzipSync(await Bun.file(path).arrayBuffer()))
  }
}
const { default: handler } = await import(new URL('./build/server/server.js', import.meta.url).href)
const origin = process.env.API_ORIGIN ?? 'http://127.0.0.1:8088'
if (!URL.canParse(origin)) throw new Error('API_ORIGIN must be a valid URL')
const apiOrigin = new URL(origin)
if (!['http:', 'https:'].includes(apiOrigin.protocol))
  throw new Error('API_ORIGIN must use HTTP or HTTPS')
const server = Bun.serve({
  hostname: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 3100),
  // Let the 15-second upstream deadline return its 503 before closing the socket.
  idleTimeout: 30,
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      const requestId = crypto.randomUUID()
      try {
        return await fetch(new URL(url.pathname + url.search, apiOrigin), {
          method: request.method,
          headers: {
            'Content-Type': request.headers.get('content-type') ?? 'application/json',
            'X-Request-ID': requestId,
            ...Object.fromEntries(
              ['svix-id', 'svix-timestamp', 'svix-signature', 'idempotency-key', 'authorization']
                .filter((name) => request.headers.has(name))
                .map((name) => [name, request.headers.get(name)!]),
            ),
          },
          body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
          redirect: 'manual',
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
        })
      } catch {
        return Response.json(
          { message: 'Workout generator unavailable.', code: 'service_unavailable', requestId },
          { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Request-ID': requestId } },
        )
      }
    }
    if (
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/images/') ||
      url.pathname === '/favicon.svg'
    ) {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 })
      let path: string
      try {
        path = await realpath(resolve(clientDir, '.' + decodeURIComponent(url.pathname)))
      } catch {
        return new Response(null, { status: 404 })
      }
      if (!path.startsWith(clientRoot + sep)) return new Response(null, { status: 404 })
      const file = Bun.file(path)
      const encodings = new Map(
        (request.headers.get('accept-encoding') ?? '').split(',').map((entry) => {
          const [name, ...parameters] = entry.toLowerCase().split(';')
          const quality = parameters.find((parameter) => parameter.trim().startsWith('q='))
          const weight = quality === undefined ? 1 : Number(quality.trim().slice(2))
          return [name.trim(), Number.isFinite(weight) && weight >= 0 && weight <= 1 ? weight : 0]
        }),
      )
      const gzipQuality = encodings.get('gzip') ?? encodings.get('*') ?? 0
      const identityQuality = encodings.get('identity') ?? (encodings.get('*') === 0 ? 0 : 1)
      const compressed =
        gzipQuality > 0 && gzipQuality >= (encodings.get('identity') ?? 0)
          ? compressedAssets.get(path)
          : undefined
      const headers = new Headers({
        'Content-Type': file.type,
        Vary: 'Accept-Encoding',
        'Cache-Control': url.pathname.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=3600',
      })
      if (!compressed && identityQuality === 0) {
        return new Response(null, { status: 406, headers: { Vary: 'Accept-Encoding' } })
      }
      if (compressed) headers.set('Content-Encoding', 'gzip')
      headers.set('Content-Length', String(compressed?.byteLength ?? file.size))
      return new Response(request.method === 'HEAD' ? null : (compressed ?? file), {
        headers,
      })
    }
    const response = await handler.fetch(request)
    const privateResponse = new Response(response.body, response)
    privateResponse.headers.set('Cache-Control', 'private, no-store')
    return privateResponse
  },
})
console.log(`Endorphins is available at ${server.url}`)
