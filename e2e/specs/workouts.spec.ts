import { test, expect } from '../fixtures'

test.use({ locale: 'en-GB', timezoneId: 'America/Los_Angeles' })

test('generates, saves, reopens, and follows a workout', async ({ signedInPage: page }) => {
  await page.goto('/app/new')
  await page.getByRole('radio', { name: '60min', exact: true }).check()
  await page.getByRole('radio', { name: 'Level 3: Lively' }).check()
  await expect(page).toHaveURL(
    (url) => url.searchParams.get('minutes') === '60' && url.searchParams.get('level') === '3',
  )
  await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Full-body workout' })).toBeVisible()
  await expect(page.getByText('Level 3 · Full body', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'A little warm-up first' })).toBeVisible()
  await page.getByRole('button', { name: 'Exercise view', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '1')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '2')
  await page.getByRole('button', { name: 'Previous', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '1')
  await page.getByRole('link', { name: 'Saved workouts', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'Your saved plans', exact: true })).toBeVisible()
  await page.getByRole('link', { name: /View plan/ }).click()
  await expect(page).toHaveURL(/\/workouts\/[^/?]+/)
  await page.route(
    '**/api/v1/workouts/*',
    async (route) => {
      const response = await route.fetch()
      await route.fulfill({
        response,
        json: { ...(await response.json()), createdAt: '2026-10-09T00:30:00Z' },
      })
    },
    { times: 1 },
  )
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Full-body workout' })).toBeVisible()
  await expect(page.getByText('Level 3 · Full body', { exact: true })).toBeVisible()
  await expect(page.getByText('Saved 8 October 2026.', { exact: false })).toBeVisible()
})

test('failed shuffle retains the saved plan and supports a retry', async ({
  savedWorkoutPage: page,
}) => {
  const article = page.getByRole('article')
  const original = await article.locator('dl[aria-label="Workout statistics"]').innerText()
  await page.route('**/api/v1/workouts', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({
      status: 503,
      json: {
        message: 'Please try again.',
        code: 'service_unavailable',
        requestId: 'failure-fixture',
      },
    })
  })
  await page.getByRole('button', { name: 'Shuffle', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('saved workout is unchanged')
  await expect(article.locator('dl[aria-label="Workout statistics"]')).toHaveText(original, {
    useInnerText: true,
  })
  await expect(page.getByRole('button', { name: 'Shuffle', exact: true })).toBeEnabled()
  await page.unroute('**/api/v1/workouts')
  await page.getByRole('button', { name: 'Shuffle', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Full-body workout' })).toBeVisible()
})

test('a lost save response retries the same plan and a later shuffle creates a new one', async ({
  signedInPage: page,
}) => {
  await page.goto('/app/new')
  await page.route(
    '**/api/v1/workouts',
    async (route) => {
      const saved = await route.fetch()
      expect(saved.status()).toBe(201)
      await route.abort('failed')
    },
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('connection')
  await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Full-body workout' })).toBeVisible()
  await page.getByRole('button', { name: 'Shuffle', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Shuffle', exact: true })).toBeEnabled()
  await page.getByRole('link', { name: 'Saved workouts', exact: true }).last().click()
  await expect(page.getByRole('link', { name: /View plan/ })).toHaveCount(2)
})

test('offline generation recovers without freezing the builder', async ({ signedInPage: page }) => {
  await page.goto('/app/new')
  const generate = page.getByRole('button', {
    name: 'Generate my workout',
    exact: true,
  })
  await expect(generate).toBeEnabled()
  await page.context().setOffline(true)
  await generate.click()
  await expect(page.getByRole('alert')).toContainText('connection')
  await expect(generate).toBeEnabled()
  await page.context().setOffline(false)
  await generate.click()
  await expect(page.getByRole('heading', { name: 'Full-body workout' })).toBeVisible()
})

test('account switching clears private plans and sign-out protects history', async ({
  savedWorkoutPage: page,
  signIn,
}) => {
  await signIn(`other_${crypto.randomUUID()}`)
  await expect(page.getByRole('heading', { name: 'Full-body workout' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Saved workouts', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'No saved workouts yet.' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.goto('/app/workouts')
  await expect(page).toHaveURL(/\/sign-in/)
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
})
