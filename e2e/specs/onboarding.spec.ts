import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test, expect } from '../fixtures'
import { auditPages } from '../harness/page-audits'

const artifacts = resolve(import.meta.dirname, '../../output/playwright/redesign')

test.use({
  video: async ({}, use, worker) => {
    await use({ mode: 'on', size: worker.project.use.viewport ?? { width: 1440, height: 1000 } })
  },
})

test.describe('recorded onboarding journey', () => {
  test.afterEach(async ({ page }, info) => {
    const cookies = await page.context().cookies()
    const origin = new URL(page.url()).origin
    const video = page.video()
    if (video) {
      await mkdir(artifacts, { recursive: true })
      await page.context().close()
      await video.saveAs(resolve(artifacts, `e2e-${info.project.name}.webm`))
    }
    if (process.env.E2E_AUDIT && info.project.name === 'desktop' && info.status === 'passed') {
      test.setTimeout(180_000)
      await auditPages(origin, cookies, artifacts)
    }
  })
  test('signup introduces home workouts, saves a level, and records real progress', async ({
    page,
  }, info) => {
    test.setTimeout(75_000)
    await mkdir(artifacts, { recursive: true })
    const capture = async (name: string) => {
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({
        path: resolve(artifacts, `${name}-${info.project.name}.png`),
        fullPage: true,
        scale: 'css',
        animations: 'disabled',
      })
      // Deliberate viewing time for the requested review video, not synchronization.
      await page.waitForTimeout(1900)
    }
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Get started', exact: true })).toBeVisible()
    await capture('landing')
    await page.getByRole('link', { name: 'Get started', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Create your account.' })).toBeVisible()
    await capture('signup')
    await page.getByRole('button', { name: 'Continue with test identity' }).click()
    await expect(page.getByRole('heading', { name: 'Welcome home.' })).toBeVisible()
    await expect(
      page.getByText('Every new plan uses bodyweight exercises.', { exact: false }),
    ).toBeVisible()
    await capture('welcome')
    await page.getByRole('button', { name: 'Choose my level' }).click()
    await page.getByRole('radio', { name: /3 Lively/ }).check()
    await capture('level')
    await page.getByRole('button', { name: 'Set up my workout' }).click()
    await expect(page).toHaveURL(/\/app\/new$/)
    await expect(page.getByRole('radio', { name: 'Level 3: Lively' })).toBeChecked()
    await capture('setup')
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Start with one workout.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your last four weeks' })).toHaveCount(0)
    await capture('dashboard-empty')
    await page.getByRole('link', { name: 'Create my first workout' }).click()
    await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Full-body workout' })).toBeVisible()
    const planURL = page.url()
    await capture('saved-plan')
    await page.getByRole('button', { name: 'Exercise view', exact: true }).click()
    await expect(page.getByRole('progressbar')).toBeVisible()
    await page.getByTestId('exercise-view').scrollIntoViewIfNeeded()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await capture('exercise-view')
    await page.getByRole('button', { name: 'Plan overview', exact: true }).click()
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your workout is ready.' })).toBeVisible()
    await capture('dashboard-saved')
    await page.getByRole('link', { name: 'I finished', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Finished your workout?' })).toBeVisible()
    await capture('finish-confirmation')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Finished your workout?' })).toBeVisible()
    await page.getByRole('button', { name: 'Mark workout complete' }).click()
    await expect(page.getByRole('heading', { name: 'Workout complete.' })).toBeVisible()
    await expect(page.getByText('Your first workout. A good start.')).toBeVisible()
    await capture('finish')
    await page.getByRole('link', { name: 'Back to dashboard' }).click()
    await expect(page.getByTestId('completed-total')).toHaveText('1')
    await capture('dashboard-first')
    // A new confirmation is another workout, even when it uses the same plan.
    await page.goto(planURL + '/finish')
    await page.getByRole('button', { name: 'Mark workout complete' }).click()
    await expect(page.getByRole('heading', { name: 'Workout complete.' })).toBeVisible()
    await page.getByRole('button', { name: 'Undo completion' }).click()
    await expect(page.getByText('Completion removed. Your plan is still saved.')).toBeVisible()
    await page.getByRole('button', { name: 'Mark workout complete' }).click()
    await expect(page.getByRole('heading', { name: 'Workout complete.' })).toBeVisible()
    await page.getByRole('link', { name: 'Back to dashboard' }).click()
    await expect(page.getByTestId('completed-total')).toHaveText('2')
    await capture('dashboard-returning')
    await page.goto('/app/onboarding')
    await expect(page).toHaveURL(/\/app\/new$/)
    await page.getByRole('link', { name: 'Account', exact: true }).click()
    await page.getByRole('combobox', { name: 'Default level' }).selectOption('1')
    await page.getByRole('button', { name: 'Save level' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Default level saved.' })).toBeVisible()
    await page.goto('/app/new')
    await expect(page.getByRole('radio', { name: 'Level 1: Light' })).toBeChecked()
    await page.setViewportSize({ width: 320, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.setViewportSize(info.project.use.viewport!)
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
    await expect(page.getByTestId('completed-total')).toHaveText('2')
    await page.setViewportSize({ width: 320, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.setViewportSize(info.project.use.viewport!)
    await page.waitForTimeout(1900)
  })
})

test('a lost completion response can be retried without adding a second workout', async ({
  signedInPage: page,
}) => {
  await page.goto('/app/new')
  await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Full-body workout' })).toBeVisible()
  await page.getByRole('link', { name: 'I finished', exact: true }).click()
  let loseResponse = true
  await page.route('**/api/v1/workouts/*/completions', async (route) => {
    if (!loseResponse) return route.fallback()
    loseResponse = false
    const saved = await route.fetch()
    expect(saved.status()).toBe(201)
    await route.abort('failed')
  })
  await page.getByRole('button', { name: 'Mark workout complete' }).click()
  await expect(page.getByRole('alert')).toContainText('connection')
  await page.getByRole('button', { name: 'Mark workout complete' }).click()
  await expect(page.getByRole('heading', { name: 'Workout complete.' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to dashboard' }).click()
  await expect(page.getByTestId('completed-total')).toHaveText('1')
})

test('late completion results cannot appear in another account', async ({
  signedInPage: page,
  subject,
  signIn,
}) => {
  await page.goto('/app/new')
  await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Full-body workout' })).toBeVisible()
  await page.getByRole('link', { name: 'I finished', exact: true }).click()
  const waiting = Promise.withResolvers<void>()
  const completed = Promise.withResolvers<void>()
  await page.route('**/api/v1/workouts/*/completions', async (route) => {
    const response = await route.fetch()
    expect(response.status()).toBe(201)
    completed.resolve()
    await waiting.promise
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: 'Mark workout complete' }).click()
  await completed.promise
  await signIn(`other_${crypto.randomUUID()}`)
  waiting.resolve()
  await expect(page.getByRole('heading', { name: 'Workout complete.' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Start with one workout.' })).toBeVisible()
  await expect(page.getByTestId('completed-total')).toHaveCount(0)
  await signIn(subject)
  await expect(page.getByTestId('completed-total')).toHaveText('1')
})

test('an account load error shows recovery instead of restarting onboarding', async ({
  signedInPage: page,
}) => {
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'service_unavailable', message: 'Try again.' }),
    }),
  )
  await page.goto('/app')
  await expect(page.getByRole('alert')).toContainText('try again')
  await expect(page.getByRole('heading', { name: 'Welcome home.' })).toHaveCount(0)
  await page.unroute('**/api/v1/me')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Start with one workout.' })).toBeVisible()
})

test('sign-in rejects an external return URL', async ({ page }) => {
  await page.goto('/sign-in?redirect_url=https%3A%2F%2Fexample.com%2Fapp')
  await page.getByRole('button', { name: 'Continue with test identity' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome home.' })).toBeVisible()
  await expect(page).toHaveURL(/\/app\/onboarding/)
})

test('a saved completion stays confirmed while analytics are slow or fail', async ({
  signedInPage: page,
}) => {
  await page.goto('/app/new')
  await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Full-body workout' })).toBeVisible()
  const analytics = Promise.withResolvers<void>()
  await page.route('**/api/v1/activity?*', async (route) => {
    await analytics.promise
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'service_unavailable', message: 'Try again.' }),
    })
  })
  await page.getByRole('link', { name: 'I finished', exact: true }).click()
  await page.getByRole('button', { name: 'Mark workout complete' }).click()
  await expect(page.getByRole('heading', { name: 'Workout complete.' })).toBeVisible()
  await expect(page.getByText('Updating your progress…', { exact: true })).toBeVisible()
  await expect(page.getByText('Completed workouts', { exact: true })).toHaveCount(0)
  analytics.resolve()
  await expect(page.getByRole('alert')).toContainText('try again')
  await expect(page.getByText('Completed workouts', { exact: true })).toHaveCount(0)
  await page.unroute('**/api/v1/activity?*')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('dd').first()).toHaveText('1')
})
