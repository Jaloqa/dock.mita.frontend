import { expect, test } from '@playwright/test'

test('home page renders in English by default', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Personal budget planner')).toBeVisible()
})

test('home page switches to Ukrainian under its prefix', async ({ page }) => {
  await page.goto('/uk')
  await expect(page.getByText('Особистий планер бюджету')).toBeVisible()
})
