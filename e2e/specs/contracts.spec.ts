import { readFile } from 'node:fs/promises'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { test, expect } from '../fixtures'

const contract = JSON.parse(
  await readFile(new URL('../../api/openapi.json', import.meta.url), 'utf8'),
)
const ajv = new Ajv({ strict: false, allErrors: true })
addFormats(ajv)
ajv.addSchema(contract, 'endorphins')
function matches(name: string, value: unknown) {
  const validate = ajv.compile({
    $ref: `endorphins#/components/schemas/${name}`,
  })
  expect(validate(value), JSON.stringify(validate.errors)).toBe(true)
}

test('production proxy preserves API contracts, idempotency, errors and ownership', async ({
  request,
  subject,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'HTTP contract is independent of viewport')
  const identity = await request.get(`/api/__fixture/token?subject=${subject}`)
  const { token } = await identity.json()
  const headers = {
    Authorization: `Bearer ${token}`,
    'Idempotency-Key': crypto.randomUUID(),
  }
  const data = { durationMinutes: 45, level: 2 }
  const created = await request.post('/api/v1/workouts', { headers, data })
  expect(created.status()).toBe(201)
  expect(created.headers()['cache-control']).toBe('no-store')
  const saved = await created.json()
  matches('Workout', saved)
  expect(saved.warmupMinutes).toBe(5)
  expect(saved.estimatedMinutes).toBeLessThanOrEqual(45)
  expect(created.headers()['location']).toBe(`/api/v1/workouts/${saved.id}`)
  const replay = await request.post('/api/v1/workouts', { headers, data })
  expect(await replay.json()).toEqual(saved)
  const mismatch = await request.post('/api/v1/workouts', {
    headers,
    data: { durationMinutes: 60, level: 2 },
  })
  expect(mismatch.status()).toBe(409)
  matches('Error', await mismatch.json())
  const list = await request.get('/api/v1/workouts', { headers })
  const page = await list.json()
  matches('WorkoutPage', page)
  expect(page.items.map((item: { id: string }) => item.id)).toEqual([saved.id])
  const summary = await request.get('/api/v1/workouts/summary', { headers })
  matches('WorkoutSummary', await summary.json())
  expect((await summary.json()).count).toBe(1)
  const current = await request.get('/api/v1/me', { headers })
  matches('User', await current.json())
  const otherToken = (
    await (await request.get(`/api/__fixture/token?subject=other_${subject}`)).json()
  ).token
  const denied = await request.get(`/api/v1/workouts/${saved.id}`, {
    headers: { Authorization: `Bearer ${otherToken}` },
  })
  expect(denied.status()).toBe(404)
  const unauthorized = await request.get('/api/v1/workouts')
  expect(unauthorized.status()).toBe(401)
  const error = await unauthorized.json()
  matches('Error', error)
  expect(error.requestId).toBe(unauthorized.headers()['x-request-id'])
})

test('production static server preserves compression, HEAD and path isolation', async ({
  request,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'Static contract is independent of viewport')
  const html = await request.get('/')
  expect(html.headers()['cache-control']).toBe('private, no-store')
  const body = await html.text()
  const asset = body.match(/(?:src|href)="(\/assets\/[^"?]+\.(?:js|css))"/)?.[1]
  expect(asset).toBeDefined()
  const plain = await request.get(asset!, {
    headers: { 'Accept-Encoding': 'identity' },
  })
  const compressed = await request.get(asset!, {
    headers: { 'Accept-Encoding': 'gzip' },
  })
  expect(compressed.headers()['content-encoding']).toBe('gzip')
  expect(await compressed.body()).toEqual(await plain.body())
  const head = await request.head(asset!, {
    headers: { 'Accept-Encoding': 'gzip' },
  })
  expect(head.headers()['content-length']).toBe(compressed.headers()['content-length'])
  expect(await head.body()).toHaveLength(0)
  expect(
    (
      await request.get(asset!, {
        headers: { 'Accept-Encoding': 'gzip;q=0, identity;q=0' },
      })
    ).status(),
  ).toBe(406)
  expect((await request.get('/assets/%2e%2e/%2e%2e/package.json')).status()).toBe(404)
  expect((await request.get('/assets/missing.js')).status()).toBe(404)
})

test('verified account deletion crosses the production proxy and rejects stale sessions', async ({
  request,
  subject,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'HTTP contract is independent of viewport')
  const { token } = await (await request.get(`/api/__fixture/token?subject=${subject}`)).json()
  const authorization = { Authorization: `Bearer ${token}` }
  const saved = await request.post('/api/v1/workouts', {
    headers: authorization,
    data: { durationMinutes: 45, level: 2 },
  })
  expect(saved.status()).toBe(201)
  const event = await (
    await request.post(`/api/__fixture/deletion-event?subject=${subject}`)
  ).json()
  const tampered = await request.post('/api/webhooks/clerk', {
    headers: event.headers,
    data: event.body + ' ',
  })
  expect(tampered.status()).toBe(400)
  expect((await request.get('/api/v1/me', { headers: authorization })).status()).toBe(200)
  const deleted = await request.post('/api/webhooks/clerk', {
    headers: event.headers,
    data: event.body,
  })
  expect(deleted.status()).toBe(204)
  expect(
    (
      await request.post('/api/webhooks/clerk', {
        headers: event.headers,
        data: event.body,
      })
    ).status(),
  ).toBe(204)
  const stale = await request.get('/api/v1/me', { headers: authorization })
  expect(stale.status()).toBe(401)
  expect((await stale.json()).code).toBe('account_deleted')
})
