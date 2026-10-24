import { expect, type Page, test } from '@playwright/test'

const settleButton = (page: Page) => page.getByRole('button', { name: 'Settle up', exact: true })
const repayments = (page: Page) => page.getByRole('region', { name: 'Repayments', exact: true })
const repaymentRow = (page: Page, title: string) => repayments(page).getByRole('article', { name: title, exact: true })

const openAlbania = async (page: Page) => {
  await page.goto('/tools/groups/grp_albania')
  await expect(page.getByRole('heading', { level: 1, name: 'Albania 2026', exact: true })).toBeVisible()
}

const linkAnna = async (page: Page) => {
  await openAlbania(page)
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  const members = page.getByRole('dialog', { name: 'Members', exact: true })
  await members.getByRole('button', { name: 'This is me: Anna', exact: true }).click()
  await expect(page.getByText('Linked to you', { exact: true })).toBeVisible()
  await members.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(members).toBeHidden()
}

test('settles a chosen share', async ({ page }) => {
  await openAlbania(page)
  await expect(settleButton(page)).toHaveCount(0)
  await linkAnna(page)
  await settleButton(page).click()
  const dialog = page.getByRole('dialog', { name: 'Settle up', exact: true })
  await expect(dialog.getByText('You owe Max', { exact: true })).toBeVisible()
  const share = dialog.getByRole('checkbox', { name: 'Boat trip €20.00', exact: true })
  const markPaid = dialog.getByRole('button', { name: 'Mark as paid', exact: true })
  await expect(markPaid).toBeDisabled()
  await share.check()
  await expect(markPaid).toBeEnabled()
  await markPaid.click()
  await expect(page.getByText('Payment recorded', { exact: true })).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(repaymentRow(page, 'Anna → Max')).toContainText('Covers: Boat trip')
  await settleButton(page).click()
  const reopened = page.getByRole('dialog', { name: 'Settle up', exact: true })
  await expect(reopened.getByRole('checkbox', { name: /^Boat trip/ })).toHaveCount(0)
  await expect(reopened.getByRole('checkbox', { name: 'Groceries €7.68', exact: true })).toBeVisible()
})

test('shows what a repayment covers', async ({ page }) => {
  await openAlbania(page)
  await expect(repaymentRow(page, 'Kasia → Anna')).toContainText('Covers: Dinner €20.00')
})

test('moves the focus to the page heading when the last open share is settled', async ({ page }) => {
  await linkAnna(page)
  await settleButton(page).click()
  const dialog = page.getByRole('dialog', { name: 'Settle up', exact: true })
  await dialog.getByRole('checkbox', { name: 'Boat trip €20.00', exact: true }).check()
  await dialog.getByRole('checkbox', { name: 'Groceries €7.68', exact: true }).check()
  await dialog.getByRole('button', { name: 'Mark as paid', exact: true }).click()

  await expect(page.getByText('2 payments recorded', { exact: true })).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(settleButton(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Albania 2026', exact: true })).toBeFocused()
})

test('edits the note of a repayment whose covered expense was deleted', async ({ page }) => {
  await linkAnna(page)
  await settleButton(page).click()
  const dialog = page.getByRole('dialog', { name: 'Settle up', exact: true })
  await dialog.getByRole('checkbox', { name: 'Boat trip €20.00', exact: true }).check()
  await dialog.getByRole('button', { name: 'Mark as paid', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(repaymentRow(page, 'Anna → Max')).toContainText('Covers: Boat trip')

  await page.getByRole('button', { name: 'Edit Boat trip', exact: true }).click()
  const expenseDialog = page.getByRole('dialog', { name: 'Edit expense', exact: true })
  await expenseDialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('Expense deleted', { exact: true })).toBeVisible()
  await expect(expenseDialog).toBeHidden()

  await repaymentRow(page, 'Anna → Max')
    .getByRole('button', { name: 'Edit repayment from Anna to Max', exact: true })
    .click()
  const edit = page.getByRole('dialog', { name: 'Edit repayment', exact: true })
  await edit.getByLabel('Note', { exact: true }).fill('Cash')
  await edit.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('Repayment updated', { exact: true })).toBeVisible()
  await expect(edit).toBeHidden()
  await expect(page.getByText('This share is not open between these members.')).toHaveCount(0)
  await expect(repaymentRow(page, 'Anna → Max')).toContainText('Cash')
})
