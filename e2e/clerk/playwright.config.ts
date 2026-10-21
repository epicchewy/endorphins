import { defineConfig, devices } from '@playwright/test'

// Real Clerk journeys against `make dev` and the Clerk development instance.
// The hermetic suite in ../playwright.config.ts covers everything else.
const baseURL = 'http://127.0.0.1:3100'

export default defineConfig({
  testDir: '.',
  forbidOnly: Boolean(process.env.CI),
  // Each test creates real Clerk users; one worker stays under API rate limits.
  workers: 1,
  globalSetup: './setup.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: '../../output/playwright/clerk-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'make -C ../.. dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 300_000,
  },
})
