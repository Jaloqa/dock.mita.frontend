import { expect, type Locator, type Page, test } from '@playwright/test'
import { pickOverlayOption } from '../e2e/overlayOption'

const stamp = Date.now()
const ownerName = 'Ledger Owner'
const ownerEmail = `group-accounting-owner-${stamp}@example.com`
const guestName = 'Ledger Guest'
const guestEmail = `group-accounting-guest-${stamp}@example.com`
const password = 'group-accounting-smoke-password'

const section = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })
const overlay = (page: Page) => page.locator('[data-pc-section="overlay"]')
const card = (page: Page, title: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
const saveButton = (dialog: Locator) => dialog.getByRole('button', { name: 'Save', exact: true })

const toConfirm = (page: Page) => section(page, 'To confirm')
const toConfirmItem = (page: Page, title: string) => toConfirm(page).getByRole('article', { name: title, exact: true })

const groupTitle = (page: Page) => page.getByRole('heading', { level: 1, name: 'Kraków', exact: true })

const register = async (page: Page, userName: string, userEmail: string) => {
  await page.goto('/register')
  const create = page.getByRole('button', { name: 'Create account', exact: true })
  await expect(create).toBeEnabled()
  await page.getByLabel('Name', { exact: true }).fill(userName)
  await page.getByLabel('Email', { exact: true }).fill(userEmail)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await create.click()
  await expect(page).toHaveURL('/')
}

const deleteAccount = async (page: Page) => {
  await page.goto('/settings')
  await section(page, 'Data').getByRole('button', { name: 'Delete account' }).click()
  const account = page.getByRole('dialog', { name: 'Delete account' })
  await account.getByLabel('Password', { exact: true }).fill(password)
  await account.getByRole('button', { name: 'Delete account' }).click()
  await expect(page).toHaveURL('/login')
}

const addAccount = async (page: Page, title: string, balance: string) => {
  await page.getByRole('button', { name: 'Add account', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'New account' })
  await dialog.getByLabel('Name', { exact: true }).fill(title)
  await dialog.getByRole('button', { name: 'Cash', exact: true }).click()
  await dialog.getByLabel('Opening balance').pressSequentially(balance)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(card(page, title)).toContainText(
    `zł ${Number(balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
  )
}

const openAccounts = async (page: Page) => {
  await page.goto('/accounts')
  await expect(page.getByRole('heading', { level: 1, name: 'Accounts' })).toBeVisible()
}

const chooseMember = async (page: Page, dialog: Locator, label: string, member: string) => {
  const field = dialog.getByRole('combobox', { name: label, exact: true })
  await field.click()
  await pickOverlayOption(page, member)
  await expect(field).toContainText(member)
  await expect(overlay(page)).toHaveCount(0)
}

const chooseCurrency = async (page: Page, field: Locator, query: string, option: string) => {
  await field.click()
  await overlay(page).getByRole('searchbox', { name: 'Search by code or name' }).fill(query)
  await pickOverlayOption(page, option)
  await expect(field).toHaveAttribute('aria-expanded', 'false')
  await expect(overlay(page)).toHaveCount(0)
}

const openToConfirm = async (page: Page) => {
  await page.goto('/tools/groups')
  await expect(toConfirm(page)).toBeVisible()
}

const openConfirmDialog = async (page: Page, title: string) => {
  await openToConfirm(page)
  await toConfirmItem(page, title)
    .getByRole('button', { name: `Confirm ${title}`, exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: `Confirm ${title}`, exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

const chooseConfirmAccount = async (page: Page, dialog: Locator, name: string) => {
  await dialog.getByRole('combobox', { name: 'Account', exact: true }).click()
  await pickOverlayOption(page, name)
  await expect(dialog.getByLabel('Exchange rate (EUR → PLN)', { exact: true })).toHaveValue(/^4\.30/)
}

const submitConfirmation = async (page: Page, dialog: Locator) => {
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Added to your accounts', { exact: true })).toBeVisible()
  await expect(dialog).toBeHidden()
}

const expectOverview = async (page: Page, income: string, expense: string) => {
  await page.goto('/')
  const stats = section(page, 'Summary')
  await expect(stats.getByTestId('overview-income')).toContainText(income)
  await expect(stats.getByTestId('overview-expense')).toContainText(expense)
}

test('real group activity reaches personal records through To confirm', async ({ page, browser }) => {
  await register(page, ownerName, ownerEmail)
  await openAccounts(page)
  await addAccount(page, 'Konto A', '1000')

  await page.goto('/tools/groups')
  await page.getByRole('button', { name: 'Create a group', exact: true }).click()
  const created = page.getByRole('dialog', { name: 'New group', exact: true })
  await created.getByLabel('Name', { exact: true }).fill('Kraków')
  await chooseCurrency(page, created.getByRole('combobox', { name: 'Main currency' }), 'euro', 'EUR — Euro')
  const member = (number: number) => created.getByRole('textbox', { name: `Member ${number}`, exact: true })
  await expect(member(1)).toHaveValue(ownerName)
  await created.getByRole('button', { name: 'Add member', exact: true }).click()
  await member(2).fill('Bartek')
  await created.getByRole('button', { name: 'Add member', exact: true }).click()
  await member(3).fill('Ola')
  await saveButton(created).click()
  await expect(page.getByText('Group created')).toBeVisible()
  await expect(page).toHaveURL(/\/tools\/groups\/[^/]+$/)
  await expect(groupTitle(page)).toBeVisible()
  const groupUrl = new URL(page.url()).pathname

  await page.getByRole('button', { name: 'Members', exact: true }).click()
  const members = page.getByRole('dialog', { name: 'Members', exact: true })
  await members.getByRole('button', { name: `This is me: ${ownerName}`, exact: true }).click()
  await expect(page.getByText('Linked to you', { exact: true })).toBeVisible()
  await members.getByRole('button', { name: 'Invite Bartek', exact: true }).click()
  await members.getByLabel('Email of Bartek', { exact: true }).fill(guestEmail)
  await members.getByRole('button', { name: 'Send invitation', exact: true }).click()
  await expect(page.getByText('Invitation sent', { exact: true })).toBeVisible()
  await members.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(members).toBeHidden()

  const guestContext = await browser.newContext()
  try {
    const guest = await guestContext.newPage()
    await register(guest, guestName, guestEmail)
    await openAccounts(guest)
    await addAccount(guest, 'Konto B', '500')

    await guest.goto('/tools/groups')
    const invitations = section(guest, 'Invitations')
    await invitations.getByRole('button', { name: 'Accept the invitation to Kraków', exact: true }).click()
    await expect(guest.getByText('You joined “Kraków”', { exact: true })).toBeVisible()

    await page.goto('/budgets')
    await expect(page.getByText('No budgets for this period')).toBeVisible()
    await page.getByRole('button', { name: 'Create a budget', exact: true }).click()
    const budget = page.getByRole('dialog', { name: 'New budget' })
    await budget.getByRole('combobox', { name: 'Category' }).click()
    await pickOverlayOption(page, 'Cafes')
    await budget.getByLabel('Monthly limit').pressSequentially('500')
    await budget.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(budget).toBeHidden()
    await expect(card(page, 'Cafes')).toContainText('of zł 500.00')

    await page.goto(groupUrl)
    await expect(groupTitle(page)).toBeVisible()
    await page.getByRole('button', { name: 'Add expense', exact: true }).first().click()
    const dinner = page.getByRole('dialog', { name: 'New expense', exact: true })
    await chooseMember(page, dinner, 'Paid by', ownerName)
    await dinner.getByLabel('Amount', { exact: true }).pressSequentially('90')
    await chooseMember(page, dinner, 'Category', 'Cafes')
    await dinner.getByLabel('Description', { exact: true }).fill('Dinner')
    await saveButton(dinner).click()
    await expect(page.getByText('Expense added')).toBeVisible()
    await expect(dinner).toBeHidden()

    await openAccounts(page)
    await expect(card(page, 'Konto A')).toContainText('zł 1,000.00')
    await expectOverview(page, 'zł 0.00', 'zł 0.00')

    const ownerDinner = await openConfirmDialog(page, 'Dinner')
    await chooseConfirmAccount(page, ownerDinner, 'Konto A · PLN')
    await expect(ownerDinner.getByRole('combobox', { name: 'Category', exact: true })).toContainText('Cafes')
    await submitConfirmation(page, ownerDinner)

    await openAccounts(page)
    await expect(card(page, 'Konto A')).toContainText('zł 613.00')
    await expectOverview(page, 'zł 0.00', 'zł 129.00')
    await page.goto('/budgets')
    await expect(card(page, 'Cafes')).toContainText('zł 129.00')

    await guest.goto(groupUrl)
    await expect(groupTitle(guest)).toBeVisible()
    await guest.getByRole('button', { name: 'Settle up', exact: true }).click()
    const settle = guest.getByRole('dialog', { name: 'Settle up', exact: true })
    await expect(settle.getByText(`You owe ${ownerName}`, { exact: true })).toBeVisible()
    await settle.getByRole('checkbox', { name: 'Dinner €30.00', exact: true }).check()
    await settle.getByRole('button', { name: 'Mark as paid', exact: true }).click()
    await expect(guest.getByText('Payment recorded', { exact: true })).toBeVisible()
    await expect(settle).toBeHidden()

    const payment = await openConfirmDialog(guest, `Payment to ${ownerName}`)
    await expect(payment.getByText('Dinner · €30.00', { exact: true })).toBeVisible()
    await chooseConfirmAccount(guest, payment, 'Konto B · PLN')
    await expect(payment.getByRole('combobox', { name: 'Category', exact: true })).toContainText('Cafes')
    await submitConfirmation(guest, payment)

    await openAccounts(guest)
    await expect(card(guest, 'Konto B')).toContainText('zł 371.00')
    await expectOverview(guest, 'zł 0.00', 'zł 129.00')

    const received = await openConfirmDialog(page, 'Payment from Bartek')
    await expect(received.getByText('€30.00').first()).toBeVisible()
    await chooseConfirmAccount(page, received, 'Konto A · PLN')
    await submitConfirmation(page, received)

    await openAccounts(page)
    await expect(card(page, 'Konto A')).toContainText('zł 742.00')
    await expectOverview(page, 'zł 0.00', 'zł 129.00')

    await page.goto('/tools/debts')
    await expect(page.getByRole('heading', { level: 1, name: 'Debts', exact: true })).toBeVisible()
    const line = section(page, 'Groups').getByRole('link', { name: 'Kraków', exact: true })
    await expect(line).toContainText('+€30.00')
    await expect(line).toContainText('You get back')

    await deleteAccount(guest)
  } finally {
    await guestContext.close()
  }

  await page.goto(groupUrl)
  await expect(groupTitle(page)).toBeVisible()
  await page.getByRole('button', { name: 'Edit group', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Edit group', exact: true })
  await settings.getByRole('button', { name: 'Delete group', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete group', exact: true }).click()
  await expect(page).toHaveURL('/tools/groups')
  await expect(page.getByText('Group deleted')).toBeVisible()

  await deleteAccount(page)
})
