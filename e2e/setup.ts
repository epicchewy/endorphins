import assert from 'node:assert/strict'
import { startStack } from './harness/stack'

export default async function setup() {
  const stack = await startStack()
  process.env.PLAYWRIGHT_TEST_BASE_URL = stack.baseURL
  return async () => {
    try {
      // Stop the real upstream after all tests, then verify the production proxy.
      await stack.backend.stop({ timeout: 10_000 })
      const response = await fetch(`${stack.baseURL}/api/v1/workouts`, {
        signal: AbortSignal.timeout(20_000),
      })
      assert.equal(response.status, 503)
      const error = await response.json()
      assert.equal(error.code, 'service_unavailable')
      assert.equal(error.requestId, response.headers.get('x-request-id'))
      assert.equal(response.headers.get('cache-control'), 'no-store')
    } finally {
      await stack.stop()
    }
  }
}
