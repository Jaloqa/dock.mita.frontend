import { expect, type Locator, type Page, test } from '@playwright/test'

const name = 'Accounts Smoke'
const email = `accounts-${Date.now()}@example.com`
const password = 'accounts-smoke-password'

const card = (page: Page, title: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
const section = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })

const choose = async (page: Page, combobox: Locator, option: string) => {
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await combobox.click()
  await page.getByRole('listbox').getByRole('option', { name: option, exact: true }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(combobox).toBeFocused()
}

const addAccount = async (page: Page, title: string, type: 'Card' | 'Cash', balance: string, last4?: string) => {
  await page.getByRole('button', { name: 'Add account', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'New account' })
  await dialog.getByLabel('Name', { exact: true }).fill(title)
  await dialog.getByRole('button', { name: type, exact: true }).click()
  if (last4) await dialog.getByLabel('Last 4 digits of the card').fill(last4)
  await dialog.getByLabel('Opening balance').pressSequentially(balance)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(card(page, title)).toBeVisible()
}

test('a real account manages accounts and transfers against the backend', async ({ page }) => {
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

  await addAccount(page, 'Cash', 'Cash', '100')
  await expect(card(page, 'Cash')).toContainText('zł 100.00')
  await addAccount(page, 'Card', 'Card', '0', '4821')
  await expect(card(page, 'Card')).toContainText('•••• 4821')

  await page.getByRole('button', { name: 'Transfer', exact: true }).first().click()
  const transfer = page.getByRole('dialog', { name: 'Transfer' })
  await choose(page, transfer.getByRole('combobox', { name: 'From' }), 'Cash · PLN')
  await choose(page, transfer.getByRole('combobox', { name: 'To' }), 'Card · PLN')
  const amount = transfer.getByLabel('Amount')
  await amount.pressSequentially('25')
  await expect(amount).toHaveValue(/25\.00/)
  await transfer.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(transfer).toBeHidden()
  await expect(card(page, 'Cash')).toContainText('zł 75.00')
  await expect(card(page, 'Card')).toContainText('zł 25.00')
  const latest = section(page, 'Transfers between accounts').getByRole('listitem').first()
  await expect(latest).toContainText('Cash → Card')
  await expect(latest).toContainText('zł 25.00')

  await card(page, 'Cash').getByRole('button', { name: 'Edit Cash' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit account' })
  await expect(edit.getByRole('button', { name: 'Delete' })).toHaveCount(0)
  await edit.getByRole('button', { name: 'Archive' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click()
  await expect(card(page, 'Cash')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show archived (1)' }).click()
  await expect(card(page, 'Cash')).toBeVisible()

  await page.goto('/settings')
  await section(page, 'Data').getByRole('button', { name: 'Delete account' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete account' })
  await dialog.getByLabel('Password', { exact: true }).fill(password)
  await dialog.getByRole('button', { name: 'Delete account' }).click()
  await expect(page).toHaveURL('/login')
})
