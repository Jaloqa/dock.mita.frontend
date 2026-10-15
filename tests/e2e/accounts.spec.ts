import { expect, type Page, test } from '@playwright/test'

const card = (page: Page, name: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) })

test('accounts show balances, total, distribution and transfers', async ({ page }) => {
  await page.goto('/accounts')
  await expect(page.getByRole('heading', { level: 1, name: 'Accounts' })).toBeVisible()
  await expect(card(page, 'Konto główne')).toContainText('PLN 8,820.40')
  await expect(card(page, 'Konto główne')).toContainText('•••• 4821')
  await expect(card(page, 'Gotówka')).toContainText('PLN 940.00')
  await expect(card(page, 'Oszczędności')).toContainText('PLN 14,000.00')
  await expect(card(page, 'Konto EUR')).toContainText('€')
  await expect(card(page, 'Konto EUR')).toContainText('≈ PLN')
  await expect(page.getByTestId('accounts-total')).toHaveText(/^Total PLN\s\d{2},\d{3}\.\d{2}$/)
  await expect(page.getByRole('img', { name: /Oszczędności \d+%/ })).toBeVisible()
  const latest = page.getByRole('region', { name: 'Transfers between accounts' }).getByRole('listitem').first()
  await expect(latest).toContainText('Konto główne → Oszczędności')
  await expect(latest).toContainText('PLN 1,000.00')
})

test('accounts screen is localized', async ({ page }) => {
  await page.goto('/pl/accounts')
  await expect(page.getByRole('heading', { level: 1, name: 'Konta' })).toBeVisible()
  await expect(page.getByTestId('accounts-total')).toContainText('Razem')
})

test('adds an account after fixing validation errors, then deletes it', async ({ page }) => {
  await page.goto('/accounts')
  await expect(card(page, 'Konto główne')).toBeVisible()
  await page.getByRole('button', { name: 'Add account' }).click()
  const dialog = page.getByRole('dialog', { name: 'New account' })
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('This field is required.').first()).toBeVisible()
  await expect(dialog.getByLabel('Name', { exact: true })).toBeFocused()
  await dialog.getByLabel('Name', { exact: true }).fill('Travel')
  await dialog.getByLabel('Last 4 digits of the card').fill('12')
  await dialog.getByRole('button', { name: 'Cash', exact: true }).click()
  await dialog.getByLabel('Opening balance').pressSequentially('250')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Account created')).toBeVisible()
  await expect(card(page, 'Travel')).toContainText('PLN 250.00')

  await card(page, 'Travel').getByRole('button', { name: 'Edit Travel' }).click()
  await page.getByRole('dialog', { name: 'Edit account' }).getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Account deleted')).toBeVisible()
  await expect(card(page, 'Travel')).toHaveCount(0)
})

test('archives an account with history and restores it', async ({ page }) => {
  await page.goto('/accounts')
  await card(page, 'Gotówka').getByRole('button', { name: 'Edit Gotówka' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit account' })
  await expect(edit.getByRole('button', { name: 'Delete' })).toHaveCount(0)
  await expect(edit.getByText('The currency cannot change once the account has history.')).toBeVisible()
  await edit.getByRole('button', { name: 'Archive' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByText('Account archived')).toBeVisible()
  await expect(card(page, 'Gotówka')).toHaveCount(0)

  await page.getByRole('button', { name: 'Show archived (1)' }).click()
  await card(page, 'Gotówka').getByRole('button', { name: 'Edit Gotówka' }).click()
  await page.getByRole('dialog', { name: 'Edit account' }).getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByText('Account restored')).toBeVisible()
  await expect(page.getByRole('button', { name: /Show archived/ })).toHaveCount(0)
  await expect(card(page, 'Gotówka')).toContainText('PLN 940.00')
})
