import { test, expect } from '../fixtures'

test('sign-in returns to the chosen workout and native validation preserves custom drafts', async ({
  page,
}) => {
  await page.goto('/app/new?minutes=75&level=4')
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue with test identity' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome home.' })).toBeVisible()
  await page.getByRole('button', { name: 'Choose my level' }).click()
  await page.getByRole('button', { name: 'Set up my workout' }).click()
  const duration = page.getByRole('spinbutton', { name: 'Duration' })
  await expect(duration).toHaveValue('75')
  await expect(page.getByRole('radio', { name: 'Level 4: Tough' })).toBeChecked()
  await duration.fill('')
  await duration.pressSequentially('72')
  await expect(duration).toHaveValue('72')
  await expect(duration).toBeFocused()
  await expect(page).toHaveURL(/minutes=72/)
  await duration.fill('7')
  await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
  expect(await duration.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(
    true,
  )
  await expect(page.getByRole('heading', { name: 'Full-body workout' })).toHaveCount(0)
  await duration.fill('60')
  await expect(page).toHaveURL(/minutes=60/)
  await page.getByRole('button', { name: 'Generate my workout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Full-body workout' })).toBeVisible()
  await expect(page.getByText('Level 4 · Full body', { exact: true })).toBeVisible()
  await expect(page.getByRole('article')).toContainText('Built for 60 minutes')
})

test('component gallery shares accessible light/dark controls and reduced-motion behavior', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/design-system')
  const light = page.getByRole('region', { name: 'light component preview' })
  const dark = page.getByRole('region', { name: 'dark component preview' })
  await expect(light).toHaveCSS('background-color', 'rgb(242, 243, 243)')
  await expect(dark).toHaveCSS('background-color', 'rgb(21, 24, 25)')
  await expect(dark).toHaveCSS('color', 'rgb(242, 243, 243)')
  await expect(dark.locator('label:has(input:checked) > span')).toHaveCSS(
    'color',
    'rgb(21, 24, 25)',
  )
  await expect(dark.getByRole('alert')).toHaveCSS('background-color', 'rgb(60, 36, 35)')
  await expect(light.getByRole('button', { name: 'Unavailable' })).toBeDisabled()
  await expect(dark.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await light.getByRole('combobox', { name: 'Your level' }).selectOption('4')
  await light.getByRole('radio', { name: '60 min' }).check()
  await expect(light.getByRole('spinbutton', { name: 'Duration' })).toHaveValue('60')
  await expect(dark.getByRole('spinbutton', { name: 'Duration' })).toHaveValue('45')
  await expect(light.getByRole('combobox', { name: 'Your level' })).toHaveValue('4')
  await expect(dark.getByRole('combobox', { name: 'Your level' })).toHaveValue('2')
  await light.getByRole('button', { name: 'Try again' }).click()
  await expect(light.getByRole('status').filter({ hasText: 'Ready to try again.' })).toBeVisible()
  await light.getByRole('button', { name: 'Next move' }).click()
  await expect(light.getByText('Step 2. Make it count.')).toBeVisible()
  const transform = await light
    .getByText('Step 2. Make it count.')
    .evaluate((node) => getComputedStyle(node.parentElement!).transform)
  expect(transform).toBe('none')
  await page.setViewportSize({ width: 320, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('mobile layout, theme, keyboard navigation, and unsaved preferences stay usable', async ({
  signedInPage: page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Open my dashboard' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveCSS(
    'clip-path',
    'inset(50%)',
  )
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveCSS('clip-path', 'none')
  await page.keyboard.press('Enter')
  await page.getByRole('combobox', { name: 'Color theme' }).selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    'rgb(21, 24, 25)',
  )
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(21, 24, 25)')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    'rgb(21, 24, 25)',
  )
  await page.setViewportSize({ width: 320, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.goto('/app/new')
  await page.getByRole('radio', { name: '30min', exact: true }).check()
  await page.getByRole('radio', { name: '30min', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: '45min', exact: true })).toBeChecked()
  await page.getByRole('link', { name: 'Account', exact: true }).click()
  await page.getByRole('combobox', { name: 'Default level' }).selectOption('5')
  page.once('dialog', (dialog) => void dialog.dismiss())
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/account$/)
  await expect(page.getByRole('combobox', { name: 'Default level' })).toHaveValue('5')
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(page).toHaveURL(/\/app$/)
  await page.goto('/app/new')
  await expect(page.getByRole('radio', { name: 'Level 2: Steady' })).toBeChecked()
})

test('theme controls and browser color follow system and other-tab changes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  const control = page.getByRole('combobox', { name: 'Color theme' }).first()
  const color = page.locator('meta[name="theme-color"]')
  await control.selectOption('system')
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(242, 243, 243)')
  await expect(color).toHaveAttribute('content', 'rgb(242, 243, 243)')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(color).toHaveAttribute('content', 'rgb(21, 24, 25)')

  const other = await page.context().newPage()
  try {
    await other.goto('/')
    await other.getByRole('combobox', { name: 'Color theme' }).first().selectOption('light')
    await expect(control).toHaveValue('light')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(color).toHaveAttribute('content', 'rgb(242, 243, 243)')
    await page.setViewportSize({ width: 768, height: 1024 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally {
    await other.close()
  }
})

test('shared action links show hover and pressed feedback', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Hover feedback requires a pointer')
  await page.goto('/')
  const buildLink = page.getByRole('link', { name: 'Get started' }).last()
  await buildLink.hover()
  await expect(buildLink).toHaveCSS('background-color', 'rgb(243, 106, 73)')
  await expect(buildLink).toHaveCSS('translate', '0px -2px')
  await page.mouse.down()
  await expect(buildLink).toHaveCSS('translate', '0px')
  await page.mouse.move(0, 0)
  await page.mouse.up()
})

test('printing includes closed exercise notes and restores interactive disclosure state', async ({
  savedWorkoutPage: page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'PDF output requires desktop Chromium')
  const details = page.getByRole('article').locator('details')
  await details.first().locator('summary').click()
  const before = await details.evaluateAll((nodes: HTMLDetailsElement[]) =>
    nodes.map((node) => node.open),
  )
  await page.getByRole('button', { name: 'Exercise view', exact: true }).click()
  await expect(page.getByRole('progressbar')).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByTestId('workout-overview')).toBeVisible()
  await expect(page.getByTestId('workout-toolbar')).toBeHidden()
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  expect(
    await details.evaluateAll((nodes: HTMLDetailsElement[]) => nodes.every((node) => node.open)),
  ).toBe(true)
  const pdf = await page.pdf({
    path: info.outputPath('workout-print.pdf'),
    format: 'A4',
    printBackground: true,
  })
  expect(pdf.toString('ascii', 0, 4)).toBe('%PDF')
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await page.emulateMedia({ media: 'screen' })
  expect(
    await details.evaluateAll((nodes: HTMLDetailsElement[]) => nodes.map((node) => node.open)),
  ).toEqual(before)
  await expect(page.getByRole('progressbar')).toBeVisible()
})
