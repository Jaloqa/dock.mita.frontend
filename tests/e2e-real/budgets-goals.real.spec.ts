import { expect, type Locator, type Page, test } from '@playwright/test'

const name = 'Budgets Goals Smoke'
const email = `budgets-goals-${Date.now()}@example.com`
const password = 'budgets-goals-smoke-password'

const card = (page: Page, title: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
const section = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })

const choose = async (page: Page, combobox: Locator, option: string | RegExp) => {
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await combobox.click()
  await page.getByRole('listbox').getByRole('option', { name: option }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(combobox).toBeFocused()
}

const typeAmount = async (field: Locator, amount: string) => {
  await field.click()
  await field.press('ControlOrMeta+a')
  await field.pressSequentially(amount)
}

const addAccount = async (page: Page, title: string, type: 'Cash' | 'Savings', balance: string) => {
  await page.getByRole('button', { name: 'Add account', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'New account' })
  await dialog.getByLabel('Name', { exact: true }).fill(title)
  await dialog.getByRole('button', { name: type, exact: true }).click()
  await dialog.getByLabel('Opening balance').pressSequentially(balance)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(card(page, title)).toBeVisible()
}

test('real budgets and goals flow through the backend', async ({ page }) => {
  await page.goto('/register')
  const create = page.getByRole('button', { name: 'Create account', exact: true })
  await expect(create).toBeEnabled()
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await create.click()
  await expect(page).toHaveURL('/')

  await page.goto('/accounts')
  await expect(page.getByText('No accounts yet')).toBeVisible()
  await addAccount(page, 'Wallet', 'Cash', '100')
  await expect(card(page, 'Wallet')).toContainText('zł 100.00')
  await addAccount(page, 'Savings', 'Savings', '0')
  await expect(card(page, 'Savings')).toContainText('zł 0.00')

  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Add your first transaction', exact: true }).click()
  const transaction = page.getByRole('dialog', { name: 'New transaction' })
  await transaction.getByLabel('Amount', { exact: true }).pressSequentially('12.50')
  await choose(page, transaction.getByRole('combobox', { name: 'Account' }), /^Wallet/)
  await choose(page, transaction.getByRole('combobox', { name: 'Category' }), 'Groceries')
  await transaction.getByLabel('Description', { exact: true }).fill('Bread')
  await transaction.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(transaction).toBeHidden()
  await expect(section(page, 'Transactions').getByRole('row').filter({ hasText: 'Bread' })).toBeVisible()

  await page.goto('/budgets')
  await expect(page.getByRole('heading', { level: 1, name: 'Budgets' })).toBeVisible()
  await expect(page.getByText('No budgets for this period')).toBeVisible()
  await page.getByRole('button', { name: 'Create a budget', exact: true }).click()
  const budget = page.getByRole('dialog', { name: 'New budget' })
  await choose(page, budget.getByRole('combobox', { name: 'Category' }), 'Groceries')
  await budget.getByLabel('Monthly limit').pressSequentially('50')
  await budget.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(budget).toBeHidden()
  await expect(card(page, 'Groceries')).toContainText('zł 12.50')
  await expect(card(page, 'Groceries')).toContainText('of zł 50.00')
  await expect(card(page, 'Groceries')).toContainText('On track')

  await page.getByRole('button', { name: 'Edit budget Groceries', exact: true }).click()
  const editBudget = page.getByRole('dialog', { name: 'Edit budget' })
  await typeAmount(editBudget.getByLabel('Monthly limit'), '10')
  await editBudget.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editBudget).toBeHidden()
  await expect(card(page, 'Groceries')).toContainText('of zł 10.00')
  await expect(card(page, 'Groceries')).toContainText('Over budget')

  await page.goto('/goals')
  await expect(page.getByRole('heading', { level: 1, name: 'Goals' })).toBeVisible()
  await expect(page.getByText('No goals yet')).toBeVisible()
  await page.getByRole('button', { name: 'Create a goal', exact: true }).click()
  const goal = page.getByRole('dialog', { name: 'New goal' })
  await goal.getByLabel('Name', { exact: true }).fill('Bike')
  await goal.getByLabel('Target amount').pressSequentially('500')
  await choose(page, goal.getByRole('combobox', { name: 'Savings account' }), /^Savings/)
  await goal.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(goal).toBeHidden()
  await expect(card(page, 'Bike')).toContainText('zł 500.00')

  await page.getByRole('button', { name: 'Contribute to Bike', exact: true }).click()
  const contribution = page.getByRole('dialog', { name: 'Contribute to Bike' })
  await contribution.getByLabel('Amount', { exact: true }).pressSequentially('20')
  await choose(page, contribution.getByRole('combobox', { name: 'From account' }), /^Wallet/)
  await contribution.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(contribution).toBeHidden()
  await expect(card(page, 'Bike')).toContainText('zł 20.00')

  await page.goto('/accounts')
  await expect(card(page, 'Savings')).toContainText('zł 20.00')
  await expect(card(page, 'Wallet')).toContainText('zł 67.50')

  await page.goto('/goals')
  await page.getByRole('button', { name: 'Edit Bike', exact: true }).click()
  await page.getByRole('dialog', { name: 'Edit goal' }).getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('No goals yet')).toBeVisible()

  await page.goto('/budgets')
  await page.getByRole('button', { name: 'Edit budget Groceries', exact: true }).click()
  await page.getByRole('dialog', { name: 'Edit budget' }).getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('No budgets for this period')).toBeVisible()

  await page.goto('/settings')
  await section(page, 'Data').getByRole('button', { name: 'Delete account' }).click()
  const remove = page.getByRole('dialog', { name: 'Delete account' })
  await remove.getByLabel('Password', { exact: true }).fill(password)
  await remove.getByRole('button', { name: 'Delete account' }).click()
  await expect(page).toHaveURL('/login')
})
