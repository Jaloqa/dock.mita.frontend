import { expect, type Locator, type Page, test } from '@playwright/test'

const name = 'Tags Smoke'
const email = `tags-${Date.now()}@example.com`
const password = 'tags-smoke-password'

const card = (page: Page, title: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
const section = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })
const rowOf = (page: Page, title: string) => section(page, 'Transactions').getByRole('row').filter({ hasText: title })
const filters = (page: Page) => section(page, 'Filters')
const summary = (page: Page) => section(page, 'Filter summary')
const overlayOption = (page: Page, option: string) =>
  page.locator('[data-pc-section="overlay"]').getByRole('option', { name: option, exact: true })

const choose = async (page: Page, combobox: Locator, option: string | RegExp) => {
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await combobox.click()
  await page.getByRole('listbox').getByRole('option', { name: option }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(combobox).toBeFocused()
}

const addExpense = async (page: Page, amount: string, category: string, title: string, tags: string[]) => {
  await page.getByRole('button', { name: 'Add transaction', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await dialog.getByLabel('Amount', { exact: true }).pressSequentially(amount)
  await choose(page, dialog.getByRole('combobox', { name: 'Account' }), /^Wallet/)
  await choose(page, dialog.getByRole('combobox', { name: 'Category' }), category)
  await dialog.getByLabel('Description', { exact: true }).fill(title)
  const field = dialog.getByRole('combobox', { name: 'Tags' })
  for (const tag of tags) {
    await field.fill(tag)
    await expect(overlayOption(page, tag)).toBeVisible()
    await field.press('Enter')
    await expect(dialog.getByRole('button', { name: `Remove tag ${tag}`, exact: true })).toBeVisible()
  }
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(rowOf(page, title)).toBeVisible()
}

const chips = (page: Page, title: string) => rowOf(page, title).getByRole('list', { name: 'Tags' })

test('real tags flow through the backend', async ({ page }) => {
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
  await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible()
  await addExpense(page, '12.50', 'Groceries', 'Bread', ['food', 'weekly'])
  await addExpense(page, '30.00', 'Transport', 'Train', ['travel'])
  await expect(chips(page, 'Bread')).toContainText('food')
  await expect(chips(page, 'Bread')).toContainText('weekly')

  const tagFilter = filters(page).getByRole('combobox', { name: 'Tags' })
  await tagFilter.fill('food')
  await overlayOption(page, 'food').click()
  await expect(filters(page).getByRole('button', { name: 'Remove tag food', exact: true })).toBeVisible()
  await expect(rowOf(page, 'Bread')).toBeVisible()
  await expect(rowOf(page, 'Train')).toHaveCount(0)
  await expect(summary(page)).toContainText(/[-−]zł\s12\.50/)

  await filters(page).getByRole('button', { name: 'Remove tag food', exact: true }).click()
  await rowOf(page, 'Train').click()
  const edit = page.getByRole('dialog', { name: 'Edit transaction' })
  const editTags = edit.getByRole('combobox', { name: 'Tags' })
  await editTags.fill('fo')
  await overlayOption(page, 'food').click()
  await expect(edit.getByRole('button', { name: 'Remove tag food', exact: true })).toBeVisible()
  await edit.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(edit).toBeHidden()

  await tagFilter.fill('food')
  await overlayOption(page, 'food').click()
  await expect(rowOf(page, 'Bread')).toBeVisible()
  await expect(rowOf(page, 'Train')).toBeVisible()
  await expect(summary(page)).toContainText(/[-−]zł\s42\.50/)

  await page.goto('/settings')
  await section(page, 'Data').getByRole('button', { name: 'Manage tags' }).click()
  const manager = page.getByRole('dialog', { name: 'Tags' })
  await manager.getByRole('button', { name: 'Rename weekly' }).click()
  await manager.getByLabel('Name', { exact: true }).fill('groceries-run')
  await manager.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(manager.getByRole('button', { name: 'Rename groceries-run' })).toBeVisible()
  await manager.getByRole('button', { name: 'Delete travel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(manager.getByRole('button', { name: 'Rename travel' })).toHaveCount(0)
  await manager.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(manager).toBeHidden()

  await page.goto('/transactions')
  await expect(chips(page, 'Bread')).toContainText('groceries-run')
  await expect(chips(page, 'Bread')).toContainText('food')
  await expect(chips(page, 'Train')).toContainText('food')
  await expect(chips(page, 'Train')).not.toContainText('travel')

  await page.goto('/settings')
  await section(page, 'Data').getByRole('button', { name: 'Delete account' }).click()
  const remove = page.getByRole('dialog', { name: 'Delete account' })
  await remove.getByLabel('Password', { exact: true }).fill(password)
  await remove.getByRole('button', { name: 'Delete account' }).click()
  await expect(page).toHaveURL('/login')
})
