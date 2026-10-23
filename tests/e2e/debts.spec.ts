import { expect, type Page, test } from '@playwright/test'
import { overlayOption, pickOverlayOption } from './overlayOption'

const dayFromToday = (offset: number) => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
const debtsRegion = (page: Page) => page.getByRole('region', { name: 'Personal debts', exact: true })
const cards = (page: Page) => debtsRegion(page).getByRole('article')
const card = (page: Page, name: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
const summary = (page: Page, key: 'owed-to-me' | 'owed-by-me' | 'overdue') => page.getByTestId(`debts-summary-${key}`)

const openNewDebt = async (page: Page) => {
  await page.goto('/tools/debts')
  await expect(cards(page)).toHaveCount(3)
  await page.getByRole('button', { name: 'New debt' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'New debt' })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  return dialog
}

const lendToOlaFromCash = async (page: Page) => {
  const dialog = await openNewDebt(page)
  await dialog.getByRole('button', { name: 'I lent', exact: true }).click()
  await dialog.getByLabel('Who', { exact: true }).fill('Ola')
  await dialog.getByLabel('Amount').pressSequentially('100')
  await dialog.getByRole('combobox', { name: 'Account' }).click()
  await pickOverlayOption(page, 'Gotówka · PLN')
  await expect(dialog.getByText('The amount leaves this account.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Debt saved')).toBeVisible()
  await expect(card(page, 'Ola')).toContainText('zł 100.00')
}

const cashBalance = async (page: Page, amount: string) => {
  await page.goto('/accounts')
  await expect(card(page, 'Gotówka')).toContainText(amount)
}

test('shows the seeded debts with the overdue one highlighted', async ({ page }) => {
  await page.goto('/tools/debts')
  await expect(page.getByRole('heading', { level: 1, name: 'Debts', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Debts · Mita')
  await expect(summary(page, 'owed-by-me')).toContainText('I owe')
  await expect(summary(page, 'owed-by-me')).toContainText('zł 1,500.00')
  await expect(summary(page, 'owed-to-me')).toContainText('Owed to me')
  await expect(summary(page, 'overdue')).toHaveText(/^\s*Overdue\s*1\s*$/)
  await expect(cards(page).getByRole('heading')).toHaveText(['Kasia', 'Max', 'Mama'])

  const kasia = card(page, 'Kasia')
  await expect(kasia.locator('[data-overdue]')).toHaveText(`Overdue · due ${dayFromToday(-5)}`)
  await expect(kasia).toContainText('€50.00')
  await expect(kasia).toContainText(`Since ${dayFromToday(-40)}`)
  await expect(kasia.getByRole('button', { name: 'Record a repayment for Kasia', exact: true })).toBeVisible()

  const max = card(page, 'Max')
  await expect(max).toContainText('Owed to me')
  await expect(max).toContainText('zł 400.00')
  await expect(max).toContainText('of zł 500.00')
  await expect(max).toContainText(`Due ${dayFromToday(10)}`)
  await expect(max).toContainText('Gotówka')
  await expect(max.locator('[data-overdue]')).toHaveCount(0)
  await expect(max.getByRole('progressbar', { name: 'Max: share repaid' })).toHaveAttribute('aria-valuenow', '20')
  const edit = max.getByRole('button', { name: 'Edit Max', exact: true })
  await expect(edit).toBeVisible()
  expect((await edit.boundingBox())?.height).toBeGreaterThanOrEqual(44)

  await expect(card(page, 'Mama')).toContainText('I owe')

  await page.getByRole('button', { name: 'Settled', exact: true }).click()
  await expect(cards(page).getByRole('heading')).toHaveText(['Tomek'])
  const tomek = card(page, 'Tomek')
  await expect(tomek.getByRole('button', { name: 'Record a repayment for Tomek' })).toHaveCount(0)
  await expect(tomek.getByRole('button', { name: 'Edit Tomek', exact: true })).toBeVisible()
  await expect(summary(page, 'owed-by-me')).toContainText('zł 1,500.00')
})

test('lends money from an account', async ({ page }) => {
  await lendToOlaFromCash(page)
  await expect(card(page, 'Ola')).toContainText('Owed to me')
  await cashBalance(page, 'zł 840.00')
})

test('borrows without an account', async ({ page }) => {
  await page.goto('/accounts')
  const total = page.getByTestId('accounts-total')
  await expect(total).toBeVisible()
  const before = await total.textContent()
  const dialog = await openNewDebt(page)
  await dialog.getByRole('button', { name: 'I borrowed', exact: true }).click()
  await expect(dialog.getByText('The amount enters this account.')).toBeVisible()
  await dialog.getByLabel('Who', { exact: true }).fill('Bank')
  await dialog.getByLabel('Amount').pressSequentially('300')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Debt saved')).toBeVisible()
  await expect(card(page, 'Bank')).toContainText('I owe')
  await expect(summary(page, 'owed-by-me')).toContainText('zł 1,800.00')
  await page.goto('/accounts')
  await expect(total).toHaveText(before ?? '')
})

test('edits and deletes a debt', async ({ page }) => {
  await lendToOlaFromCash(page)
  await card(page, 'Ola').getByRole('button', { name: 'Edit Ola', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit debt' })
  await expect(edit.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await expect(edit.getByLabel('Who', { exact: true })).toHaveValue('Ola')
  await expect(edit.getByRole('combobox', { name: 'Account' })).toContainText('Gotówka · PLN')
  const amount = edit.getByLabel('Amount')
  await amount.fill('')
  await amount.pressSequentially('120')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Debt updated')).toBeVisible()
  await expect(card(page, 'Ola')).toContainText('zł 120.00')
  await cashBalance(page, 'zł 820.00')

  await page.goto('/tools/debts')
  await card(page, 'Ola').getByRole('button', { name: 'Edit Ola', exact: true }).click()
  await edit.getByRole('button', { name: 'Delete' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Delete the debt?')
  await expect(confirm).toContainText('“Ola” and its repayments will be deleted. Account balances are restored.')
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Debt deleted')).toBeVisible()
  await expect(card(page, 'Ola')).toHaveCount(0)
  await expect(cards(page)).toHaveCount(3)
  const focused = page.locator(':focus')
  await expect(focused).toHaveAccessibleName('New debt')
  await expect(focused).toBeVisible()
  await cashBalance(page, 'zł 940.00')
})

test('prices a debt in another currency and keeps its rate on edit', async ({ page }) => {
  const dialog = await openNewDebt(page)
  await dialog.getByRole('button', { name: 'I lent', exact: true }).click()
  await dialog.getByLabel('Who', { exact: true }).fill('Eva')
  await dialog.getByRole('combobox', { name: 'Account' }).click()
  await pickOverlayOption(page, 'Gotówka · PLN')
  await expect(overlayOption(page, 'Gotówka · PLN')).toHaveCount(0)
  const converted = dialog.locator('p[aria-live="polite"]')
  await expect(converted).toHaveText('')
  await dialog.getByRole('combobox', { name: 'Currency' }).click()
  await pickOverlayOption(page, 'EUR — Euro')
  const rate = dialog.getByLabel('Exchange rate (EUR → PLN)')
  await expect(rate).toHaveValue(/^4[.,]/)
  await rate.fill('')
  await rate.pressSequentially('4.50')
  await dialog.getByLabel('Amount').pressSequentially('50')
  await expect(converted).toHaveText('On the account: zł 225.00')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Debt saved')).toBeVisible()
  await expect(card(page, 'Eva')).toContainText('€50.00')
  await cashBalance(page, 'zł 715.00')

  await page.goto('/tools/debts')
  await card(page, 'Eva').getByRole('button', { name: 'Edit Eva', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit debt' })
  await expect(edit.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await expect(edit.getByLabel('Exchange rate (EUR → PLN)')).toHaveValue('4.50')
  await edit.getByLabel('Note', { exact: true }).fill('Concert tickets')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Debt updated')).toBeVisible()
  await expect(card(page, 'Eva')).toContainText('Concert tickets')
  await cashBalance(page, 'zł 715.00')

  await page.goto('/tools/debts')
  await card(page, 'Max').getByRole('button', { name: 'Edit Max', exact: true }).click()
  await expect(edit.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  const currency = edit.getByRole('combobox', { name: 'Currency' })
  await expect(currency).toBeDisabled()
  await expect(edit.getByText('The currency cannot change once a repayment is recorded.')).toBeVisible()
  await expect(currency).toHaveAccessibleDescription('The currency cannot change once a repayment is recorded.')
})

test('refuses a due date before the date', async ({ page }) => {
  const dialog = await openNewDebt(page)
  await dialog.getByLabel('Who', { exact: true }).fill('Ola')
  await dialog.getByLabel('Amount').pressSequentially('100')
  const due = dialog.getByLabel('Due date', { exact: true })
  await due.fill('01/01/2020')
  await due.press('Escape')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('The due date cannot be before the date of the debt.')).toBeVisible()
  await expect(due).toHaveAttribute('aria-invalid', 'true')
  await expect(due).toBeFocused()
})

test('/pl/tools/debts shows the page in Polish', async ({ page }) => {
  await page.goto('/pl/tools/debts')
  await expect(page.getByRole('heading', { level: 1, name: 'Długi', exact: true })).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: 'Narzędzia', exact: true })).toHaveAttribute(
    'href',
    '/pl/tools',
  )
  await expect(card(page, 'Max')).toContainText(/400,00\s?zł/)
})
