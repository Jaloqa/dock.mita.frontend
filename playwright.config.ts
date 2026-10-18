import { defineConfig, devices } from '@playwright/test'
import { SIGNED_IN_STATE as storageState } from './tests/e2e/signedInState'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts$/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], storageState }, dependencies: ['setup'] },
    { name: 'mobile', use: { ...devices['Pixel 7'], storageState }, dependencies: ['setup'] },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'bun run dev', url: baseURL, reuseExistingServer: true, timeout: 120_000 },
})
