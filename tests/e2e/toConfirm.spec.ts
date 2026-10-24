import { expect, type Locator, type Page, test } from '@playwright/test'
import { pickOverlayOption } from './overlayOption'

const section = (page: Page) => page.getByRole('region', { name: 'To confirm', exact: true })
const item = (page: Page, title: string) => section(page).getByRole('article', { name: title, exact: true })

const linkAnna = async (page: Page) => {
  await page.goto('/tools/groups/grp_albania')
  await expect(page.getByRole('heading', { level: 1, name: 'Albania 2026', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  const members = page.getByRole('dialog', { name: 'Members', exact: true })
  await members.getByRole('button', { name: 'This is me: Anna', exact: true }).click()
  await expect(page.getByText('Linked to you', { exact: true })).toBeVisible()
  await members.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(members).toBeHidden()
}

const openToConfirm = async (page: Page) => {
  await page.goto('/tools/groups')
  await expect(section(page)).toBeVisible()
}

const openDinnerDialog = async (page: Page): Promise<Locator> => {
  await openToConfirm(page)
  await item(page, 'Dinner').getByRole('button', { name: 'Confirm Dinner', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm Dinner', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

const chooseAccount = async (page: Page, dialog: Locator, name: string) => {
  await dialog.getByRole('combobox', { name: 'Account', exact: true }).click()
  await pickOverlayOption(page, name)
  await expect(dialog.getByLabel(/^Exchange rate/)).toHaveValue(/^\d/)
}

const showAllTime = async (page: Page, isMobile: boolean) => {
  if (isMobile) {
    await page.getByRole('button', { name: 'Filters' }).click()
    const drawer = page.getByRole('dialog', { name: 'Filters' })
    await drawer.getByRole('combobox', { name: 'Period' }).click()
    await page.getByRole('option', { name: 'All time' }).click()
    await drawer.getByRole('button', { name: 'Show results' }).click()
    await expect(drawer).toBeHidden()
    return
  }
  await page.getByRole('region', { name: 'Filters' }).getByRole('combobox', { name: 'Period' }).click()
  await page.getByRole('option', { name: 'All time' }).click()
}

const openBookedDinner = async (page: Page, isMobile: boolean) => {
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible()
  await showAllTime(page, isMobile)
  return page
    .getByRole('main')
    .locator('tr, li, article')
    .filter({ hasText: 'Dinner' })
    .filter({ visible: true })
    .first()
}

const editDinner = async (page: Page, change: (dialog: Locator) => Promise<void>) => {
  await page.goto('/tools/groups/grp_albania')
  await page
    .getByRole('region', { name: 'Expenses', exact: true })
    .getByRole('button', { name: 'Edit Dinner', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Edit expense', exact: true })
  await change(dialog)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Expense updated')).toBeVisible()
}

test('lists what to confirm and counts it on the tools hub', async ({ page }) => {
  await linkAnna(page)
  await openToConfirm(page)
  await expect(section(page).getByRole('heading', { level: 2, name: 'To confirm', exact: true })).toBeVisible()
  await expect(section(page).getByRole('article')).toHaveCount(2)
  const dinner = item(page, 'Dinner')
  await expect(dinner).toContainText('Albania 2026')
  await expect(dinner).toContainText('New')
  await expect(dinner).toContainText('€120.00')
  await expect(dinner).toContainText('by Anna')
  const payment = item(page, 'Payment from Kasia')
  await expect(payment).toContainText('€20.00')
  await expect(payment).toContainText('New')
  const confirm = dinner.getByRole('button', { name: 'Confirm Dinner', exact: true })
  expect((await confirm.boundingBox())?.height).toBeGreaterThanOrEqual(44)

  await page.goto('/tools')
  const groups = page.getByRole('list', { name: 'Tools', exact: true }).getByRole('link', { name: /^Groups/ })
  await expect(groups).toContainText('2 to confirm')
  await expect(groups).toHaveAccessibleName('Groups')
})

test('shows no To confirm section before the user is linked', async ({ page }) => {
  await page.goto('/tools/groups')
  await expect(page.getByRole('heading', { level: 1, name: 'Groups', exact: true })).toBeVisible()
  await expect(section(page)).toHaveCount(0)
})

test('confirms an expense into an account', async ({ page, isMobile }) => {
  await linkAnna(page)
  const dialog = await openDinnerDialog(page)
  await expect(
    dialog.getByText('You paid €120.00 · your share €30.00 · owed to you €90.00', { exact: true }),
  ).toBeVisible()
  await expect(dialog.getByRole('combobox', { name: 'Account', exact: true })).not.toContainText('Gotówka')
  await expect(dialog.getByLabel(/^Exchange rate/)).toHaveCount(0)
  await chooseAccount(page, dialog, 'Gotówka · PLN')
  await expect(dialog.getByLabel('Exchange rate (EUR → PLN)', { exact: true })).toHaveValue(/^\d/)
  await expect(dialog.getByRole('combobox', { name: 'Category', exact: true })).toContainText('Kawiarnie')
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('Dinner')
  await expect(dialog.getByRole('button', { name: 'Remove tag dinner', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Added to your accounts', { exact: true })).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(section(page).getByRole('article')).toHaveCount(1)
  await expect(item(page, 'Dinner')).toHaveCount(0)
  await expect(item(page, 'Payment from Kasia').getByRole('button', { name: /^Confirm / })).toBeFocused()

  const booked = await openBookedDinner(page, isMobile)
  await expect(booked).toContainText('Kawiarnie')
  await expect(booked).toContainText('-€30.00')
})

test('creates a category on confirm', async ({ page, isMobile }) => {
  await linkAnna(page)
  await editDinner(page, async (dialog) => {
    await dialog.getByRole('combobox', { name: 'Category', exact: true }).click()
    await pickOverlayOption(page, 'Beach')
  })
  const dialog = await openDinnerDialog(page)
  const category = dialog.getByRole('combobox', { name: 'Category', exact: true })
  await expect(category).toContainText('New category: Beach')
  await chooseAccount(page, dialog, 'Gotówka · PLN')
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Added to your accounts', { exact: true })).toBeVisible()

  const booked = await openBookedDinner(page, isMobile)
  await expect(booked).toContainText('Beach')
  await expect(booked).toContainText('-€30.00')
})

test('rejects an item', async ({ page }) => {
  await linkAnna(page)
  await openToConfirm(page)
  await item(page, 'Payment from Kasia').getByRole('button', { name: 'Reject Payment from Kasia', exact: true }).click()
  const prompt = page.getByRole('alertdialog')
  await expect(prompt).toContainText('Reject this item?')
  await expect(prompt).toContainText('Nothing is added to your accounts. The group stays as it is.')
  await prompt.getByRole('button', { name: 'Reject', exact: true }).click()
  await expect(page.getByText('Item rejected', { exact: true })).toBeVisible()
  await expect(item(page, 'Payment from Kasia')).toHaveCount(0)
  await expect(item(page, 'Dinner')).toBeVisible()
  await expect(item(page, 'Dinner').getByRole('button', { name: 'Confirm Dinner', exact: true })).toBeFocused()

  await page.goto('/accounts')
  const gotowka = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Gotówka', exact: true }) })
  await expect(gotowka).toContainText('zł 940.00')
})

test('asks again after a confirmed entry changes', async ({ page }) => {
  await linkAnna(page)
  const dialog = await openDinnerDialog(page)
  await chooseAccount(page, dialog, 'Gotówka · PLN')
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Added to your accounts', { exact: true })).toBeVisible()

  await editDinner(page, async (edit) => {
    const amount = edit.getByLabel('Amount', { exact: true })
    await amount.fill('')
    await amount.pressSequentially('100')
  })
  await openToConfirm(page)
  const changed = item(page, 'Dinner')
  await expect(changed).toContainText('Changed')
  await expect(changed).toContainText('Amount: €120.00 → €100.00')
  await changed.getByRole('button', { name: 'Confirm Dinner', exact: true }).click()
  const again = page.getByRole('dialog', { name: 'Confirm Dinner', exact: true })
  await expect(again.getByRole('combobox', { name: 'Account', exact: true })).toContainText('Gotówka')
})

const rejectItem = async (page: Page, title: string) => {
  await item(page, title)
    .getByRole('button', { name: `Reject ${title}`, exact: true })
    .click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reject', exact: true }).click()
  await expect(page.getByText('Item rejected', { exact: true })).toBeVisible()
}

test('confirms the last remaining item and closes the dialog with a toast', async ({ page }) => {
  await linkAnna(page)
  await openToConfirm(page)
  await rejectItem(page, 'Payment from Kasia')
  await expect(page.getByText('Item rejected', { exact: true })).toBeHidden()
  await expect(section(page).getByRole('article')).toHaveCount(1)

  await item(page, 'Dinner').getByRole('button', { name: 'Confirm Dinner', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm Dinner', exact: true })
  await chooseAccount(page, dialog, 'Gotówka · PLN')
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Added to your accounts', { exact: true })).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(section(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Groups', exact: true })).toBeFocused()
})

test('rejects the last remaining item with a toast', async ({ page }) => {
  await linkAnna(page)
  const dialog = await openDinnerDialog(page)
  await chooseAccount(page, dialog, 'Gotówka · PLN')
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Added to your accounts', { exact: true })).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(section(page).getByRole('article')).toHaveCount(1)

  await rejectItem(page, 'Payment from Kasia')
  await expect(section(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Groups', exact: true })).toBeFocused()
})

test('confirms a removed item and takes it out of the accounts', async ({ page }) => {
  await linkAnna(page)
  const dialog = await openDinnerDialog(page)
  await chooseAccount(page, dialog, 'Gotówka · PLN')
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Added to your accounts', { exact: true })).toBeVisible()
  await expect(dialog).toBeHidden()

  await page.goto('/tools/groups/grp_albania')
  await page
    .getByRole('region', { name: 'Expenses', exact: true })
    .getByRole('button', { name: 'Edit Dinner', exact: true })
    .click()
  const edit = page.getByRole('dialog', { name: 'Edit expense', exact: true })
  await edit.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('Expense deleted')).toBeVisible()

  await openToConfirm(page)
  const removed = item(page, 'Dinner')
  await expect(removed).toContainText('Removed')
  await expect(removed).toContainText('This entry was deleted or no longer involves you.')
  await removed.getByRole('button', { name: 'Confirm Dinner', exact: true }).click()
  const again = page.getByRole('dialog', { name: 'Confirm Dinner', exact: true })
  await expect(again.getByRole('combobox', { name: 'Account', exact: true })).toHaveCount(0)
  await again.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Removed from your accounts', { exact: true })).toBeVisible()
  await expect(again).toBeHidden()
  await expect(item(page, 'Dinner')).toHaveCount(0)

  await page.goto('/transactions')
  await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible()
  await expect(page.getByRole('main').locator('tr, li, article').filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByRole('main').getByText('Dinner')).toHaveCount(0)
})
