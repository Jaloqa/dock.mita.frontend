import { expect, type Locator, type Page, test } from '@playwright/test'
import { pickOverlayOption } from './overlayOption'

const groupList = (page: Page) => page.getByRole('list', { name: 'Groups', exact: true })
const newGroupButton = (page: Page) => page.getByRole('button', { name: 'New group', exact: true })
const member = (dialog: Locator, number: number) =>
  dialog.getByRole('textbox', { name: `Member ${number}`, exact: true })

const openNewGroup = async (page: Page) => {
  await page.goto('/tools/groups')
  await expect(groupList(page).getByRole('link')).toHaveCount(1)
  await newGroupButton(page).click()
  const dialog = page.getByRole('dialog', { name: 'New group' })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  return dialog
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
  await expect(albania).toContainText('4 uczestnicy')
  await expect(albania).toHaveAttribute('href', /\/pl\/tools\/groups\/grp_albania$/)
  await page.getByRole('button', { name: 'Nowa grupa', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Nowa grupa' })).toBeVisible()
})

test.describe('without groups', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('offers the first group with the name of the user as its first member', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
    await page.getByLabel('Email', { exact: true }).fill('oleh@demo.mita.app')
    await page.getByLabel('Password', { exact: true }).fill('demo-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL('/')
    await page.goto('/tools/groups')
    await expect(page.getByRole('heading', { level: 2, name: 'No groups yet' })).toBeVisible()
    await expect(groupList(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Create a group', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'New group' })
    await expect(member(dialog, 1)).toHaveValue('Oleh Kravets')
  })
})
