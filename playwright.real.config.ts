import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e-real',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'real', use: { ...devices['Desktop Chrome'] } }],
})
