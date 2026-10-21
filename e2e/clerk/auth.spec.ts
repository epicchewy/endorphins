import { randomInt, randomUUID } from 'node:crypto'
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright'
import { test as base, expect } from '@playwright/test'

// Development instances accept this code for +clerk_test emails and 555-01xx phone numbers.
const TEST_CODE = '424242'

type Identity = { username: string; email: string; phone: string; password: string }

async function clerkAPI(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) throw new Error(`Clerk ${path}: ${response.status} ${await response.text()}`)
  return response.json()
}

const test = base.extend<{ identity: Identity }>({
  identity: async ({}, use) => {
    const id = randomUUID().slice(0, 8)
    const area = ['201', '212', '303', '415', '512', '617', '702', '808'][randomInt(8)]
    const identity = {
      username: `e2e_${id}`,
      email: `endorphins+clerk_test_${id}@example.com`,
      phone: `+1${area}55501${String(randomInt(100)).padStart(2, '0')}`,
      password: randomUUID(),
    }
    await use(identity)
    // Delete the Clerk user even when the test fails part way through sign-up.
    const users: { id: string }[] = await clerkAPI(
      `/users?email_address=${encodeURIComponent(identity.email)}`,
    )
    for (const user of users) await clerkAPI(`/users/${user.id}`, { method: 'DELETE' })
  },
})

test('a new user signs up through Clerk and lands in onboarding', async ({ page, identity }) => {
  await setupClerkTestingToken({ page })
  await page.goto('/sign-up')
  await page.getByLabel('Username').fill(identity.username)
  await page.getByLabel('Email address').fill(identity.email)
  await page.getByLabel('Phone number').fill(identity.phone.slice(2))
  await page.getByLabel('Password', { exact: true }).fill(identity.password)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  // The instance verifies both email and phone at sign-up, in either order.
  for (let step = 0; step < 2; step++) {
    const heading = page.getByRole('heading', { name: /^Verify your (email|phone)/ })
    const name = await heading.textContent()
    await page
      .getByRole('textbox', { name: 'Enter verification code' })
      .pressSequentially(TEST_CODE)
    await expect(page.getByRole('heading', { name: name!, exact: true })).toHaveCount(0)
  }
  await expect(page.getByRole('heading', { name: 'Welcome home.' })).toBeVisible()
  await expect(page).toHaveURL(/\/app\/onboarding/)
})

test('a Clerk session reaches the app, and signing out closes it', async ({ page, identity }) => {
  await clerkAPI('/users', {
    method: 'POST',
    body: JSON.stringify({
      username: identity.username,
      email_address: [identity.email],
      phone_number: [identity.phone],
      password: identity.password,
    }),
  })
  await page.goto('/')
  await clerk.signIn({ page, emailAddress: identity.email })
  // The Go API verifies the real Clerk token and creates the account on first use.
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Welcome home.' })).toBeVisible()
  await clerk.signOut({ page })
  await page.goto('/app')
  await expect(page).toHaveURL(/\/sign-in/)
})
