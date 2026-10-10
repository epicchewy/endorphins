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
  authorization,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'HTTP contract is independent of viewport')
  const headers = { ...authorization, 'Idempotency-Key': crypto.randomUUID() }
  const data = { durationMinutes: 45, level: 2 }
  const created = await request.post('/api/v1/workouts', { headers, data })
  expect(created.status()).toBe(201)
  expect(created.headers()['cache-control']).toBe('no-store')
  const saved = await created.json()
  matches('Workout', saved)
  expect(saved.warmupMinutes).toBe(5)
  expect(saved.estimatedMinutes).toBeLessThanOrEqual(45)
  expect(saved.blocks).toHaveLength(3)
  expect(created.headers()['location']).toBe(`/api/v1/workouts/${saved.id}`)
  for (const [body, status, contentType = 'application/json'] of [
    ['{"durationMinutes":10,"level":2}', 422],
    ['{"durationMinutes":30,"level":6}', 422],
    ['{"durationMinutes":30,"level":2,"admin":true}', 400],
    ['{"durationMinutes":30,"level":2} {}', 400],
    ['{', 400],
    ['null', 422],
    ['{"durationMinutes":30.5,"level":2}', 400],
    ['{}', 415, 'text/plain'],
    [JSON.stringify({ ...data, padding: 'x'.repeat(9000) }), 400],
  ] as const) {
    const invalid = await request.post('/api/v1/workouts', {
      headers: { ...headers, 'Content-Type': contentType },
      data: body,
    })
    expect(invalid.status(), body.slice(0, 80)).toBe(status)
    matches('Error', await invalid.json())
  }
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
  authorization,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'HTTP contract is independent of viewport')
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

test('preferences and completion contracts separate plans, repeats, retries and undo', async ({
  request,
  subject,
  authorization,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'HTTP contract is independent of viewport')
  const updated = await request.patch('/api/v1/me', {
    headers: authorization,
    data: { defaultLevel: 4, completeOnboarding: true },
  })
  expect(updated.status()).toBe(200)
  const user = await updated.json()
  matches('User', user)
  expect(user.defaultLevel).toBe(4)
  expect(user.onboardingCompletedAt).not.toBeNull()
  for (const data of [
    { defaultLevel: 0 },
    { defaultLevel: 6 },
    { defaultLevel: 2, userId: 'someone-else' },
  ]) {
    const invalid = await request.patch('/api/v1/me', { headers: authorization, data })
    expect([400, 422]).toContain(invalid.status())
    matches('Error', await invalid.json())
  }
  const saved = await (
    await request.post('/api/v1/workouts', {
      headers: authorization,
      data: { durationMinutes: 30, level: 1 },
    })
  ).json()
  const headers = { ...authorization, 'Idempotency-Key': 'first-completion' }
  const url = `/api/v1/workouts/${saved.id}/completions`
  const completed = await request.post(url, { headers })
  expect(completed.status()).toBe(201)
  const first = await completed.json()
  matches('Completion', first)
  expect(await (await request.post(url, { headers })).json()).toEqual(first)
  const other = (await (await request.get(`/api/__fixture/token?subject=other_${subject}`)).json())
    .token
  expect(
    (
      await request.post(url, {
        headers: { Authorization: `Bearer ${other}`, 'Idempotency-Key': 'denied' },
      })
    ).status(),
  ).toBe(404)
  expect(
    (
      await request.delete(`/api/v1/completions/${first.id}`, {
        headers: { Authorization: `Bearer ${other}` },
      })
    ).status(),
  ).toBe(404)
  const repeated = await request.post(url, {
    headers: { ...authorization, 'Idempotency-Key': 'second-completion' },
  })
  expect(repeated.status()).toBe(201)
  const activity = await request.get('/api/v1/activity?timezone=America%2FNew_York', {
    headers: authorization,
  })
  const totals = await activity.json()
  matches('Activity', totals)
  expect(totals.completedCount).toBe(2)
  expect(totals.activeDaysThisWeek).toBe(1)
  const undone = await request.delete(`/api/v1/completions/${first.id}`, { headers: authorization })
  matches('UndoCompletion', await undone.json())
  expect((await request.post(url, { headers })).status()).toBe(409)
  const latest = await request.get('/api/v1/activity?timezone=UTC', { headers: authorization })
  expect((await latest.json()).completedCount).toBe(1)
  expect(
    (await request.get('/api/v1/activity?timezone=invalid', { headers: authorization })).status(),
  ).toBe(400)
  const exported = await request.get('/api/v1/me/export', { headers: authorization })
  const data = await exported.json()
  matches('AccountExport', data)
  expect(data.workouts).toHaveLength(1)
  expect(data.completions).toHaveLength(2)
})
