import { test, expect } from '../fixtures'

test('finds an older plan beyond the loaded page and preserves filters through navigation', async ({
  signedInPage: page,
  seedLibrary,
}) => {
  await seedLibrary()
  await page.goto('/app/workouts')
  await expect(page.getByRole('link', { name: /View plan/ })).toHaveCount(20)
  await expect(page.getByRole('button', { name: 'Load more workouts' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'of 26' })).toContainText('26')
  await page.getByRole('searchbox').fill('Archive-only')
  await expect(page.getByRole('link', { name: /View plan/ })).toHaveCount(1)
  await expect(page).toHaveURL(/q=Archive-only/)
  await page.getByRole('combobox', { name: 'Filter by level' }).selectOption('5')
  await page.getByRole('combobox', { name: 'Sort workouts' }).selectOption('shortest')
  await expect(page).toHaveURL(
    (url) => url.searchParams.get('level') === '5' && url.searchParams.get('sort') === 'shortest',
  )
  await page.reload()
  await expect(page.getByRole('searchbox')).toHaveValue('Archive-only')
  await expect(page.getByRole('combobox', { name: 'Filter by level' })).toHaveValue('5')
  await expect(page.getByRole('combobox', { name: 'Sort workouts' })).toHaveValue('shortest')
  await page.getByRole('link', { name: /View plan/ }).click()
  await expect(page.getByRole('heading', { name: 'Full-body workout' })).toBeVisible()
  await expect(page.getByText('3 × 40s')).toBeVisible()
  await expect(page.getByText('20s rest per round')).toBeVisible()
  await expect(page.getByText('2 sets', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Saved workouts', exact: true }).last().click()
  await expect(page.getByRole('searchbox')).toHaveValue('Archive-only')
  await expect(page.getByRole('link', { name: /View plan/ })).toHaveCount(1)
})

test('shortest-first orders the whole account and empty search can be reset', async ({
  signedInPage: page,
  seedLibrary,
}) => {
  await seedLibrary()
  await page.goto('/app/workouts?sort=shortest')
  await expect(page.getByRole('link', { name: /View plan/ }).first()).toContainText('30')
  await page.getByRole('searchbox').fill('This exercise does not exist')
  await expect(page.getByRole('heading', { name: 'No matching plans.' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByRole('searchbox')).toHaveValue('')
  await expect(page.getByRole('link', { name: /View plan/ })).toHaveCount(20)
})
