import { expect, type Locator, type Page, test } from '@playwright/test'
import { pickOverlayOption } from '../e2e/overlayOption'

const stamp = Date.now()
const ownerName = 'Links Owner'
const ownerEmail = `group-links-owner-${stamp}@example.com`
const inviteeName = 'Links Guest'
const inviteeEmail = `group-links-guest-${stamp}@example.com`
const password = 'group-links-smoke-password'

const section = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })
const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true })
const overlay = (page: Page) => page.locator('[data-pc-section="overlay"]')

const expenses = (page: Page) => section(page, 'Expenses')
const row = (page: Page, title: string) => expenses(page).getByRole('article', { name: title, exact: true })
const balances = (page: Page) => section(page, 'Balances')
const balanceRow = (page: Page, label: string) =>
  balances(page)
    .getByRole('list', { name: 'Balance of each member', exact: true })
    .getByRole('listitem')
    .filter({ hasText: label })
const groupList = (page: Page) => page.getByRole('list', { name: 'Groups', exact: true })
const groupCard = (page: Page) => groupList(page).getByRole('link', { name: 'Gdańsk', exact: true })
const groupsHeading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Groups', exact: true })
const emptyGroups = (page: Page) => page.getByRole('heading', { level: 2, name: 'No groups yet' })
const groupTitle = (page: Page) => page.getByRole('heading', { level: 1, name: 'Gdańsk', exact: true })

const debtLine = (page: Page) => section(page, 'Groups').getByRole('link', { name: 'Gdańsk', exact: true })
const summary = (page: Page, key: 'owed-to-me' | 'owed-by-me') => page.getByTestId(`debts-summary-${key}`)

const saveButton = (dialog: Locator) => dialog.getByRole('button', { name: 'Save', exact: true })

const memberRow = (dialog: Locator, member: string) =>
  dialog
    .getByRole('list', { name: 'Members', exact: true })
    .getByRole('listitem')
    .filter({ has: dialog.page().getByText(member, { exact: true }) })

const chooseCurrency = async (page: Page, field: Locator, query: string, option: string) => {
  await field.click()
  await overlay(page).getByRole('searchbox', { name: 'Search by code or name' }).fill(query)
  await pickOverlayOption(page, option)
  await expect(field).toHaveAttribute('aria-expanded', 'false')
  await expect(overlay(page)).toHaveCount(0)
}

const chooseMember = async (page: Page, dialog: Locator, label: string, member: string) => {
  const field = dialog.getByRole('combobox', { name: label, exact: true })
  await field.click()
  await pickOverlayOption(page, member)
  await expect(field).toContainText(member)
  await expect(overlay(page)).toHaveCount(0)
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

const openGroupsFromNavigation = async (page: Page) => {
  await mainNav(page).getByRole('link', { name: 'Tools', exact: true }).click()
  await expect(page).toHaveURL('/tools')
  await page
    .getByRole('list', { name: 'Tools', exact: true })
    .getByRole('link', { name: 'Groups', exact: true })
    .click()
  await expect(page).toHaveURL('/tools/groups')
  await expect(groupsHeading(page)).toBeVisible()
}

const openMembers = async (page: Page) => {
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  return page.getByRole('dialog', { name: 'Members', exact: true })
}

test('real linked group members flow through the backend', async ({ page, browser }) => {
  await register(page, ownerName, ownerEmail)

  await openGroupsFromNavigation(page)
  await expect(emptyGroups(page)).toBeVisible()
  await page.getByRole('button', { name: 'Create a group', exact: true }).click()
  const created = page.getByRole('dialog', { name: 'New group', exact: true })
  await created.getByLabel('Name', { exact: true }).fill('Gdańsk')
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

  const owned = await openMembers(page)
  await owned.getByRole('button', { name: `This is me: ${ownerName}`, exact: true }).click()
  await expect(page.getByText('Linked to you', { exact: true })).toBeVisible()
  await expect(memberRow(owned, ownerName).getByText('You', { exact: true })).toBeVisible()

  await owned.getByRole('button', { name: 'Invite Bartek', exact: true }).click()
  await owned.getByLabel('Email of Bartek', { exact: true }).fill(inviteeEmail)
  await owned.getByRole('button', { name: 'Send invitation', exact: true }).click()
  await expect(page.getByText('Invitation sent', { exact: true })).toBeVisible()
  await expect(memberRow(owned, 'Bartek').getByText(`Invited: ${inviteeEmail}`, { exact: true })).toBeVisible()
  await owned.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(owned).toBeHidden()

  const guestContext = await browser.newContext()
  try {
    const guest = await guestContext.newPage()
    await register(guest, inviteeName, inviteeEmail)
    await openGroupsFromNavigation(guest)

    const invitations = section(guest, 'Invitations')
    await expect(
      invitations.getByText(`${ownerName} invites you to “Gdańsk” as Bartek.`, { exact: true }),
    ).toBeVisible()
    await invitations.getByRole('button', { name: 'Accept the invitation to Gdańsk', exact: true }).click()
    await expect(guest.getByText('You joined “Gdańsk”', { exact: true })).toBeVisible()
    await expect(invitations).toHaveCount(0)
    await expect(groupCard(guest)).toBeVisible()
    await expect(groupCard(guest)).toContainText('Shared with you')

    await groupCard(guest).click()
    await expect(guest).toHaveURL(groupUrl)
    await expect(groupTitle(guest)).toBeVisible()
    for (const name of ['Members', 'Share', 'Edit group'])
      await expect(guest.getByRole('button', { name, exact: true })).toHaveCount(0)
    await expect(guest.getByRole('button', { name: 'Leave group', exact: true })).toBeVisible()
    await expect(balances(guest).getByText('Bartek (you)', { exact: true })).toBeVisible()

    await guest.getByRole('button', { name: 'Add expense', exact: true }).first().click()
    const pierogi = guest.getByRole('dialog', { name: 'New expense', exact: true })
    await chooseMember(guest, pierogi, 'Paid by', 'Bartek')
    await pierogi.getByLabel('Amount', { exact: true }).pressSequentially('30')
    await pierogi.getByLabel('Description', { exact: true }).fill('Pierogi')
    await saveButton(pierogi).click()
    await expect(guest.getByText('Expense added')).toBeVisible()
    await expect(pierogi).toBeHidden()
    await expect(row(guest, 'Pierogi')).toContainText('Paid by Bartek')
    await expect(row(guest, 'Pierogi')).toContainText('€30.00')
    await expect(row(guest, 'Pierogi')).toContainText('Split equally between everyone')
    await expect(row(guest, 'Pierogi')).toContainText('Added by Bartek')
    await expect(balanceRow(guest, 'Bartek (you)')).toContainText('+€20.00')

    await page.reload()
    await expect(groupTitle(page)).toBeVisible()
    await expect(row(page, 'Pierogi')).toContainText('Added by Bartek')
    await expect(balanceRow(page, `${ownerName} (you)`)).toContainText('-€10.00')
    await expect(balanceRow(page, 'Ola')).toContainText('-€10.00')

    const linked = await openMembers(page)
    await expect(memberRow(linked, 'Bartek').getByText(`Linked to ${inviteeName}`, { exact: true })).toBeVisible()
    await expect(memberRow(linked, 'Bartek').getByText('Invited:')).toHaveCount(0)
    await linked.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(linked).toBeHidden()

    await page.goto('/tools/debts')
    await expect(page.getByRole('heading', { level: 1, name: 'Debts', exact: true })).toBeVisible()
    await expect(debtLine(page)).toContainText('-€10.00')
    await expect(debtLine(page)).toContainText('You owe')
    await expect(summary(page, 'owed-by-me')).toContainText('I owe')
    await expect(summary(page, 'owed-by-me')).toContainText('zł 43.00')

    await guest.goto('/tools/debts')
    await expect(guest.getByRole('heading', { level: 1, name: 'Debts', exact: true })).toBeVisible()
    await expect(debtLine(guest)).toContainText('+€20.00')
    await expect(debtLine(guest)).toContainText('You get back')
    await expect(summary(guest, 'owed-to-me')).toContainText('Owed to me')
    await expect(summary(guest, 'owed-to-me')).toContainText('zł 86.00')

    await guest.goto(groupUrl)
    await expect(groupTitle(guest)).toBeVisible()
    await guest.getByRole('button', { name: 'Leave group', exact: true }).click()
    const confirm = guest.getByRole('alertdialog')
    await expect(confirm).toContainText('Leave “Gdańsk”?')
    await confirm.getByRole('button', { name: 'Leave group', exact: true }).click()
    await expect(guest.getByText('You left the group', { exact: true })).toBeVisible()
    await expect(guest).toHaveURL('/tools/groups')
    await expect(emptyGroups(guest)).toBeVisible()
    await expect(groupCard(guest)).toHaveCount(0)

    await page.goto(groupUrl)
    await expect(groupTitle(page)).toBeVisible()
    const unlinked = await openMembers(page)
    await expect(unlinked.getByRole('button', { name: 'Invite Bartek', exact: true })).toBeVisible()
    await expect(memberRow(unlinked, 'Bartek').getByText(`Linked to ${inviteeName}`)).toHaveCount(0)
    await unlinked.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(unlinked).toBeHidden()

    await deleteAccount(guest)
  } finally {
    await guestContext.close()
  }

  await page.getByRole('button', { name: 'Edit group', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Edit group', exact: true })
  await settings.getByRole('button', { name: 'Delete group', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete group', exact: true }).click()
  await expect(page).toHaveURL('/tools/groups')
  await expect(page.getByText('Group deleted')).toBeVisible()
  await expect(emptyGroups(page)).toBeVisible()

  await deleteAccount(page)
})
