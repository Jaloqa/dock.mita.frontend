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
