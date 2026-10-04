import { test, expect } from '../fixtures'

test('generates, saves, reopens, and follows a workout', async ({ signedInPage: page }) => {
  await page.goto('/')
  await page.getByRole('radio', { name: '60min', exact: true }).check()
  await page.getByRole('radio', { name: 'Level 3: Building momentum' }).check()
  await expect(page).toHaveURL(
    (url) => url.searchParams.get('minutes') === '60' && url.searchParams.get('level') === '3',
  )
  await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Make this one count.' })).toBeVisible()
  await expect(page.getByText('Level 3 · Full body', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'A little warm-up first' })).toBeVisible()
  await page.getByRole('button', { name: 'Exercise view', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '1')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '2')
  await page.getByRole('button', { name: 'Previous', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '1')
  await page.getByRole('link', { name: 'My workouts', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your workouts.', exact: true })).toBeVisible()
  await page.getByRole('link', { name: /View plan/ }).click()
  await expect(page).toHaveURL(/\/workouts\/[^/?]+/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Make this one count.' })).toBeVisible()
  await expect(page.getByText('Level 3 · Full body', { exact: true })).toBeVisible()
})

test('failed shuffle retains the saved plan and supports a retry', async ({
  signedInPage: page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Make this one count.' })).toBeVisible()
  const article = page.getByRole('article')
  const original = await article.locator('dl[aria-label="Workout statistics"]').innerText()
  await page.route('**/api/v1/workouts', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Please try again.',
        code: 'service_unavailable',
        requestId: 'failure-fixture',
      }),
    })
  })
  await page.getByRole('button', { name: 'Shuffle', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('previous workout is unchanged')
  await expect(article.locator('dl[aria-label="Workout statistics"]')).toHaveText(original, {
    useInnerText: true,
  })
  await expect(page.getByRole('button', { name: 'Shuffle', exact: true })).toBeEnabled()
  await page.unroute('**/api/v1/workouts')
  await page.getByRole('button', { name: 'Shuffle', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('Your workout is ready')
})

test('a lost save response retries the same plan and a later shuffle creates a new one', async ({
  signedInPage: page,
}) => {
  await page.goto('/')
  let lostResponse = true
  await page.route('**/api/v1/workouts', async (route) => {
    if (route.request().method() !== 'POST' || !lostResponse) return route.fallback()
    lostResponse = false
    const saved = await route.fetch()
    expect(saved.status()).toBe(201)
    await route.abort('failed')
  })
  await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('connection')
  await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Make this one count.' })).toBeVisible()
  await page.getByRole('button', { name: 'Shuffle', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Shuffle', exact: true })).toBeEnabled()
  await page.getByRole('link', { name: 'My workouts', exact: true }).click()
  await expect(page.getByRole('link', { name: /View plan/ })).toHaveCount(2)
})

test('offline generation recovers without freezing the builder', async ({ signedInPage: page }) => {
  await page.goto('/')
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
  await expect(page.getByRole('heading', { name: 'Make this one count.' })).toBeVisible()
})

test('account switching clears private plans and sign-out protects history', async ({
  signedInPage: page,
  signIn,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Make this one count.' })).toBeVisible()
  await signIn(`other_${crypto.randomUUID()}`)
  await expect(page.getByRole('heading', { name: 'Make this one count.' })).toHaveCount(0)
  await page.getByRole('link', { name: 'My workouts', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your next move starts here.' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.goto('/workouts')
  await expect(page).toHaveURL(/\/sign-in/)
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible()
})
