import { expect, type Locator, type Page, test } from '@playwright/test'
import { pickOverlayOption } from './overlayOption'

const groupList = (page: Page) => page.getByRole('list', { name: 'Groups', exact: true })
const newGroupButton = (page: Page) => page.getByRole('button', { name: 'New group', exact: true })
const member = (dialog: Locator, number: number) =>
  dialog.getByRole('textbox', { name: `Member ${number}`, exact: true })

const summary = (page: Page, key: 'total' | 'members') => page.getByTestId(`group-summary-${key}`)
const memberRows = (dialog: Locator) => dialog.getByRole('list', { name: 'Members', exact: true }).getByRole('listitem')
const newMemberField = (dialog: Locator) => dialog.getByLabel('New member', { exact: true })
const addMemberButton = (dialog: Locator) => dialog.getByRole('button', { name: 'Add', exact: true })

const openAlbania = async (page: Page) => {
  await page.goto('/tools/groups/grp_albania')
  await expect(page.getByRole('heading', { level: 1, name: 'Albania 2026', exact: true })).toBeVisible()
}

const openMembers = async (page: Page) => {
  await openAlbania(page)
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Members', exact: true })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  return dialog
}

const addMember = async (dialog: Locator, name: string) => {
  await newMemberField(dialog).fill(name)
  await addMemberButton(dialog).click()
}

const openNewGroup = async (page: Page) => {
  await page.goto('/tools/groups')
  await expect(groupList(page).getByRole('link')).toHaveCount(1)
  await newGroupButton(page).click()
  const dialog = page.getByRole('dialog', { name: 'New group' })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  return dialog
}

const createGroup = async (page: Page, name: string, guests: number) => {
  const dialog = await openNewGroup(page)
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  for (let number = 2; number <= guests + 1; number += 1) {
    await dialog.getByRole('button', { name: 'Add member', exact: true }).click()
    await member(dialog, number).fill(`Guest ${number}`)
  }
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/tools\/groups\/(?!grp_albania$)[^/]+$/)
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible()
}

test('lists the seeded group', async ({ page }) => {
  await page.goto('/tools/groups')
  await expect(page.getByRole('heading', { level: 1, name: 'Groups', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Groups · Mita')
  const cards = groupList(page).getByRole('link')
  await expect(cards).toHaveCount(1)
  const albania = cards.first()
  await expect(albania).toHaveAccessibleName('Albania 2026')
  await expect(albania).toContainText('4 members')
  await expect(albania).toContainText('EUR')
  await expect(albania).toContainText('Spent')
  await expect(albania).toContainText('€190.70')
  await expect(albania).toHaveAttribute('href', /\/tools\/groups\/grp_albania$/)
  expect((await albania.boundingBox())?.height).toBeGreaterThanOrEqual(44)
})

test('opens a group from its card and returns through the eyebrow link', async ({ page }) => {
  await page.goto('/tools/groups')
  await groupList(page).getByRole('link', { name: 'Albania 2026', exact: true }).click()
  await expect(page).toHaveURL('/tools/groups/grp_albania')
  await expect(page.getByRole('heading', { level: 1, name: 'Albania 2026', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Albania 2026 · Mita')
  await page.getByRole('main').getByRole('link', { name: 'Groups', exact: true }).click()
  await expect(page).toHaveURL('/tools/groups')
  await expect(page.getByRole('heading', { level: 1, name: 'Groups', exact: true })).toBeVisible()
})

test('creates a group with members', async ({ page }) => {
  const dialog = await openNewGroup(page)
  await dialog.getByLabel('Name', { exact: true }).fill('Rome')
  await dialog.getByRole('combobox', { name: 'Main currency' }).click()
  await pickOverlayOption(page, 'EUR — Euro')
  await expect(dialog.getByText('Totals and balances are shown in this currency.')).toBeVisible()
  await expect(member(dialog, 1)).toHaveValue('Anna Nowak')
  await expect(dialog.getByRole('button', { name: 'Remove member 1', exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Add member', exact: true }).click()
  await expect(member(dialog, 2)).toBeFocused()
  await member(dialog, 2).fill('Piotr')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Group created')).toBeVisible()
  await expect(page).toHaveURL(/\/tools\/groups\/(?!grp_albania$)[^/]+$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Rome', exact: true })).toBeVisible()

  await page.goto('/tools/groups')
  const rome = groupList(page).getByRole('link', { name: 'Rome', exact: true })
  await expect(rome).toContainText('2 members')
  await expect(rome).toContainText('EUR')
  await expect(rome).toContainText('€0.00')
  await expect(groupList(page).getByRole('link').first()).toHaveAccessibleName('Rome')
})

test('refuses a duplicate member name', async ({ page }) => {
  const dialog = await openNewGroup(page)
  await dialog.getByLabel('Name', { exact: true }).fill('Rome')
  await dialog.getByRole('button', { name: 'Add member', exact: true }).click()
  await member(dialog, 2).fill('anna nowak')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.getByText('A member with this name already exists.')).toBeVisible()
  await expect(member(dialog, 2)).toHaveAttribute('aria-invalid', 'true')
  await expect(member(dialog, 2)).toBeFocused()
  await expect(member(dialog, 1)).not.toHaveAttribute('aria-invalid', 'true')
  await expect(dialog).toBeVisible()
})

test('asks for a name and for at least one member', async ({ page }) => {
  const dialog = await openNewGroup(page)
  await member(dialog, 1).fill('')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.getByText('This field is required.')).toHaveCount(2)
  await expect(dialog.getByLabel('Name', { exact: true })).toBeFocused()
  await dialog.getByLabel('Name', { exact: true }).fill('x'.repeat(41))
  await expect(dialog.getByText('Use at most 40 characters.')).toBeVisible()
  await dialog.getByLabel('Name', { exact: true }).fill('Rome')
  await member(dialog, 1).fill('Max')
  await expect(dialog.getByText('This field is required.')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'New group' })).toBeVisible()
})

test('removes a member row and keeps the focus in the list', async ({ page }) => {
  const dialog = await openNewGroup(page)
  await dialog.getByRole('button', { name: 'Add member', exact: true }).click()
  await member(dialog, 2).fill('Piotr')
  await dialog.getByRole('button', { name: 'Add member', exact: true }).click()
  await member(dialog, 3).fill('Ola')
  await dialog.getByRole('button', { name: 'Remove member 2', exact: true }).click()
  await expect(member(dialog, 3)).toHaveCount(0)
  await expect(member(dialog, 2)).toHaveValue('Ola')
  await expect(member(dialog, 2)).toBeFocused()
  await dialog.getByRole('button', { name: 'Remove member 2', exact: true }).click()
  await expect(member(dialog, 1)).toHaveValue('Anna Nowak')
  await expect(dialog.getByRole('button', { name: /^Remove member/ })).toHaveCount(0)
})

test('stops offering new members at fifty', async ({ page }) => {
  const dialog = await openNewGroup(page)
  const add = dialog.getByRole('button', { name: 'Add member', exact: true })
  for (let number = 2; number <= 50; number += 1) {
    await add.click()
    await member(dialog, number).fill(`Guest ${number}`)
  }
  await expect(member(dialog, 50)).toHaveValue('Guest 50')
  await expect(add).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Remove member 50', exact: true })).toBeVisible()
})

test('shows not found for a missing group', async ({ page }) => {
  await page.goto('/tools/groups/grp_missing')
  await expect(page.getByRole('heading', { level: 2, name: 'This group no longer exists.' })).toBeVisible()
  await page.getByRole('link', { name: 'All groups', exact: true }).click()
  await expect(page).toHaveURL('/tools/groups')
  await expect(groupList(page).getByRole('link')).toHaveCount(1)
})

test('/pl/tools/groups shows the page in Polish', async ({ page }) => {
  await page.goto('/pl/tools/groups')
  await expect(page.getByRole('heading', { level: 1, name: 'Grupy', exact: true })).toBeVisible()
  const albania = page.getByRole('list', { name: 'Grupy', exact: true }).getByRole('link', { name: 'Albania 2026' })
  await expect(albania).toContainText('4 osoby')
  await expect(albania).toHaveAttribute('href', /\/pl\/tools\/groups\/grp_albania$/)
  await page.getByRole('button', { name: 'Nowa grupa', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Nowa grupa' })).toBeVisible()
})

test('shows the group summary', async ({ page }) => {
  await openAlbania(page)
  await expect(page).toHaveTitle('Albania 2026 · Mita')
  await expect(page.getByRole('region', { name: 'Summary', exact: true })).toBeVisible()
  await expect(summary(page, 'total')).toHaveText(/^\s*Total spent\s*€190\.70\s*$/)
  await expect(summary(page, 'members')).toHaveText(/^\s*Members\s*4\s*$/)
  for (const name of ['Members', 'Edit group']) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
    expect(box?.width).toBeGreaterThanOrEqual(44)
  }
})

test('manages members', async ({ page }) => {
  const dialog = await openMembers(page)
  await expect(memberRows(dialog)).toHaveCount(4)

  await addMember(dialog, 'Tomek')
  await expect(page.getByText('Member added')).toBeVisible()
  await expect(memberRows(dialog)).toHaveCount(5)
  await expect(memberRows(dialog).last()).toContainText('Tomek')
  await expect(newMemberField(dialog)).toHaveValue('')
  await expect(newMemberField(dialog)).toBeFocused()
  await expect(summary(page, 'members')).toHaveText(/^\s*Members\s*5\s*$/)

  await dialog.getByRole('button', { name: 'Rename Olya', exact: true }).click()
  const rename = dialog.getByRole('textbox', { name: 'Name of Olya', exact: true })
  await expect(rename).toBeFocused()
  await expect(rename).toHaveValue('Olya')
  await rename.fill('Ola')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Member renamed')).toBeVisible()
  await expect(memberRows(dialog).filter({ hasText: 'Ola' })).toHaveCount(1)
  await expect(dialog.getByRole('button', { name: 'Rename Olya', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Rename Ola', exact: true })).toBeFocused()

  await dialog.getByRole('button', { name: 'Remove Tomek', exact: true }).click()
  await expect(page.getByText('Member removed')).toBeVisible()
  await expect(memberRows(dialog)).toHaveCount(4)
  await expect(memberRows(dialog).filter({ hasText: 'Tomek' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Rename Kasia', exact: true })).toBeFocused()
  await expect(summary(page, 'members')).toHaveText(/^\s*Members\s*4\s*$/)

  const hint = 'Has entries, so it can only be renamed.'
  const remove = dialog.getByRole('button', { name: 'Remove Max', exact: true })
  await expect(remove).toBeDisabled()
  await expect(remove).toHaveAccessibleDescription(hint)
  await expect(dialog.getByText(hint, { exact: true })).toHaveCount(4)
  await expect(dialog.getByRole('button', { name: 'Rename Max', exact: true })).toBeEnabled()
})

test('checks member names before sending them', async ({ page }) => {
  const dialog = await openMembers(page)
  const field = newMemberField(dialog)
  await addMemberButton(dialog).click()
  await expect(dialog.getByText('This field is required.')).toBeVisible()
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(field).toBeFocused()
  await field.fill('olya')
  await addMemberButton(dialog).click()
  await expect(dialog.getByText('A member with this name already exists.')).toBeVisible()
  await field.fill('x'.repeat(41))
  await addMemberButton(dialog).click()
  await expect(dialog.getByText('Use at most 40 characters.')).toBeVisible()
  await expect(memberRows(dialog)).toHaveCount(4)

  await dialog.getByRole('button', { name: 'Rename Olya', exact: true }).click()
  await expect(dialog.getByText('Use at most 40 characters.')).toHaveCount(0)
  const rename = dialog.getByRole('textbox', { name: 'Name of Olya', exact: true })
  await rename.fill(' max ')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.getByText('A member with this name already exists.')).toBeVisible()
  await expect(rename).toHaveAttribute('aria-invalid', 'true')
  await expect(rename).toBeFocused()
  await rename.fill('OLYA')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Member renamed')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Rename OLYA', exact: true })).toBeVisible()
})

test('shows what the server says under the field it belongs to', async ({ page }) => {
  const dialog = await openMembers(page)
  const field = newMemberField(dialog)
  await addMember(dialog, 'Bad\u0001name')
  await expect(dialog.getByText('This value is not valid.')).toHaveCount(1)
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(field).toBeFocused()
  await expect(memberRows(dialog)).toHaveCount(4)

  await dialog.getByRole('button', { name: 'Rename Olya', exact: true }).click()
  await expect(dialog.getByText('This value is not valid.')).toHaveCount(0)
  const rename = dialog.getByRole('textbox', { name: 'Name of Olya', exact: true })
  await rename.fill('Bad\u0001name')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.getByText('This value is not valid.')).toHaveCount(1)
  await expect(rename).toHaveAttribute('aria-invalid', 'true')
  await expect(rename).toBeFocused()
  await expect(memberRows(dialog).filter({ hasText: 'Olya' })).toHaveCount(1)
})

test('cancels a rename with Escape or Cancel and keeps the dialog open', async ({ page }) => {
  const dialog = await openMembers(page)
  await dialog.getByRole('button', { name: 'Rename Olya', exact: true }).click()
  const rename = dialog.getByRole('textbox', { name: 'Name of Olya', exact: true })
  await rename.fill('Ola')
  await rename.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(rename).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Rename Olya', exact: true })).toBeFocused()

  await dialog.getByRole('button', { name: 'Rename Max', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Name of Max', exact: true }).fill('Maks')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: 'Name of Max', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Rename Max', exact: true })).toBeFocused()
  await expect(memberRows(dialog).filter({ hasText: 'Maks' })).toHaveCount(0)
  await expect(memberRows(dialog).filter({ hasText: 'Ola' })).toHaveCount(0)
})

test('refreshes a member that gained entries elsewhere when removing it is refused', async ({ page }) => {
  const dialog = await openMembers(page)
  await addMember(dialog, 'Tomek')
  await expect(memberRows(dialog)).toHaveCount(5)
  const remove = dialog.getByRole('button', { name: 'Remove Tomek', exact: true })
  await expect(remove).toBeEnabled()

  const other = await page.context().newPage()
  await other.goto('/tools/groups')
  await other.evaluate(() => {
    const key = 'mita-mock-db-v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    const tomek = state.groupMembers.find((row: { name: string }) => row.name === 'Tomek')
    const expense = { ...state.groupExpenses[0], id: 'gexp_tomek', payerId: tomek.id }
    const created = state.groupEvents.find((row: { kind: string }) => row.kind === 'expense')
    const { id: _id, deleted: _deleted, groupId: _groupId, createdAt: _createdAt, ...expenseState } = expense
    state.groupExpenses.push(expense)
    state.groupEvents.push({
      ...created,
      id: 'gevt_tomek',
      entryId: expense.id,
      action: 'created',
      state: expenseState,
    })
    localStorage.setItem(key, JSON.stringify(state))
  })
  await other.close()

  await remove.click()
  await expect(dialog.getByText('This member has entries, so it can only be renamed.', { exact: true })).toBeVisible()
  await expect(remove).toBeDisabled()
  await expect(remove).toHaveAccessibleDescription(
    'Has entries, so it can only be renamed. This member has entries, so it can only be renamed.',
  )
  await expect(dialog.getByRole('button', { name: 'Rename Tomek', exact: true })).toBeFocused()
  await expect(memberRows(dialog)).toHaveCount(5)
})

test('stops offering the new member field at fifty members', async ({ page }) => {
  await createGroup(page, 'Crowd', 49)
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Members', exact: true })
  await expect(memberRows(dialog)).toHaveCount(50)
  await expect(newMemberField(dialog)).toHaveCount(0)
  await expect(addMemberButton(dialog)).toHaveCount(0)
  await expect(dialog.getByText('A group can have at most 50 members.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Remove Guest 50', exact: true }).click()
  await expect(memberRows(dialog)).toHaveCount(49)
  await expect(newMemberField(dialog)).toBeVisible()
  await expect(dialog.getByText('A group can have at most 50 members.')).toHaveCount(0)
})

test('shows an empty list after the last member is removed', async ({ page }) => {
  await createGroup(page, 'Rome', 0)
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Members', exact: true })
  await expect(memberRows(dialog)).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Remove Anna Nowak', exact: true }).click()
  await expect(memberRows(dialog)).toHaveCount(0)
  await expect(dialog.getByText('No members yet.')).toBeVisible()
  await expect(newMemberField(dialog)).toBeFocused()
  await addMember(dialog, 'Piotr')
  await expect(memberRows(dialog)).toHaveCount(1)
  await expect(dialog.getByText('No members yet.')).toHaveCount(0)
})

test('renames a group and shows the currency lock', async ({ page }) => {
  await openAlbania(page)
  await page.getByRole('button', { name: 'Edit group', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit group', exact: true })
  const currency = dialog.getByRole('combobox', { name: 'Main currency' })
  await expect(currency).toBeDisabled()
  await expect(dialog.getByText('The main currency cannot change once the group has entries.')).toBeVisible()
  await expect(currency).toHaveAccessibleDescription(
    'Totals and balances are shown in this currency. The main currency cannot change once the group has entries.',
  )
  await expect(dialog.getByRole('button', { name: 'Delete group', exact: true })).toBeVisible()
  await dialog.getByLabel('Name', { exact: true }).fill('Albanian trip')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Group updated')).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Albanian trip', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Albanian trip · Mita')
  await expect(summary(page, 'total')).toContainText('€190.70')
})

test('deletes a group', async ({ page }) => {
  await createGroup(page, 'Rome', 0)
  await page.getByRole('button', { name: 'Edit group', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit group', exact: true })
  await expect(dialog.getByRole('combobox', { name: 'Main currency' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Delete group', exact: true }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Delete the group?')
  await expect(confirm).toContainText('“Rome”, its expenses, repayments and history will be deleted for good.')
  await confirm.getByRole('button', { name: 'Delete group', exact: true }).click()
  await expect(page).toHaveURL('/tools/groups')
  await expect(page.getByText('Group deleted')).toBeVisible()
  await expect(groupList(page).getByRole('link')).toHaveCount(1)
  await expect(groupList(page).getByRole('link', { name: 'Rome', exact: true })).toHaveCount(0)
})

test('does not keep the old name once the group is gone', async ({ page }) => {
  const dialog = await openMembers(page)
  const other = await page.context().newPage()
  await other.goto('/tools/groups')
  await other.evaluate(() => {
    const key = 'mita-mock-db-v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    state.groups = state.groups.filter((row: { id: string }) => row.id !== 'grp_albania')
    localStorage.setItem(key, JSON.stringify(state))
  })
  await other.close()

  await addMember(dialog, 'Tomek')
  await expect(page.getByRole('heading', { level: 2, name: 'This group no longer exists.' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Group', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Group · Mita')
  await expect(page.getByText('Albania 2026')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Members', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit group', exact: true })).toHaveCount(0)
})

test('/pl/tools/groups/grp_albania shows the group page in Polish', async ({ page }) => {
  await page.goto('/pl/tools/groups/grp_albania')
  await expect(page.getByRole('heading', { level: 1, name: 'Albania 2026', exact: true })).toBeVisible()
  await expect(summary(page, 'total')).toContainText('Wydano łącznie')
  await expect(summary(page, 'members')).toContainText('Uczestnicy')
  await expect(page.getByRole('button', { name: 'Edytuj grupę', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Uczestnicy', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Uczestnicy', exact: true })
  await expect(dialog.getByRole('button', { name: 'Zmień imię: Olya', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Usuń: Max', exact: true })).toHaveAccessibleDescription(
    'Ma wpisy, więc można tylko zmienić imię.',
  )
})

test.describe('without groups', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('offers the first group with the name of the user as its first member', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled()
    await page.getByLabel('Name', { exact: true }).fill('Ewa Lis')
    await page.getByLabel('Email', { exact: true }).fill('ewa@example.com')
    await page.getByLabel('Password', { exact: true }).fill('long-enough-password')
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    await expect(page).toHaveURL('/')
    await page.goto('/tools/groups')
    await expect(page.getByRole('heading', { level: 2, name: 'No groups yet' })).toBeVisible()
    await expect(groupList(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Create a group', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'New group' })
    await expect(member(dialog, 1)).toHaveValue('Ewa Lis')
  })
})
