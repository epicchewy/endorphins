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
  const duration = page.getByRole('spinbutton', { name: 'Custom duration' })
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
  await expect(page.getByText(/^Level 4 · About \d+ min · \d+ exercises/)).toBeVisible()
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
  await expect(
    dark.getByRole('alert').filter({ hasText: 'We couldn’t save your workout.' }),
  ).toHaveCSS('background-color', 'rgb(29, 33, 35)')
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
  const spinner = light.getByRole('button', { name: 'Saving…' }).locator('svg')
  expect(await spinner.evaluate((node) => getComputedStyle(node).animationName)).toBe('none')
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
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
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

test('shared action links change color on hover without lifting', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Hover feedback requires a pointer')
  await page.goto('/')
  const buildLink = page.getByRole('link', { name: 'Get started' }).last()
  const background = () => buildLink.evaluate((node) => getComputedStyle(node).backgroundColor)
  const rest = await background()
  await buildLink.hover()
  await expect.poll(background).not.toBe(rest)
  await expect(buildLink).toHaveCSS('translate', 'none')
  await page.mouse.down()
  await expect(buildLink).toHaveCSS('translate', '0px 1px')
  await page.mouse.move(0, 0)
  await page.mouse.up()
})

test('printing from the exercise view outputs the full plan without screen controls', async ({
  savedWorkoutPage: page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'PDF output requires desktop Chromium')
  await page.getByRole('button', { name: 'Start workout', exact: true }).click()
  await expect(page.getByRole('progressbar')).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByTestId('workout-overview')).toBeVisible()
  await expect(page.getByTestId('workout-toolbar')).toBeHidden()
  await expect(page.getByTestId('exercise-view')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Mark complete', exact: true })).toBeHidden()
  const pdf = await page.pdf({
    path: info.outputPath('workout-print.pdf'),
    format: 'A4',
    printBackground: true,
  })
  expect(pdf.toString('ascii', 0, 4)).toBe('%PDF')
  await page.emulateMedia({ media: 'screen' })
  await expect(page.getByRole('progressbar')).toBeVisible()
})
