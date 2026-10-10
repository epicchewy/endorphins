import { randomUUID } from 'node:crypto'
import { test as base, expect, type Page } from '@playwright/test'

type Fixtures = {
  subject: string
  signedInPage: Page
  signIn: (subject: string) => Promise<void>
  seedLibrary: () => Promise<{ ids: string[] }>
}

export const test = base.extend<Fixtures>({
  subject: async ({}, use) => use(`browser_${randomUUID()}`),
  page: async ({ page, baseURL }, use) => {
    // All browser dependencies must be served by this run's local stack.
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url())
      return url.origin === baseURL || ['data:', 'blob:'].includes(url.protocol)
        ? route.continue()
        : route.abort('blockedbyclient')
    })
    await use(page)
  },
  signIn: async ({ page, request, baseURL }, use) => {
    await use(async (subject) => {
      const response = await request.get(`/api/__fixture/token?subject=${subject}`)
      expect(response.status()).toBe(200)
      const { token } = await response.json()
      const account = await request.patch('/api/v1/me', {
        headers: { Authorization: `Bearer ${token}` },
        data: { defaultLevel: 2, completeOnboarding: true },
      })
      expect(account.status()).toBe(200)
      await page.context().addCookies([
        {
          name: 'endorphins_test_session',
          value: encodeURIComponent(token),
          url: baseURL!,
          sameSite: 'Strict',
        },
      ])
      if (page.url().startsWith(baseURL!))
        await page.evaluate(() => window.dispatchEvent(new Event('endorphins:test-session')))
    })
  },
  signedInPage: async ({ page, subject, signIn }, use) => {
    await signIn(subject)
    await use(page)
  },
  seedLibrary: async ({ request, subject }, use) => {
    await use(async () => {
      const response = await request.post(`/api/__fixture/seed?subject=${subject}`)
      expect(response.status()).toBe(200)
      return response.json()
    })
  },
})

export { expect }
