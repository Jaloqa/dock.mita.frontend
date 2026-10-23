import { expect, type Locator, type Page, test } from '@playwright/test'

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
