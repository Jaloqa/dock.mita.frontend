import { expect, type Locator, type Page, test } from '@playwright/test'
import { pickOverlayOption } from '../e2e/overlayOption'

const name = 'Currencies Smoke'
const email = `currencies-${Date.now()}@example.com`
const password = 'currencies-smoke-password'

const card = (page: Page, title: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
const section = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })
const rowOf = (page: Page, title: string) => section(page, 'Transactions').getByRole('row').filter({ hasText: title })
const overlay = (page: Page) => page.locator('[data-pc-section="overlay"]')

const choose = async (page: Page, combobox: Locator, option: string) => {
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await combobox.click()
  await page.getByRole('listbox').getByRole('option', { name: option, exact: true }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(combobox).toBeFocused()
}

const pickCurrency = async (page: Page, field: Locator, query: string, option: string) => {
  await field.click()
  await overlay(page).getByRole('searchbox', { name: 'Search by code or name' }).fill(query)
  await pickOverlayOption(page, option)
  await expect(field).toHaveAttribute('aria-expanded', 'false')
  await expect(overlay(page)).toHaveCount(0)
}

const addAccount = async (page: Page, title: string, currency: { query: string; option: string }, balance: string) => {
  await page.getByRole('button', { name: 'Add account', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'New account' })
  await dialog.getByLabel('Name', { exact: true }).fill(title)
  await dialog.getByRole('button', { name: 'Cash', exact: true }).click()
  const field = dialog.getByRole('combobox', { name: 'Currency' })
  await pickCurrency(page, field, currency.query, currency.option)
  await expect(field).toHaveText(currency.option)
  await dialog.getByLabel('Opening balance').pressSequentially(balance)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(card(page, title)).toBeVisible()
}

test('real JPY and KWD accounts keep their own digits against the backend', async ({ page }) => {
  await page.goto('/register')
  const create = page.getByRole('button', { name: 'Create account', exact: true })
  await expect(create).toBeEnabled()
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await create.click()
  await expect(page).toHaveURL('/')

  await page.goto('/accounts')
  await expect(page.getByRole('heading', { level: 1, name: 'Accounts' })).toBeVisible()
  await expect(page.getByText('No accounts yet')).toBeVisible()

  await addAccount(page, 'Yen cash', { query: 'yen', option: 'JPY — Japanese Yen' }, '1500')
  await expect(card(page, 'Yen cash')).toContainText('¥1,500')
  await addAccount(page, 'Dinar', { query: 'kuw', option: 'KWD — Kuwaiti Dinar' }, '1.250')
  await expect(card(page, 'Dinar')).toContainText('KWD 1.250')

  await page.goto('/transactions')
  await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible()
  await page.getByRole('button', { name: 'Add transaction', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await choose(page, dialog.getByRole('combobox', { name: 'Account' }), 'Yen cash · JPY')
  await expect(dialog.getByRole('combobox', { name: 'Currency' })).toHaveText('JPY')
  await dialog.getByLabel('Amount', { exact: true }).pressSequentially('300')
  await choose(page, dialog.getByRole('combobox', { name: 'Category' }), 'Groceries')
  await dialog.getByLabel('Description', { exact: true }).fill('Ramen')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(rowOf(page, 'Ramen')).toContainText(/[-−]¥300/)

  await page.goto('/accounts')
  await expect(card(page, 'Yen cash')).toContainText('¥1,200')
  await expect(card(page, 'Dinar')).toContainText('KWD 1.250')

  await page.goto('/settings')
  const baseCurrency = page.getByRole('combobox', { name: 'Base currency', exact: true })
  await expect(baseCurrency).toHaveText('PLN — Polish Zloty')
  await baseCurrency.click()
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(4)
  await expect(page.getByRole('listbox').getByRole('option', { name: 'EUR — Euro', exact: true })).toBeVisible()
  await expect(page.getByRole('searchbox')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(baseCurrency).toHaveAttribute('aria-expanded', 'false')

  await section(page, 'Data').getByRole('button', { name: 'Delete account' }).click()
  const remove = page.getByRole('dialog', { name: 'Delete account' })
  await remove.getByLabel('Password', { exact: true }).fill(password)
  await remove.getByRole('button', { name: 'Delete account' }).click()
  await expect(page).toHaveURL('/login')
})
