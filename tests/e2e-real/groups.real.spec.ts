import { expect, type Locator, type Page, test } from '@playwright/test'
import { pickOverlayOption } from '../e2e/overlayOption'

const name = 'Groups Smoke'
const email = `groups-${Date.now()}@example.com`
const linkName = 'Link Smoke'
const linkEmail = `groups-link-${Date.now()}@example.com`
const password = 'groups-smoke-password'
const DEAD_LINK = "This link does not work. Ask the group's owner for a new one."

const section = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })
const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true })
const overlay = (page: Page) => page.locator('[data-pc-section="overlay"]')

const expenses = (page: Page) => section(page, 'Expenses')
const row = (page: Page, title: string) => expenses(page).getByRole('article', { name: title, exact: true })
const titles = (page: Page) => expenses(page).getByRole('heading', { level: 3 })
const total = (page: Page) => page.getByTestId('group-summary-total')
const saveButton = (dialog: Locator) => dialog.getByRole('button', { name: 'Save', exact: true })
const amountField = (dialog: Locator) => dialog.getByLabel('Amount', { exact: true })

const balances = (page: Page) => section(page, 'Balances')
const balanceRow = (page: Page, member: string) =>
  balances(page)
    .getByRole('list', { name: 'Balance of each member', exact: true })
    .getByRole('listitem')
    .filter({ has: page.getByText(member, { exact: true }) })
const transferRows = (page: Page) =>
  balances(page).getByRole('list', { name: 'Suggested transfers', exact: true }).getByRole('listitem')
const recordButton = (page: Page, from: string, to: string) =>
  balances(page).getByRole('button', { name: `Record that ${from} paid ${to}`, exact: true })

const repayments = (page: Page) => section(page, 'Repayments')
const view = (scope: Locator, label: 'Active' | 'Deleted') => scope.getByRole('button', { name: label, exact: true })

const typeInto = async (field: Locator, text: string) => {
  await field.fill('')
  await field.pressSequentially(text)
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

const openNewExpense = async (page: Page) => {
  await page.getByRole('button', { name: 'Add expense', exact: true }).first().click()
  return page.getByRole('dialog', { name: 'New expense', exact: true })
}

const openEditExpense = async (page: Page, title: string) => {
  await row(page, title)
    .getByRole('button', { name: `Edit ${title}`, exact: true })
    .click()
  return page.getByRole('dialog', { name: 'Edit expense', exact: true })
}

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

test('real expense groups flow through the backend', async ({ page }) => {
  await register(page, name, email)

  await mainNav(page).getByRole('link', { name: 'Tools', exact: true }).click()
  await expect(page).toHaveURL('/tools')
  await page
    .getByRole('list', { name: 'Tools', exact: true })
    .getByRole('link', { name: 'Groups', exact: true })
    .click()
  await expect(page).toHaveURL('/tools/groups')
  await expect(page.getByRole('heading', { level: 1, name: 'Groups', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'No groups yet' })).toBeVisible()

  await page.getByRole('button', { name: 'Create a group', exact: true }).click()
  const group = page.getByRole('dialog', { name: 'New group', exact: true })
  await group.getByLabel('Name', { exact: true }).fill('Lisbon')
  await chooseCurrency(page, group.getByRole('combobox', { name: 'Main currency' }), 'euro', 'EUR — Euro')
  const member = (number: number) => group.getByRole('textbox', { name: `Member ${number}`, exact: true })
  await expect(member(1)).toHaveValue(name)
  await group.getByRole('button', { name: 'Add member', exact: true }).click()
  await member(2).fill('Olya')
  await group.getByRole('button', { name: 'Add member', exact: true }).click()
  await member(3).fill('Max')
  await saveButton(group).click()
  await expect(page.getByText('Group created')).toBeVisible()
  await expect(page).toHaveURL(/\/tools\/groups\/[^/]+$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Lisbon', exact: true })).toBeVisible()
  await expect(page.getByTestId('group-summary-members')).toContainText('3')

  const dinner = await openNewExpense(page)
  await chooseMember(page, dinner, 'Paid by', name)
  await amountField(dinner).pressSequentially('90')
  await dinner.getByLabel('Description', { exact: true }).fill('Dinner')
  await saveButton(dinner).click()
  await expect(dinner).toBeHidden()
  await expect(row(page, 'Dinner')).toContainText(`Paid by ${name}`)
  await expect(row(page, 'Dinner')).toContainText('€90.00')
  await expect(row(page, 'Dinner')).toContainText('Split equally between everyone')
  await expect(total(page)).toContainText('€90.00')
  await expect(balanceRow(page, name)).toContainText('+€60.00')
  await expect(balanceRow(page, name)).toContainText('gets back')
  await expect(balanceRow(page, 'Olya')).toContainText('-€30.00')
  await expect(balanceRow(page, 'Olya')).toContainText('owes')
  await expect(balanceRow(page, 'Max')).toContainText('-€30.00')

  const tickets = await openNewExpense(page)
  await chooseMember(page, tickets, 'Paid by', 'Olya')
  await amountField(tickets).pressSequentially('100')
  await tickets.getByRole('combobox', { name: 'Currency', exact: true }).click()
  await pickOverlayOption(page, 'PLN — Polish Zloty')
  await expect(tickets.getByLabel('Exchange rate (PLN → EUR)', { exact: true })).toHaveValue('0.232558')
  await expect(tickets.getByText('= €23.26', { exact: true })).toBeVisible()
  await tickets.getByLabel('Description', { exact: true }).fill('Tickets')
  await tickets.getByRole('button', { name: 'Exact amounts', exact: true }).click()
  await tickets.getByLabel('Olya', { exact: true }).pressSequentially('50')
  await tickets.getByLabel('Max', { exact: true }).pressSequentially('50')
  await expect(tickets.getByText(/^(Left to assign|Assigned too much)/)).toHaveCount(0)
  await saveButton(tickets).click()
  await expect(tickets).toBeHidden()
  await expect(titles(page)).toHaveText(['Tickets', 'Dinner'])
  await expect(row(page, 'Tickets')).toContainText('Paid by Olya')
  await expect(row(page, 'Tickets')).toContainText('zł 100.00')
  await expect(row(page, 'Tickets')).toContainText('= €23.26')
  await expect(row(page, 'Tickets')).toContainText('Exact amounts')
  await expect(total(page)).toContainText('€113.26')
  await expect(balanceRow(page, name)).toContainText('+€60.00')
  await expect(balanceRow(page, 'Olya')).toContainText('-€18.37')
  await expect(balanceRow(page, 'Max')).toContainText('-€41.63')
  await expect(transferRows(page)).toHaveCount(2)
  await expect(transferRows(page).nth(0)).toContainText(`Max pays ${name}`)
  await expect(transferRows(page).nth(0)).toContainText('€41.63')
  await expect(transferRows(page).nth(1)).toContainText(`Olya pays ${name}`)
  await expect(transferRows(page).nth(1)).toContainText('€18.37')

  await recordButton(page, 'Max', name).click()
  const repayment = page.getByRole('dialog', { name: 'New repayment', exact: true })
  await expect(repayment.getByRole('combobox', { name: 'From', exact: true })).toContainText('Max')
  await expect(repayment.getByRole('combobox', { name: 'To', exact: true })).toContainText(name)
  await expect(amountField(repayment)).toHaveValue('€41.63')
  await saveButton(repayment).click()
  await expect(page.getByText('Repayment saved')).toBeVisible()
  await expect(repayment).toBeHidden()
  await expect(balanceRow(page, 'Max')).toContainText('settled')
  await expect(balanceRow(page, 'Max')).toContainText('€0.00')
  await expect(balanceRow(page, name)).toContainText('+€18.37')
  await expect(transferRows(page)).toHaveCount(1)
  await expect(transferRows(page).first()).toContainText(`Olya pays ${name}`)
  await expect(repayments(page).getByRole('article', { name: `Max → ${name}`, exact: true })).toContainText('€41.63')

  const edit = await openEditExpense(page, 'Dinner')
  await expect(amountField(edit)).toHaveValue('€90.00')
  await typeInto(amountField(edit), '120')
  await saveButton(edit).click()
  await expect(page.getByText('Expense updated')).toBeVisible()
  await expect(edit).toBeHidden()
  await expect(row(page, 'Dinner')).toContainText('€120.00')
  await expect(row(page, 'Dinner')).toContainText(`Edited by ${name}`)
  await expect(balanceRow(page, name)).toContainText('+€38.37')
  await expect(balanceRow(page, 'Olya')).toContainText('-€28.37')
  await expect(balanceRow(page, 'Max')).toContainText('-€10.00')

  await row(page, 'Dinner').getByRole('button', { name: 'History of Dinner', exact: true }).click()
  const history = page.getByRole('dialog', { name: 'History of Dinner', exact: true })
  const events = history.getByRole('list', { name: 'Changes', exact: true }).locator(':scope > li')
  await expect(events).toHaveCount(2)
  await expect(events.nth(0)).toContainText(`Edited by ${name}`)
  await expect(events.nth(0)).toContainText('Amount: €90.00 → €120.00')
  await expect(events.nth(1)).toContainText(`Added by ${name}`)
  await history.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(history).toBeHidden()

  const ticketsEdit = await openEditExpense(page, 'Tickets')
  await ticketsEdit.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('Expense deleted')).toBeVisible()
  await expect(titles(page)).toHaveText(['Dinner'])
  await expect(total(page)).toContainText('€120.00')
  await expect(balanceRow(page, name)).toContainText('+€38.37')
  await expect(balanceRow(page, 'Olya')).toContainText('-€40.00')
  await expect(balanceRow(page, 'Max')).toContainText('+€1.63')

  await view(expenses(page), 'Deleted').click()
  await expect(titles(page)).toHaveText(['Tickets'])
  await expect(row(page, 'Tickets')).toContainText(`Deleted by ${name}`)
  await expect(row(page, 'Tickets')).toContainText('€23.26')
  await expect(expenses(page).getByRole('button', { name: /^Edit / })).toHaveCount(0)
  await expenses(page).getByRole('button', { name: 'Restore Tickets', exact: true }).click()
  await expect(page.getByText('Expense restored')).toBeVisible()
  await expect(expenses(page).getByRole('heading', { name: 'No deleted expenses', exact: true })).toBeVisible()
  await view(expenses(page), 'Active').click()
  await expect(titles(page)).toHaveText(['Tickets', 'Dinner'])
  await expect(total(page)).toContainText('€143.26')
  await expect(balanceRow(page, name)).toContainText('+€38.37')
  await expect(balanceRow(page, 'Olya')).toContainText('-€28.37')
  await expect(balanceRow(page, 'Max')).toContainText('-€10.00')

  const showIn = balances(page).getByRole('combobox', { name: 'Show in', exact: true })
  await showIn.click()
  await pickOverlayOption(page, 'PLN — Polish Zloty')
  await expect(showIn).toContainText('PLN')
  await expect(balanceRow(page, name)).toContainText('zł 164.99')

  await page.getByRole('button', { name: 'Edit group', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Edit group', exact: true })
  await expect(settings.getByRole('combobox', { name: 'Main currency' })).toBeDisabled()
  await settings.getByRole('button', { name: 'Delete group', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete group', exact: true }).click()
  await expect(page).toHaveURL('/tools/groups')
  await expect(page.getByText('Group deleted')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'No groups yet' })).toBeVisible()

  await deleteAccount(page)
})

test('real expense group share link works without an account', async ({ page, browser, request }) => {
  await register(page, linkName, linkEmail)
  await page.goto('/tools/groups')
  await page.getByRole('button', { name: 'Create a group', exact: true }).click()
  const group = page.getByRole('dialog', { name: 'New group', exact: true })
  await group.getByLabel('Name', { exact: true }).fill('Porto')
  await chooseCurrency(page, group.getByRole('combobox', { name: 'Main currency' }), 'euro', 'EUR — Euro')
  const member = (number: number) => group.getByRole('textbox', { name: `Member ${number}`, exact: true })
  await expect(member(1)).toHaveValue(linkName)
  await group.getByRole('button', { name: 'Add member', exact: true }).click()
  await member(2).fill('Olya')
  await group.getByRole('button', { name: 'Add member', exact: true }).click()
  await member(3).fill('Max')
  await saveButton(group).click()
  await expect(page.getByText('Group created')).toBeVisible()
  const heading = page.getByRole('heading', { level: 1, name: 'Porto', exact: true })
  await expect(heading).toBeVisible()

  await page.getByRole('button', { name: 'Share', exact: true }).click()
  const share = page.getByRole('dialog', { name: 'Share', exact: true })
  await share.getByRole('button', { name: 'Create link', exact: true }).click()
  await expect(page.getByText('Link created')).toBeVisible()
  const field = share.getByLabel('Link', { exact: true })
  await expect(field).toHaveValue(/\/g\/[A-Za-z0-9_-]{43}$/)
  const link = await field.inputValue()
  const token = link.slice(link.lastIndexOf('/') + 1)
  await share.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(share).toBeHidden()

  const rendered = await request.get(link)
  expect(rendered.status()).toBe(200)
  const html = await rendered.text()
  for (const shown of ['Porto', linkName, 'Olya', 'Max']) expect(html).not.toMatch(new RegExp(`\\b${shown}\\b`))

  const linkPath = `/v1/shared/groups/${token}`
  const allowed = (path: string) =>
    path === '/v1/me' || path === '/v1/auth/refresh' || path === linkPath || path.startsWith(`${linkPath}/`)
  const anonymous = await browser.newContext()
  try {
    const guest = await anonymous.newPage()
    const requested: string[] = []
    guest.on('request', (sent) => {
      const { pathname } = new URL(sent.url())
      if (pathname.startsWith('/v1/')) requested.push(pathname)
    })

    const response = await guest.goto(link)
    expect(response?.headers()['referrer-policy']).toBe('no-referrer')
    const question = guest.getByRole('region', { name: 'Who are you?', exact: true })
    await expect(question.getByRole('heading', { level: 1, name: 'Who are you?', exact: true })).toBeVisible()
    await expect(question.getByRole('button')).toHaveText([linkName, 'Olya', 'Max'])
    await question.getByRole('button', { name: 'Olya', exact: true }).click()
    await expect(guest.getByRole('heading', { level: 1, name: 'Porto', exact: true })).toBeVisible()
    await expect(guest.getByText('You are Olya', { exact: true })).toBeVisible()

    const taxi = await openNewExpense(guest)
    await chooseMember(guest, taxi, 'Paid by', 'Olya')
    await amountField(taxi).pressSequentially('30')
    await taxi.getByLabel('Description', { exact: true }).fill('Taxi')
    await saveButton(taxi).click()
    await expect(guest.getByText('Expense added')).toBeVisible()
    await expect(taxi).toBeHidden()
    await expect(row(guest, 'Taxi')).toContainText('Paid by Olya')
    await expect(row(guest, 'Taxi')).toContainText('€30.00')
    await expect(row(guest, 'Taxi')).toContainText('Split equally between everyone')
    await expect(row(guest, 'Taxi')).toContainText('Added by Olya')
    await expect(balanceRow(guest, 'Olya')).toContainText('+€20.00')
    await expect(balanceRow(guest, linkName)).toContainText('-€10.00')
    await expect(balanceRow(guest, 'Max')).toContainText('-€10.00')

    await page.reload()
    await expect(heading).toBeVisible()
    await expect(row(page, 'Taxi')).toContainText('Added by Olya')
    await expect(total(page)).toContainText('€30.00')

    await page.getByRole('button', { name: 'Share', exact: true }).click()
    await expect(share.getByLabel('Link', { exact: true })).toHaveValue(link)
    await share.getByRole('button', { name: 'Turn off link', exact: true }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toContainText('Turn off the link?')
    await confirm.getByRole('button', { name: 'Turn off link', exact: true }).click()
    await expect(page.getByText('Link turned off')).toBeVisible()
    await expect(share.getByRole('button', { name: 'Create link', exact: true })).toBeVisible()
    await share.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(share).toBeHidden()

    await guest.reload()
    await expect(guest.getByText(DEAD_LINK, { exact: true })).toBeVisible()
    await expect(guest.getByRole('heading', { level: 1, name: 'Porto', exact: true })).toHaveCount(0)

    expect(requested.some((path) => path.startsWith(linkPath))).toBe(true)
    expect(requested.filter((path) => !allowed(path))).toEqual([])
  } finally {
    await anonymous.close()
  }

  await page.getByRole('button', { name: 'Edit group', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Edit group', exact: true })
  await settings.getByRole('button', { name: 'Delete group', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete group', exact: true }).click()
  await expect(page).toHaveURL('/tools/groups')
  await expect(page.getByText('Group deleted')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'No groups yet' })).toBeVisible()

  await deleteAccount(page)
})
