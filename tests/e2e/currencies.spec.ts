import { expect, type Locator, type Page, test } from '@playwright/test'
import { pickOverlayOption } from './overlayOption'

const overlay = (page: Page) => page.locator('[data-pc-section="overlay"]')

const card = (page: Page, name: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) })

const pickCurrency = async (page: Page, field: Locator, query: string, option: string) => {
  await field.click()
  await overlay(page).getByRole('searchbox', { name: 'Search by code or name' }).fill(query)
  await pickOverlayOption(page, option)
  await expect(field).toHaveAttribute('aria-expanded', 'false')
  await expect(overlay(page)).toHaveCount(0)
}

const openNewAccount = async (page: Page) => {
  await page.goto('/accounts')
  await expect(card(page, 'Konto główne')).toBeVisible()
  await page.getByRole('button', { name: 'Add account' }).click()
  const dialog = page.getByRole('dialog', { name: 'New account' })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  return dialog
}

const openTokioExpense = async (page: Page, isMobile: boolean) => {
  if (!isMobile) {
    await page.goto('/transactions')
    await page.getByRole('button', { name: 'Add transaction' }).click()
    const dialog = page.getByRole('dialog', { name: 'New transaction' })
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
    const account = dialog.getByRole('combobox', { name: 'Account' })
    await account.click()
    await pickOverlayOption(page, 'Tokio · JPY')
    await expect(account).toHaveText('Tokio · JPY')
    await expect(overlay(page)).toHaveCount(0)
    return dialog
  }
  await page.goto('/transactions/new')
  await page.getByRole('button', { name: 'Account: Konto główne' }).click()
  await page.getByRole('dialog', { name: 'Choose an account' }).getByRole('button', { name: /Tokio/ }).click()
  await expect(page.getByRole('button', { name: 'Account: Tokio' })).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'Keypad' }).getByRole('button', { name: 'Decimal separator' }),
  ).toHaveCount(0)
  await page.keyboard.type('7')
  await expect(page.getByLabel('Amount')).toHaveText(/^−¥7$/)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page).toHaveURL('/transactions')
  await page
    .getByRole('region', { name: 'Transactions by day' })
    .getByRole('listitem')
    .filter({ hasText: '-¥7' })
    .first()
    .getByRole('button')
    .click()
  return page.getByRole('dialog', { name: 'Edit transaction' })
}

test('creates a JPY account and a KWD expense', async ({ page, isMobile }) => {
  const dialog = await openNewAccount(page)
  await dialog.getByLabel('Name', { exact: true }).fill('Tokio')
  const currency = dialog.getByRole('combobox', { name: 'Currency' })
  await pickCurrency(page, currency, 'yen', 'JPY — Japanese Yen')
  await expect(currency).toHaveText('JPY — Japanese Yen')
  const opening = dialog.getByLabel('Opening balance')
  await opening.pressSequentially('1500')
  await expect(opening).toHaveValue('¥1,500')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Account created')).toBeVisible()
  await expect(card(page, 'Tokio')).toContainText('¥1,500')

  const expense = await openTokioExpense(page, isMobile)
  const entered = expense.getByRole('combobox', { name: 'Currency' })
  await expect(entered).toHaveText('JPY')
  await pickCurrency(page, entered, 'kuw', 'KWD — Kuwaiti Dinar')
  await expect(entered).toHaveText('KWD')
  const amount = expense.getByLabel('Amount')
  await amount.fill('')
  await amount.pressSequentially('1.250')
  await expect(amount).toHaveValue(/^KWD\s1\.250$/)
  await expect(expense.getByLabel('Exchange rate (KWD → JPY)')).toHaveValue(/^\d/)
  await expense.getByLabel('Description').fill('Souk')
  await expense.getByRole('button', { name: 'Save' }).click()
  await expect(expense).toBeHidden()
  const rows = isMobile
    ? page.getByRole('region', { name: 'Transactions by day' }).getByRole('listitem')
    : page.getByRole('region', { name: 'Transactions' }).locator('tbody tr')
  await expect(rows.filter({ hasText: 'Souk' })).toContainText(/KWD\s1\.250/)
})

test("shows the user's currencies first", async ({ page }) => {
  const dialog = await openNewAccount(page)
  const currency = dialog.getByRole('combobox', { name: 'Currency' })
  await currency.click()
  const options = overlay(page).getByRole('option')
  await expect(options.nth(0)).toHaveText('Your currencies')
  await expect(options.nth(1)).toHaveText('PLN — Polish Zloty')
  await expect(options.nth(2)).toHaveText('EUR — Euro')
  await expect(options.nth(3)).toHaveText('All currencies')
  await expect(options.nth(4)).toHaveText(/^AED — /)
  await expect(overlay(page).getByRole('option', { name: 'USD — US Dollar', exact: true })).toHaveCount(1)

  await overlay(page).getByRole('searchbox', { name: 'Search by code or name' }).fill('yen')
  await pickOverlayOption(page, 'JPY — Japanese Yen')
  await expect(currency).toHaveText('JPY — Japanese Yen')
  await expect(overlay(page)).toHaveCount(0)
  await currency.click()
  await expect(options.nth(0)).toHaveText('Your currencies')
  await expect(options.nth(1)).toHaveText('JPY — Japanese Yen')
  await expect(options.nth(2)).toHaveText('PLN — Polish Zloty')
  await expect(options.nth(3)).toHaveText('EUR — Euro')
  await expect(options.nth(4)).toHaveText('All currencies')
})

test('finds a currency by its Polish name', async ({ page }) => {
  await page.goto('/pl/accounts')
  await expect(page.getByRole('heading', { level: 1, name: 'Konta' })).toBeVisible()
  await page.getByRole('button', { name: 'Dodaj konto' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nowe konto' })
  await expect(dialog.getByRole('button', { name: 'Zamknij', exact: true })).toBeFocused()
  await dialog.getByRole('combobox', { name: 'Waluta' }).click()
  await overlay(page).getByRole('searchbox', { name: 'Szukaj po kodzie lub nazwie' }).fill('jen')
  await expect(overlay(page).getByRole('option', { name: /^JPY — / })).toBeVisible()
  await expect(overlay(page).getByRole('option', { name: 'Twoje waluty' })).toHaveCount(0)
  await overlay(page).getByRole('searchbox', { name: 'Szukaj po kodzie lub nazwie' }).fill('xyz')
  await expect(overlay(page).getByRole('option', { name: 'Nie znaleziono waluty' })).toBeVisible()
})

test('fits the opening balance to the digits of a new currency', async ({ page }) => {
  const dialog = await openNewAccount(page)
  const currency = dialog.getByRole('combobox', { name: 'Currency' })
  const opening = dialog.getByLabel('Opening balance')
  await opening.pressSequentially('12.55')
  await expect(opening).toHaveValue(/^PLN\s12\.55$/)
  await pickCurrency(page, currency, 'yen', 'JPY — Japanese Yen')
  await expect(opening).toHaveValue('¥12')
  await pickCurrency(page, currency, 'pln', 'PLN — Polish Zloty')
  await expect(opening).toHaveValue(/^PLN\s12\.00$/)
})

test('a JPY amount below one yen is not saved as a positive amount', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a new transaction with a chosen currency is entered in the desktop dialog')
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Add transaction' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  const amount = dialog.getByLabel('Amount')
  await amount.pressSequentially('0.4')
  await expect(amount).toHaveValue(/^PLN\s0\.40$/)
  await pickCurrency(page, dialog.getByRole('combobox', { name: 'Currency' }), 'yen', 'JPY — Japanese Yen')
  await expect(amount).toHaveValue('¥0')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('Enter an amount above zero.')).toBeVisible()
  await expect(amount).toBeFocused()
})
