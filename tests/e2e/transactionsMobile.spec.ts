import { expect, type Page, test } from '@playwright/test'

test.skip(({ isMobile }) => !isMobile, 'cards grouped by day are the mobile layout')

const list = (page: Page) => page.getByRole('region', { name: 'Transactions by day' })

const showAllTime = async (page: Page) => {
  await page.getByRole('button', { name: 'Filters' }).click()
  const drawer = page.getByRole('dialog', { name: 'Filters' })
  await drawer.getByRole('combobox', { name: 'Period' }).click()
  await page.getByRole('option', { name: 'All time' }).click()
  await drawer.getByRole('button', { name: 'Show results' }).click()
  await expect(drawer).toBeHidden()
}

test('groups transactions by day and filters them with chips, search and a drawer', async ({ page }) => {
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible()
  await showAllTime(page)
  await expect(list(page).getByRole('heading').first()).toBeVisible()
  await expect(page.getByRole('region', { name: 'Filter summary' })).toContainText(/Found: \d+ transactions/)
  await page.getByRole('button', { name: 'Income', exact: true }).click()
  await expect(list(page).getByRole('listitem').filter({ hasText: 'Wynagrodzenie' }).first()).toBeVisible()
  await expect(list(page).getByRole('listitem').filter({ hasText: 'Czynsz' })).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Search' }).fill('Odsetki')
  await expect(list(page).getByRole('listitem').first()).toContainText('Odsetki')
  await expect(list(page).getByRole('listitem').filter({ hasNotText: 'Odsetki' })).toHaveCount(0)
})

test('opens the edit dialog from a card', async ({ page }) => {
  await page.goto('/transactions')
  await showAllTime(page)
  await page.getByRole('searchbox', { name: 'Search' }).fill('Czynsz')
  await expect(list(page).getByRole('listitem').first()).toContainText('Czynsz')
  await expect(list(page).getByRole('listitem').filter({ hasNotText: 'Czynsz' })).toHaveCount(0)
  await list(page).getByRole('listitem').first().getByRole('button').click()
  const dialog = page.getByRole('dialog', { name: 'Edit transaction' })
  await expect(dialog.getByLabel('Description')).toHaveValue('Czynsz')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})

test('resets the filters from the drawer', async ({ page }) => {
  await page.goto('/transactions')
  await showAllTime(page)
  await page.getByRole('button', { name: 'Filters' }).click()
  const drawer = page.getByRole('dialog', { name: 'Filters' })
  await drawer.getByRole('button', { name: 'Reset filters' }).click()
  await expect(drawer.getByRole('combobox', { name: 'Period' })).toContainText('This month')
})
