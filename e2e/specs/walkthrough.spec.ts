import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test, expect } from '../fixtures'

const artifacts = resolve(import.meta.dirname, '../../output/playwright/temper-improvements')
test.use({ video: 'on' })

test('walk through the saved library, workout views, and data export', async ({
  signedInPage: page,
  seedLibrary,
}, info) => {
  await seedLibrary()
  await mkdir(artifacts, { recursive: true })
  await page.goto('/workouts')
  await expect(page.getByRole('link', { name: /View plan/ })).toHaveCount(20)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({
    path: resolve(artifacts, `after-library-${info.project.name}.png`),
    fullPage: true,
    scale: 'css',
    animations: 'disabled',
  })
  await page.getByRole('searchbox').fill('Archive-only')
  await expect(page.getByRole('link', { name: /View plan/ })).toHaveCount(1)
  await page.screenshot({
    path: resolve(artifacts, `after-search-${info.project.name}.png`),
    fullPage: true,
    scale: 'css',
    animations: 'disabled',
  })
  await page.getByRole('link', { name: /View plan/ }).click()
  await expect(page.getByRole('heading', { name: 'Make this one count.' })).toBeVisible()
  await page.getByRole('button', { name: 'Exercise view', exact: true }).click()
  await expect(page.getByRole('progressbar')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '2')
  await page.screenshot({
    path: resolve(artifacts, `after-exercise-${info.project.name}.png`),
    fullPage: true,
    scale: 'css',
    animations: 'disabled',
  })
  await page.getByRole('link', { name: 'My workouts', exact: true }).last().click()
  await page.getByRole('link', { name: 'Account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your account.', exact: true })).toBeVisible()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download my data', exact: true }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^endorphins-data-\d{4}-\d{2}-\d{2}\.json$/)
  const data = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(data.workouts).toHaveLength(26)
  await expect(page.getByRole('status').filter({ hasText: 'download' })).toBeVisible()
  await page.screenshot({
    path: resolve(artifacts, `after-account-${info.project.name}.png`),
    fullPage: true,
    scale: 'css',
    animations: 'disabled',
  })
  await page.goto('/?minutes=60&level=3#builder')
  await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Make this one count.' })).toBeVisible()
  await page.getByRole('region', { name: 'Your time. Your pace.' }).screenshot({
    scale: 'css',
    animations: 'disabled',
    path: resolve(artifacts, `after-studio-${info.project.name}.png`),
  })
})
