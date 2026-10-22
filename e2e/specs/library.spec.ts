import { readFile } from 'node:fs/promises'
import { test, expect } from '../fixtures'

test('loads older plans and opens one from the full library', async ({
  signedInPage: page,
  seedLibrary,
}) => {
  await seedLibrary()
  await page.goto('/app/workouts')
  const plans = page.getByRole('link', { name: /View plan/ })
  await expect(plans).toHaveCount(20)
  await expect(page.getByRole('status').filter({ hasText: '20 of 26 plans' })).toBeVisible()
  await page.getByRole('button', { name: 'Load more workouts' }).click()
  await expect(plans).toHaveCount(26)
  await expect(page.getByRole('status').filter({ hasText: '26 plans' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load more workouts' })).toHaveCount(0)
  await plans.last().click()
  await expect(page.getByRole('heading', { name: 'Full-body workout' })).toBeVisible()
  await expect(page.getByText('3 × 40s')).toBeVisible()
  await expect(page.getByText('20s rest', { exact: true })).toBeVisible()
  await expect(page.getByText('2 sets', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Saved workouts', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'Your saved plans', exact: true })).toBeVisible()
})

test('downloads the account data as JSON', async ({ signedInPage: page, seedLibrary }) => {
  await seedLibrary()
  await page.goto('/app/account')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download my data', exact: true }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^endorphins-data-\d{4}-\d{2}-\d{2}\.json$/)
  const data = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(data.workouts).toHaveLength(26)
  expect(download.url()).toMatch(/^blob:/)
  expect(
    await page.evaluate(
      (url) =>
        fetch(url).then(
          () => true,
          () => false,
        ),
      download.url(),
    ),
  ).toBe(false)
  await expect(page.getByRole('status').filter({ hasText: 'download' })).toBeVisible()
})
