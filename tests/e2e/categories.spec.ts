import { expect, type Page, test } from '@playwright/test'

const openManager = async (page: Page, path = '/settings', button = 'Manage categories', title = 'Categories') => {
  await page.goto(path)
  await page.getByRole('button', { name: button }).click()
  const dialog = page.getByRole('dialog', { name: title })
  await expect(dialog).toBeVisible()
  return dialog
}

test('category manager lists expense and income categories of the demo user', async ({ page }) => {
  const dialog = await openManager(page)
  const expense = dialog.getByRole('list', { name: 'Expenses' })
  await expect(expense.getByRole('listitem')).toHaveCount(11)
  await expect(expense.getByRole('listitem').first()).toContainText('Spożywcze')
  await expect(expense.getByRole('listitem').filter({ hasText: 'Inne' })).toContainText('System')
  await expect(expense.getByRole('listitem').filter({ hasText: /^Sport/ })).not.toContainText('System')

  await dialog.getByRole('tab', { name: 'Income' }).click()
  const income = dialog.getByRole('list', { name: 'Income' })
  await expect(income.getByRole('listitem')).toHaveCount(8)
  await expect(income.getByRole('listitem').first()).toContainText('Wynagrodzenie')
  await expect(dialog.getByRole('list', { name: 'Expenses' })).toBeHidden()
})

test('category manager is localized', async ({ page }) => {
  const dialog = await openManager(page, '/uk/settings', 'Керування категоріями', 'Категорії')
  await expect(dialog.getByRole('tab', { name: 'Витрати' })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByRole('tab', { name: 'Доходи' })).toBeVisible()
  await expect(dialog.getByRole('list', { name: 'Витрати' }).getByText('Системна').first()).toBeVisible()
})
