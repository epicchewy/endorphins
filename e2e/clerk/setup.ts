import { clerkSetup } from '@clerk/testing/playwright'

// Runs in the runner process, so the testing token it sets reaches every worker.
export default async function setup() {
  // These tests create and delete Clerk users; never point them at production.
  if (!process.env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_'))
    throw new Error('Run with Clerk development keys from frontend/.env.local (make e2e-clerk).')
  await clerkSetup({ dotenv: false })
}
