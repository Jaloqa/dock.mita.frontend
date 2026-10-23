import { expect, type Locator, type Page, test } from '@playwright/test'
import { pickOverlayOption } from './overlayOption'

const OWN_EMAIL_MESSAGE = 'This is your own email. Use “This is me” instead.'

const memberRow = (dialog: Locator, name: string) =>
  dialog
    .getByRole('list', { name: 'Members', exact: true })
    .getByRole('listitem')
    .filter({ has: dialog.page().getByText(name, { exact: true }) })

const thisIsMe = (dialog: Locator, name: string) =>
  dialog.getByRole('button', { name: `This is me: ${name}`, exact: true })

const anyThisIsMe = (dialog: Locator) => dialog.getByRole('button', { name: /^This is me/ })

const toast = (page: Page, text: string) => page.getByText(text, { exact: true })

const openMembers = async (page: Page) => {
  await page.goto('/tools/groups/grp_albania')
  await expect(page.getByRole('heading', { level: 1, name: 'Albania 2026', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Members', exact: true })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  return dialog
}

const invite = async (dialog: Locator, name: string, email: string) => {
  await dialog.getByRole('button', { name: `Invite ${name}`, exact: true }).click()
  const field = dialog.getByLabel(`Email of ${name}`, { exact: true })
  await expect(field).toBeFocused()
  await field.fill(email)
  await dialog.getByRole('button', { name: 'Send invitation', exact: true }).click()
  return field
}

test('tells the owner where the invitation waits', async ({ page }) => {
  const dialog = await openMembers(page)
  await expect(
    dialog.getByText('Let them know: the invitation waits for them under Tools → Groups in their dock.mita app.'),
  ).toBeVisible()
  for (const name of ['Anna', 'Olya', 'Max', 'Kasia']) {
    await expect(memberRow(dialog, name)).toHaveCount(1)
    await expect(memberRow(dialog, name).getByText('You', { exact: true })).toHaveCount(0)
  }
})

test('links you to a member', async ({ page }) => {
  const dialog = await openMembers(page)
  await expect(anyThisIsMe(dialog)).toHaveCount(4)
  const button = thisIsMe(dialog, 'Anna')
  expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  await expect(button).toHaveText('This is me')
  await button.click()
  await expect(toast(page, 'Linked to you')).toBeVisible()
  const anna = memberRow(dialog, 'Anna')
  await expect(anna.getByText('You', { exact: true })).toBeVisible()
  await expect(anyThisIsMe(dialog)).toHaveCount(0)
  await expect(anna.getByRole('button', { name: 'Unlink Anna', exact: true })).toBeFocused()
})

test('keeps the link after the page reloads', async ({ page }) => {
  const dialog = await openMembers(page)
  await thisIsMe(dialog, 'Anna').click()
  await expect(memberRow(dialog, 'Anna').getByText('You', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await expect(memberRow(page.getByRole('dialog', { name: 'Members', exact: true }), 'Anna')).toContainText('You')
})

test('invites a member and cancels the invitation', async ({ page }) => {
  const dialog = await openMembers(page)
  await invite(dialog, 'Olya', 'olya@example.com')
  await expect(toast(page, 'Invitation sent')).toBeVisible()
  const olya = memberRow(dialog, 'Olya')
  await expect(olya.getByText('Invited: olya@example.com', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('Email of Olya', { exact: true })).toHaveCount(0)
  const cancel = olya.getByRole('button', { name: 'Cancel the invitation of Olya', exact: true })
  expect((await cancel.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  await cancel.click()
  await expect(toast(page, 'Invitation cancelled')).toBeVisible()
  await expect(olya.getByText('Invited: olya@example.com', { exact: true })).toHaveCount(0)
  await expect(cancel).toHaveCount(0)
  await expect(olya.getByRole('button', { name: 'Invite Olya', exact: true })).toBeVisible()
})

test('replaces an invitation with a new email', async ({ page }) => {
  const dialog = await openMembers(page)
  await invite(dialog, 'Olya', 'olya@example.com')
  const olya = memberRow(dialog, 'Olya')
  await expect(olya.getByText('Invited: olya@example.com', { exact: true })).toBeVisible()
  await invite(dialog, 'Olya', 'Olya.N@Example.com')
  await expect(olya.getByText('Invited: olya.n@example.com', { exact: true })).toBeVisible()
  await expect(olya.getByText('Invited: olya@example.com', { exact: true })).toHaveCount(0)
})

test('refuses your own email', async ({ page }) => {
  const dialog = await openMembers(page)
  const field = await invite(dialog, 'Max', 'anna@demo.mita.app')
  await expect(dialog.getByText(OWN_EMAIL_MESSAGE, { exact: true })).toBeVisible()
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(field).toBeFocused()
  await expect(toast(page, 'Invitation sent')).toHaveCount(0)
  await expect(memberRow(dialog, 'Max').getByText(/^Invited:/)).toHaveCount(0)
})

test('refuses an email another member is invited with', async ({ page }) => {
  const dialog = await openMembers(page)
  await invite(dialog, 'Olya', 'friend@example.com')
  await expect(memberRow(dialog, 'Olya').getByText('Invited: friend@example.com', { exact: true })).toBeVisible()
  const field = await invite(dialog, 'Max', ' Friend@Example.com ')
  await expect(
    dialog.getByText('Another member of this group is already invited with this email.', { exact: true }),
  ).toBeVisible()
  await expect(field).toHaveAttribute('aria-invalid', 'true')
})

test('asks for a valid email before sending', async ({ page }) => {
  const dialog = await openMembers(page)
  const field = await invite(dialog, 'Kasia', '')
  await expect(dialog.getByText('This field is required.', { exact: true })).toBeVisible()
  await expect(field).toBeFocused()
  await field.fill('no-at-sign')
  await dialog.getByRole('button', { name: 'Send invitation', exact: true }).click()
  await expect(dialog.getByText('Enter a valid email address.', { exact: true })).toBeVisible()
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(toast(page, 'Invitation sent')).toHaveCount(0)
})

test('closes the invitation form without sending', async ({ page }) => {
  const dialog = await openMembers(page)
  const open = dialog.getByRole('button', { name: 'Invite Olya', exact: true })
  await open.click()
  const field = dialog.getByLabel('Email of Olya', { exact: true })
  await field.fill('olya@example.com')
  await field.press('Escape')
  await expect(field).toHaveCount(0)
  await expect(open).toBeFocused()
  await expect(dialog).toBeVisible()
  await open.click()
  await expect(dialog.getByLabel('Email of Olya', { exact: true })).toHaveValue('')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog.getByLabel('Email of Olya', { exact: true })).toHaveCount(0)
  await expect(open).toBeFocused()
  await expect(memberRow(dialog, 'Olya').getByText(/^Invited:/)).toHaveCount(0)
})

test('closes the invitation form when the member becomes yours', async ({ page }) => {
  const dialog = await openMembers(page)
  const anna = memberRow(dialog, 'Anna')
  const open = anna.getByRole('button', { name: 'Invite Anna', exact: true })
  await open.click()
  const field = dialog.getByLabel('Email of Anna', { exact: true })
  await field.fill('anna@example.com')
  await thisIsMe(dialog, 'Anna').click()
  await expect(anna.getByText('You', { exact: true })).toBeVisible()
  await expect(field).toHaveCount(0)

  await anna.getByRole('button', { name: 'Unlink Anna', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Unlink', exact: true }).click()
  await expect(toast(page, 'Member unlinked')).toBeVisible()
  await expect(open).toHaveAttribute('aria-expanded', 'false')
  await expect(field).toHaveCount(0)
  await open.click()
  await expect(field).toHaveValue('')
})

test('unlinks a member linked to another account', async ({ page }) => {
  await page.goto('/tools/groups/grp_albania')
  await expect(page.getByRole('heading', { level: 1, name: 'Albania 2026', exact: true })).toBeVisible()
  await page.evaluate(() => {
    const key = 'mita-mock-db-v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    const olya = state.groupMembers.find((row: { id: string }) => row.id === 'gmb_olya')
    olya.userId = 'usr_oleh'
    localStorage.setItem(key, JSON.stringify(state))
  })
  const dialog = await openMembers(page)
  const olya = memberRow(dialog, 'Olya')
  await expect(olya.getByText('Linked to Oleh Kravets', { exact: true })).toBeVisible()
  await olya.getByRole('button', { name: 'Unlink Olya', exact: true }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Unlink Olya?')
  await expect(confirm).toContainText('They no longer see the group in their app. Their entries stay.')
  await confirm.getByRole('button', { name: 'Unlink', exact: true }).click()
  await expect(toast(page, 'Member unlinked')).toBeVisible()
  await expect(olya.getByText('Linked to Oleh Kravets', { exact: true })).toHaveCount(0)
  await expect(olya.getByRole('button', { name: 'Invite Olya', exact: true })).toBeVisible()
})

test('unlinks you from your member', async ({ page }) => {
  const dialog = await openMembers(page)
  await thisIsMe(dialog, 'Anna').click()
  await expect(memberRow(dialog, 'Anna').getByText('You', { exact: true })).toBeVisible()
  await memberRow(dialog, 'Anna').getByRole('button', { name: 'Unlink Anna', exact: true }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Unlink yourself from Anna?')
  await expect(confirm).toContainText('You keep access to the group as its owner. Its entries stay.')
  await expect(confirm).not.toContainText('They no longer see the group')
  await confirm.getByRole('button', { name: 'Unlink', exact: true }).click()
  await expect(toast(page, 'Member unlinked')).toBeVisible()
  await expect(memberRow(dialog, 'Anna').getByText('You', { exact: true })).toHaveCount(0)
  await expect(anyThisIsMe(dialog)).toHaveCount(4)
  await expect(thisIsMe(dialog, 'Anna')).toBeFocused()
})

test('keeps the link when the unlink is not confirmed', async ({ page }) => {
  const dialog = await openMembers(page)
  await thisIsMe(dialog, 'Anna').click()
  await memberRow(dialog, 'Anna').getByRole('button', { name: 'Unlink Anna', exact: true }).click()
  const confirm = page.getByRole('alertdialog')
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(confirm).toBeHidden()
  await expect(memberRow(dialog, 'Anna').getByText('You', { exact: true })).toBeVisible()
  await expect(toast(page, 'Member unlinked')).toHaveCount(0)
})

const INVITATION = 'Oleh Kravets invites you to “Kraków” as Anna.'

const groupList = (page: Page) => page.getByRole('list', { name: 'Groups', exact: true })
const invitations = (page: Page) => page.getByRole('region', { name: 'Invitations', exact: true })
const acceptButton = (page: Page) =>
  invitations(page).getByRole('button', { name: 'Accept the invitation to Kraków', exact: true })
const declineButton = (page: Page) =>
  invitations(page).getByRole('button', { name: 'Decline the invitation to Kraków', exact: true })
const groupsHeading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Groups', exact: true })
const krakowCard = (page: Page) => groupList(page).getByRole('link', { name: 'Kraków', exact: true })
const balances = (page: Page) => page.getByRole('region', { name: 'Balances', exact: true })
const leaveButton = (page: Page) => page.getByRole('button', { name: 'Leave group', exact: true })

const openGroups = async (page: Page) => {
  await page.goto('/tools/groups')
  await expect(groupsHeading(page)).toBeVisible()
  await expect(invitations(page).getByText(INVITATION, { exact: true })).toBeVisible()
}

const acceptInvitation = async (page: Page) => {
  await openGroups(page)
  await acceptButton(page).click()
  await expect(toast(page, 'You joined “Kraków”')).toBeVisible()
  await expect(krakowCard(page)).toBeVisible()
}

const openKrakow = async (page: Page) => {
  await acceptInvitation(page)
  await krakowCard(page).click()
  await expect(page).toHaveURL('/tools/groups/grp_krakow')
  await expect(page.getByRole('heading', { level: 1, name: 'Kraków', exact: true })).toBeVisible()
}

test('lists the invitation above the groups', async ({ page }) => {
  await openGroups(page)
  await expect(invitations(page).getByRole('heading', { level: 2, name: 'Invitations', exact: true })).toBeVisible()
  await expect(invitations(page).getByRole('listitem')).toHaveCount(1)
  for (const button of [acceptButton(page), declineButton(page)]) {
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  }
  await expect(acceptButton(page)).toHaveText('Accept')
  await expect(declineButton(page)).toHaveText('Decline')
  await expect(groupList(page).getByRole('link')).toHaveCount(1)
  await expect(krakowCard(page)).toHaveCount(0)
  const invitationsTop = (await invitations(page).boundingBox())?.y ?? Number.POSITIVE_INFINITY
  const groupsTop = (await groupList(page).boundingBox())?.y ?? 0
  expect(invitationsTop).toBeLessThan(groupsTop)
})

test('accepts an invitation', async ({ page }) => {
  await openGroups(page)
  await acceptButton(page).click()
  await expect(toast(page, 'You joined “Kraków”')).toBeVisible()
  await expect(invitations(page)).toHaveCount(0)
  await expect(groupsHeading(page)).toBeFocused()
  await expect(groupList(page).getByRole('link')).toHaveCount(2)
  await expect(krakowCard(page)).toContainText('Shared with you')
  await expect(krakowCard(page)).toContainText('3 members')
  await expect(groupList(page).getByRole('link', { name: 'Albania 2026', exact: true })).not.toContainText(
    'Shared with you',
  )

  await krakowCard(page).click()
  await expect(page).toHaveURL('/tools/groups/grp_krakow')
  await expect(page.getByRole('heading', { level: 1, name: 'Kraków', exact: true })).toBeVisible()
  for (const name of ['Members', 'Share', 'Edit group'])
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  await expect(balances(page).getByText('Anna (you)', { exact: true })).toBeVisible()
  const anna = balances(page).getByRole('listitem').filter({ hasText: 'Anna (you)' })
  await expect(anna).toContainText('-zł 100.00')
  await expect(balances(page).getByText('Oleh', { exact: true })).toBeVisible()
  await expect(balances(page).getByText(/\(you\)/)).toHaveCount(1)

  await page.getByRole('button', { name: 'Add expense', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New expense', exact: true })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await dialog.getByRole('combobox', { name: 'Paid by', exact: true }).click()
  await pickOverlayOption(page, 'Anna')
  await dialog.getByLabel('Amount', { exact: true }).pressSequentially('30')
  await dialog.getByLabel('Description', { exact: true }).fill('Coffee')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(toast(page, 'Expense added')).toBeVisible()
  const coffee = page
    .getByRole('region', { name: 'Expenses', exact: true })
    .getByRole('article', { name: 'Coffee', exact: true })
  await expect(coffee).toContainText('Added by Anna')
  await expect(coffee).toContainText('Paid by Anna')
})

test('keeps the group after the page reloads', async ({ page }) => {
  await acceptInvitation(page)
  await page.reload()
  await expect(groupsHeading(page)).toBeVisible()
  await expect(krakowCard(page)).toBeVisible()
  await expect(invitations(page)).toHaveCount(0)
})

test('declines an invitation', async ({ page }) => {
  await openGroups(page)
  await declineButton(page).click()
  await expect(toast(page, 'Invitation declined')).toBeVisible()
  await expect(invitations(page)).toHaveCount(0)
  await expect(groupsHeading(page)).toBeFocused()
  await expect(groupList(page).getByRole('link')).toHaveCount(1)
  await expect(krakowCard(page)).toHaveCount(0)
  await page.reload()
  await expect(groupsHeading(page)).toBeVisible()
  await expect(groupList(page).getByRole('link')).toHaveCount(1)
  await expect(invitations(page)).toHaveCount(0)
})

test('leaves a group', async ({ page }) => {
  await openKrakow(page)
  const leave = leaveButton(page)
  expect((await leave.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  await leave.click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Leave “Kraków”?')
  await expect(confirm).toContainText('The group disappears from your app. Its entries stay in the group.')
  await confirm.getByRole('button', { name: 'Leave group', exact: true }).click()
  await expect(toast(page, 'You left the group')).toBeVisible()
  await expect(page).toHaveURL('/tools/groups')
  await expect(groupsHeading(page)).toBeVisible()
  await expect(groupList(page).getByRole('link')).toHaveCount(1)
  await expect(krakowCard(page)).toHaveCount(0)
  await expect(invitations(page)).toHaveCount(0)
  await page.goto('/tools/groups/grp_krakow')
  await expect(page.getByText('This group no longer exists.', { exact: true })).toBeVisible()
})

test('keeps the group when leaving is not confirmed', async ({ page }) => {
  await openKrakow(page)
  await leaveButton(page).click()
  const confirm = page.getByRole('alertdialog')
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(confirm).toBeHidden()
  await expect(toast(page, 'You left the group')).toHaveCount(0)
  await expect(page).toHaveURL('/tools/groups/grp_krakow')
  await expect(balances(page).getByText('Anna (you)', { exact: true })).toBeVisible()
})

test('does not offer to leave a group you own', async ({ page }) => {
  await page.goto('/tools/groups/grp_albania')
  await expect(page.getByRole('heading', { level: 1, name: 'Albania 2026', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Members', exact: true })).toBeVisible()
  await expect(leaveButton(page)).toHaveCount(0)
})

test('names your member in the balances of a group you own', async ({ page }) => {
  const dialog = await openMembers(page)
  await thisIsMe(dialog, 'Anna').click()
  await expect(memberRow(dialog, 'Anna').getByText('You', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(balances(page).getByText('Anna (you)', { exact: true })).toBeVisible()
  await expect(balances(page).getByText('Olya', { exact: true })).toBeVisible()
})
