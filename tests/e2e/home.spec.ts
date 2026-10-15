import { expect, test } from '@playwright/test'

test('overview renders in English by default', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page).toHaveTitle('Overview · Mita')
})

test('overview renders in Ukrainian under its prefix', async ({ page }) => {
  await page.goto('/uk')
  await expect(page).toHaveTitle('Огляд · Mita')
})
