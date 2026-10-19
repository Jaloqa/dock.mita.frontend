import { expect, type Locator, type Page, test } from '@playwright/test'

const name = 'Overview Reports Smoke'
const email = `overview-reports-${Date.now()}@example.com`
const password = 'overview-reports-smoke-password'

const card = (page: Page, title: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
const section = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })

const choose = async (page: Page, combobox: Locator, option: string | RegExp) => {
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await combobox.click()
  await page.getByRole('listbox').getByRole('option', { name: option }).click()
}

const addTransaction = async (
  page: Page,
  kind: 'Income' | 'Expense',
  amount: string,
  category: string | RegExp,
  description: string,
) => {
  await page.getByRole('button', { name: 'New transaction', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await dialog.getByRole('button', { name: kind, exact: true }).click()
  await dialog.getByLabel('Amount', { exact: true }).pressSequentially(amount)
  await choose(page, dialog.getByRole('combobox', { name: 'Account' }), /^Wallet/)
  await choose(page, dialog.getByRole('combobox', { name: 'Category' }), category)
  await dialog.getByLabel('Description', { exact: true }).fill(description)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(section(page, 'Transactions').getByRole('row').filter({ hasText: description })).toBeVisible()
}

test('real overview and reports reflect transactions from the backend', async ({ page }) => {
  await page.goto('/register')
  const create = page.getByRole('button', { name: 'Create account', exact: true })
  await expect(create).toBeEnabled()
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await create.click()
  await expect(page).toHaveURL('/')

  await page.goto('/accounts')
  await page.getByRole('button', { name: 'Add account', exact: true }).first().click()
  const account = page.getByRole('dialog', { name: 'New account' })
  await account.getByLabel('Name', { exact: true }).fill('Wallet')
  await account.getByRole('button', { name: 'Cash', exact: true }).click()
  await account.getByLabel('Opening balance').pressSequentially('100')
  await account.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(account).toBeHidden()
  await expect(card(page, 'Wallet')).toContainText('zł 100.00')

  await page.goto('/transactions')
  await addTransaction(page, 'Income', '40.00', 'Salary', 'Pay')
  await addTransaction(page, 'Expense', '12.50', 'Groceries', 'Bread')

  await page.goto('/')
  const stats = section(page, 'Summary')
  await expect(stats.getByTestId('overview-income')).toContainText('zł 40.00')
  await expect(stats.getByTestId('overview-expense')).toContainText('zł 12.50')
  const recent = section(page, 'Recent transactions')
  await expect(recent.getByText('Bread', { exact: true })).toBeVisible()
  await expect(recent.getByText('Pay', { exact: true })).toBeVisible()
  await expect(section(page, 'Spending by category').getByText('Groceries').first()).toBeVisible()

  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await expect(stats.getByTestId('overview-income')).toContainText('zł 40.00')
  await expect(stats.getByTestId('overview-expense')).toContainText('zł 12.50')
  await expect(page.getByText('Something went wrong')).toHaveCount(0)

  await page.goto('/reports')
  await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible()
  const figures = section(page, 'Key figures').first()
  await expect(figures.getByTestId('report-average-income')).toContainText('zł 6.67')
  await expect(figures.getByTestId('report-average-expense')).toContainText('zł 2.08')
  await expect(figures.getByTestId('report-savings-rate')).toContainText('69%')
  await expect(
    page.getByRole('img', { name: /total income zł 40\.00, total expenses zł 12\.50/ }).first(),
  ).toBeVisible()
  await expect(page.getByTestId('report-structure-rows')).toContainText('Groceries')
  await expect(page.getByText('Something went wrong')).toHaveCount(0)

  await page.goto('/settings')
  await section(page, 'Data').getByRole('button', { name: 'Delete account' }).click()
  const remove = page.getByRole('dialog', { name: 'Delete account' })
  await remove.getByLabel('Password', { exact: true }).fill(password)
  await remove.getByRole('button', { name: 'Delete account' }).click()
  await expect(page).toHaveURL('/login')
})
