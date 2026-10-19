import { expect, type Locator, type Page, test } from '@playwright/test'

const name = 'Transactions Smoke'
const email = `transactions-${Date.now()}@example.com`
const password = 'transactions-smoke-password'

const card = (page: Page, title: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
const section = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })
const rowOf = (page: Page, title: string) => section(page, 'Transactions').getByRole('row').filter({ hasText: title })

const choose = async (page: Page, combobox: Locator, option: string | RegExp) => {
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await combobox.click()
  await page.getByRole('listbox').getByRole('option', { name: option }).click()
}

const typeAmount = async (field: Locator, amount: string) => {
  await field.click()
  await field.press('ControlOrMeta+a')
  await field.pressSequentially(amount)
}

test('real categories and transactions flow through the backend', async ({ page }) => {
  await page.goto('/register')
  const create = page.getByRole('button', { name: 'Create account', exact: true })
  await expect(create).toBeEnabled()
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await create.click()
  await expect(page).toHaveURL('/')

  await page.goto('/transactions')
  await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible()
  await expect(page.getByText('No transactions yet')).toBeVisible()

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
  await page.getByRole('button', { name: 'Add your first transaction', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await dialog.getByLabel('Amount', { exact: true }).pressSequentially('12.50')
  await choose(page, dialog.getByRole('combobox', { name: 'Account' }), /^Wallet/)
  await choose(page, dialog.getByRole('combobox', { name: 'Category' }), 'Groceries')
  await dialog.getByLabel('Description', { exact: true }).fill('Bread')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(rowOf(page, 'Bread')).toBeVisible()
  await expect(rowOf(page, 'Bread')).toContainText('Wallet')

  await page.goto('/accounts')
  await expect(card(page, 'Wallet')).toContainText('zł 87.50')

  await page.goto('/transactions')
  const search = page.locator('#transactions-search')
  await search.fill('groc')
  await expect(rowOf(page, 'Bread')).toBeVisible()
  await search.fill('zzz')
  await expect(page.getByText('Nothing found')).toBeVisible()
  await search.fill('')
  await expect(rowOf(page, 'Bread')).toBeVisible()

  await rowOf(page, 'Bread').click()
  const edit = page.getByRole('dialog', { name: 'Edit transaction' })
  await typeAmount(edit.getByLabel('Amount', { exact: true }), '20.00')
  await edit.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(edit).toBeHidden()
  await page.goto('/accounts')
  await expect(card(page, 'Wallet')).toContainText('zł 80.00')

  await page.goto('/settings')
  await section(page, 'Data').getByRole('button', { name: 'Manage categories' }).click()
  const categories = page.getByRole('dialog', { name: 'Categories' })
  await categories.getByRole('tab', { name: 'Expenses' }).click()
  await categories.getByRole('button', { name: 'Add category' }).click()
  const form = categories.getByRole('form', { name: 'New category' })
  await form.getByLabel('Name', { exact: true }).fill('Pets')
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(categories.getByRole('button', { name: 'Edit Pets' })).toBeVisible()
  await categories.getByRole('button', { name: 'Delete Groceries' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(categories.getByRole('button', { name: 'Edit Groceries' })).toHaveCount(0)
  await categories.getByRole('button', { name: 'Close' }).click()
  await expect(categories).toBeHidden()

  await page.goto('/transactions')
  await expect(rowOf(page, 'Bread')).toContainText('Other')
  await rowOf(page, 'Bread').click()
  await page
    .getByRole('dialog', { name: 'Edit transaction' })
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('No transactions yet')).toBeVisible()
  await page.goto('/accounts')
  await expect(card(page, 'Wallet')).toContainText('zł 100.00')

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
  await page.goto('/budgets')
  await expect(page.getByRole('heading', { level: 1, name: 'Budgets' })).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)

  await page.goto('/settings')
  await section(page, 'Data').getByRole('button', { name: 'Delete account' }).click()
  const remove = page.getByRole('dialog', { name: 'Delete account' })
  await remove.getByLabel('Password', { exact: true }).fill(password)
  await remove.getByRole('button', { name: 'Delete account' }).click()
  await expect(page).toHaveURL('/login')
})
