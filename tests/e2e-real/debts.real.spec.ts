import { expect, type Locator, type Page, test } from '@playwright/test'
import { pickOverlayOption } from '../e2e/overlayOption'

const name = 'Debts Smoke'
const email = `debts-${Date.now()}@example.com`
const password = 'debts-smoke-password'

const dayFromToday = (offset: number) => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
}
const typedDay = (offset: number) =>
  dayFromToday(offset).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
const shownDay = (offset: number) =>
  dayFromToday(offset).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

const card = (page: Page, title: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
const section = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })
const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true })
const summary = (page: Page, key: 'owed-to-me' | 'owed-by-me' | 'overdue') => page.getByTestId(`debts-summary-${key}`)

const setDay = async (field: Locator, offset: number) => {
  await field.fill(typedDay(offset))
  await field.press('Escape')
}

const openNewDebt = async (page: Page) => {
  await page.getByRole('button', { name: 'New debt', exact: true }).first().click()
  return page.getByRole('dialog', { name: 'New debt' })
}

const saveDebt = async (dialog: Locator) => {
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()
}

const openRepayment = async (page: Page, who: string, title: string) => {
  await card(page, who)
    .getByRole('button', { name: `Record a repayment for ${who}`, exact: true })
    .click()
  return page.getByRole('dialog', { name: title })
}

test('real private debts flow through the backend', async ({ page }) => {
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
  await account.getByLabel('Opening balance').pressSequentially('1000')
  await account.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(account).toBeHidden()
  await expect(card(page, 'Wallet')).toContainText('zł 1,000.00')

  await mainNav(page).getByRole('link', { name: 'Tools', exact: true }).click()
  await expect(page).toHaveURL('/tools')
  await expect(page.getByRole('heading', { level: 1, name: 'Tools', exact: true })).toBeVisible()
  await page.getByRole('list', { name: 'Tools', exact: true }).getByRole('link', { name: 'Debts', exact: true }).click()
  await expect(page).toHaveURL('/tools/debts')
  await expect(page.getByRole('heading', { level: 1, name: 'Debts', exact: true })).toBeVisible()
  await expect(page.getByText('No open debts')).toBeVisible()

  const lend = await openNewDebt(page)
  await lend.getByRole('button', { name: 'I lent', exact: true }).click()
  await lend.getByLabel('Who', { exact: true }).fill('Max')
  await lend.getByLabel('Amount', { exact: true }).pressSequentially('200')
  await setDay(lend.getByLabel('Date', { exact: true }), -3)
  await setDay(lend.getByLabel('Due date', { exact: true }), -2)
  await lend.getByRole('combobox', { name: 'Account' }).click()
  await pickOverlayOption(page, 'Wallet · PLN')
  await expect(lend.getByText('The amount leaves this account.')).toBeVisible()
  await saveDebt(lend)
  const max = card(page, 'Max')
  await expect(max).toContainText('Owed to me')
  await expect(max).toContainText('zł 200.00')
  await expect(max).toContainText('Wallet')
  await expect(max.locator('[data-overdue]')).toHaveText(`Overdue · due ${shownDay(-2)}`)
  await expect(summary(page, 'overdue')).toHaveText(/^\s*Overdue\s*1\s*$/)

  await page.goto('/accounts')
  await expect(card(page, 'Wallet')).toContainText('zł 800.00')

  await page.goto('/tools/debts')
  const repay = await openRepayment(page, 'Max', 'Repayment from Max')
  await expect(repay.getByRole('combobox', { name: 'Account' })).toContainText('Wallet · PLN')
  await expect(repay.getByText('Left to repay: zł 200.00')).toBeVisible()
  await repay.getByLabel('Amount', { exact: true }).pressSequentially('50')
  await repay.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(repay).toBeHidden()
  await expect(max).toContainText('zł 150.00')
  await expect(max).toContainText('of zł 200.00')
  await expect(max.locator('[data-overdue]')).toBeVisible()

  await page.goto('/accounts')
  await expect(card(page, 'Wallet')).toContainText('zł 850.00')

  await page.goto('/tools/debts')
  const borrow = await openNewDebt(page)
  await borrow.getByRole('button', { name: 'I borrowed', exact: true }).click()
  await expect(borrow.getByText('The amount enters this account.')).toBeVisible()
  await borrow.getByLabel('Who', { exact: true }).fill('Bank')
  await borrow.getByLabel('Amount', { exact: true }).pressSequentially('100')
  await expect(borrow.getByRole('combobox', { name: 'Account' })).toContainText('No account')
  await saveDebt(borrow)
  await expect(card(page, 'Bank')).toContainText('I owe')
  await expect(card(page, 'Bank')).toContainText('zł 100.00')
  await expect(summary(page, 'owed-to-me')).toContainText('zł 150.00')
  await expect(summary(page, 'owed-by-me')).toContainText('zł 100.00')

  await page.goto('/accounts')
  await expect(card(page, 'Wallet')).toContainText('zł 850.00')

  await page.goto('/')
  const debts = section(page, 'Debts')
  await expect(debts.getByTestId('overview-owed-to-me')).toHaveText(/^zł\s150\.00$/)
  await expect(debts.getByTestId('overview-owed-by-me')).toHaveText(/^zł\s100\.00$/)
  await expect(debts).toContainText('1 overdue')
  const stats = section(page, 'Summary')
  await expect(stats.getByTestId('overview-income')).toContainText('zł 0.00')
  await expect(stats.getByTestId('overview-expense')).toContainText('zł 0.00')
  const balance = stats.getByTestId('overview-balance')
  await expect(balance).toContainText('Total balance')
  await expect(balance).toContainText('zł 850.00')
  await debts.getByRole('switch', { name: 'Include debts in the balance' }).check()
  await expect(balance).toContainText('Balance with debts')
  await expect(balance).toContainText('zł 900.00')

  await page.goto('/tools/debts')
  const settle = await openRepayment(page, 'Max', 'Repayment from Max')
  await settle.getByRole('button', { name: 'Repay the rest', exact: true }).click()
  await expect(settle.getByLabel('Amount', { exact: true })).toHaveValue(/150\.00$/)
  await settle.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(settle).toBeHidden()
  await expect(card(page, 'Max')).toHaveCount(0)
  await expect(card(page, 'Bank')).toBeVisible()
  await expect(summary(page, 'overdue')).toHaveText(/^\s*Overdue\s*0\s*$/)
  await expect(summary(page, 'owed-to-me')).toContainText('zł 0.00')
  await page.getByRole('button', { name: 'Settled', exact: true }).click()
  await expect(card(page, 'Max')).toContainText('zł 0.00')
  await expect(card(page, 'Max')).toContainText('of zł 200.00')
  await expect(card(page, 'Bank')).toHaveCount(0)

  await page.goto('/accounts')
  await expect(card(page, 'Wallet')).toContainText('zł 1,000.00')

  await page.goto('/tools/debts')
  await card(page, 'Bank').getByRole('button', { name: 'Edit Bank', exact: true }).click()
  await page.getByRole('dialog', { name: 'Edit debt' }).getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(card(page, 'Bank')).toHaveCount(0)
  await expect(summary(page, 'owed-by-me')).toContainText('zł 0.00')

  await page.goto('/settings')
  await section(page, 'Data').getByRole('button', { name: 'Delete account' }).click()
  const remove = page.getByRole('dialog', { name: 'Delete account' })
  await remove.getByLabel('Password', { exact: true }).fill(password)
  await remove.getByRole('button', { name: 'Delete account' }).click()
  await expect(page).toHaveURL('/login')
})
