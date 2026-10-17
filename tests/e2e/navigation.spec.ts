import { expect, test } from '@playwright/test'

const screens = [
  { path: '/transactions', title: 'Transactions' },
  { path: '/goals', title: 'Goals' },
  { path: '/reports', title: 'Reports' },
]

test('every main screen is reachable from the navigation', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true })

  for (const screen of screens) {
    await nav.getByRole('link', { name: screen.title }).click()
    await expect(page).toHaveURL(screen.path)
    await expect(page.getByRole('heading', { level: 1, name: screen.title })).toBeVisible()
  }
})

test('localized routes keep the locale prefix', async ({ page }) => {
  await page.goto('/uk/budgets')
  await expect(page.getByRole('heading', { level: 1, name: 'Бюджети' })).toBeVisible()
})

test('mobile overview links to settings', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout')
  await page.goto('/')
  await page.getByRole('link', { name: 'Settings' }).filter({ visible: true }).click()
  await expect(page).toHaveURL('/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
})
