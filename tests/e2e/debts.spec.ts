import { expect, type Page, test } from '@playwright/test'
import { overlayOption, pickOverlayOption } from './overlayOption'

const dayFromToday = (offset: number) => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
const debtsRegion = (page: Page) => page.getByRole('region', { name: 'Personal debts', exact: true })
const cards = (page: Page) => debtsRegion(page).getByRole('article')
const card = (page: Page, name: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
const summary = (page: Page, key: 'owed-to-me' | 'owed-by-me' | 'overdue') => page.getByTestId(`debts-summary-${key}`)

const openNewDebt = async (page: Page) => {
  await page.goto('/tools/debts')
  await expect(cards(page)).toHaveCount(3)
  await page.getByRole('button', { name: 'New debt' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'New debt' })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  return dialog
}

const lendToOlaFromCash = async (page: Page) => {
  const dialog = await openNewDebt(page)
  await dialog.getByRole('button', { name: 'I lent', exact: true }).click()
  await dialog.getByLabel('Who', { exact: true }).fill('Ola')
  await dialog.getByLabel('Amount').pressSequentially('100')
  await dialog.getByRole('combobox', { name: 'Account' }).click()
  await pickOverlayOption(page, 'Gotówka · PLN')
  await expect(dialog.getByText('The amount leaves this account.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Debt saved')).toBeVisible()
  await expect(card(page, 'Ola')).toContainText('zł 100.00')
}

const cashBalance = async (page: Page, amount: string) => {
  await page.goto('/accounts')
  await expect(card(page, 'Gotówka')).toContainText(amount)
}

const openRepayment = async (page: Page, name: string, title: string) => {
  await page.goto('/tools/debts')
  await card(page, name)
    .getByRole('button', { name: `Record a repayment for ${name}`, exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: title })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  return dialog
}

const newDebtButton = (page: Page) => page.getByRole('button', { name: 'New debt', exact: true })

test('shows the seeded debts with the overdue one highlighted', async ({ page }) => {
  await page.goto('/tools/debts')
  await expect(page.getByRole('heading', { level: 1, name: 'Debts', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Debts · Mita')
  await expect(summary(page, 'owed-by-me')).toContainText('I owe')
  await expect(summary(page, 'owed-by-me')).toContainText('zł 1,500.00')
  await expect(summary(page, 'owed-to-me')).toContainText('Owed to me')
  await expect(summary(page, 'overdue')).toHaveText(/^\s*Overdue\s*1\s*$/)
  await expect(cards(page).getByRole('heading')).toHaveText(['Kasia', 'Max', 'Mama'])

  const kasia = card(page, 'Kasia')
  await expect(kasia.locator('[data-overdue]')).toHaveText(`Overdue · due ${dayFromToday(-5)}`)
  await expect(kasia).toContainText('€50.00')
  await expect(kasia).toContainText(`Since ${dayFromToday(-40)}`)
  await expect(kasia.getByRole('button', { name: 'Record a repayment for Kasia', exact: true })).toBeVisible()

  const max = card(page, 'Max')
  await expect(max).toContainText('Owed to me')
  await expect(max).toContainText('zł 400.00')
  await expect(max).toContainText('of zł 500.00')
  await expect(max).toContainText(`Due ${dayFromToday(10)}`)
  await expect(max).toContainText('Gotówka')
  await expect(max.locator('[data-overdue]')).toHaveCount(0)
  await expect(max.getByRole('progressbar', { name: 'Max: share repaid' })).toHaveAttribute('aria-valuenow', '20')
  const edit = max.getByRole('button', { name: 'Edit Max', exact: true })
  await expect(edit).toBeVisible()
  expect((await edit.boundingBox())?.height).toBeGreaterThanOrEqual(44)

  await expect(card(page, 'Mama')).toContainText('I owe')

  await page.getByRole('button', { name: 'Settled', exact: true }).click()
  await expect(cards(page).getByRole('heading')).toHaveText(['Tomek'])
  const tomek = card(page, 'Tomek')
  await expect(tomek.getByRole('button', { name: 'Record a repayment for Tomek' })).toHaveCount(0)
  await expect(tomek.getByRole('button', { name: 'Edit Tomek', exact: true })).toBeVisible()
  await expect(summary(page, 'owed-by-me')).toContainText('zł 1,500.00')
})

test('lends money from an account', async ({ page }) => {
  await lendToOlaFromCash(page)
  await expect(card(page, 'Ola')).toContainText('Owed to me')
  await cashBalance(page, 'zł 840.00')
})

test('borrows without an account', async ({ page }) => {
  await page.goto('/accounts')
  const total = page.getByTestId('accounts-total')
  await expect(total).toBeVisible()
  const before = await total.textContent()
  const dialog = await openNewDebt(page)
  await dialog.getByRole('button', { name: 'I borrowed', exact: true }).click()
  await expect(dialog.getByText('The amount enters this account.')).toBeVisible()
  await dialog.getByLabel('Who', { exact: true }).fill('Bank')
  await dialog.getByLabel('Amount').pressSequentially('300')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Debt saved')).toBeVisible()
  await expect(card(page, 'Bank')).toContainText('I owe')
  await expect(summary(page, 'owed-by-me')).toContainText('zł 1,800.00')
  await page.goto('/accounts')
  await expect(total).toHaveText(before ?? '')
})

test('edits and deletes a debt', async ({ page }) => {
  await lendToOlaFromCash(page)
  await card(page, 'Ola').getByRole('button', { name: 'Edit Ola', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit debt' })
  await expect(edit.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await expect(edit.getByLabel('Who', { exact: true })).toHaveValue('Ola')
  await expect(edit.getByRole('combobox', { name: 'Account' })).toContainText('Gotówka · PLN')
  const amount = edit.getByLabel('Amount')
  await amount.fill('')
  await amount.pressSequentially('120')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Debt updated')).toBeVisible()
  await expect(card(page, 'Ola')).toContainText('zł 120.00')
  await cashBalance(page, 'zł 820.00')

  await page.goto('/tools/debts')
  await card(page, 'Ola').getByRole('button', { name: 'Edit Ola', exact: true }).click()
  await edit.getByRole('button', { name: 'Delete' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Delete the debt?')
  await expect(confirm).toContainText('“Ola” and its repayments will be deleted. Account balances are restored.')
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Debt deleted')).toBeVisible()
  await expect(card(page, 'Ola')).toHaveCount(0)
  await expect(cards(page)).toHaveCount(3)
  const focused = page.locator(':focus')
  await expect(focused).toHaveAccessibleName('New debt')
  await expect(focused).toBeVisible()
  await cashBalance(page, 'zł 940.00')
})

test('prices a debt in another currency and keeps its rate on edit', async ({ page }) => {
  const dialog = await openNewDebt(page)
  await dialog.getByRole('button', { name: 'I lent', exact: true }).click()
  await dialog.getByLabel('Who', { exact: true }).fill('Eva')
  await dialog.getByRole('combobox', { name: 'Account' }).click()
  await pickOverlayOption(page, 'Gotówka · PLN')
  await expect(overlayOption(page, 'Gotówka · PLN')).toHaveCount(0)
  const converted = dialog.locator('p[aria-live="polite"]')
  await expect(converted).toHaveText('')
  await dialog.getByRole('combobox', { name: 'Currency' }).click()
  await pickOverlayOption(page, 'EUR — Euro')
  const rate = dialog.getByLabel('Exchange rate (EUR → PLN)')
  await expect(rate).toHaveValue(/^4[.,]/)
  await rate.fill('')
  await rate.pressSequentially('4.50')
  await dialog.getByLabel('Amount').pressSequentially('50')
  await expect(converted).toHaveText('On the account: zł 225.00')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Debt saved')).toBeVisible()
  await expect(card(page, 'Eva')).toContainText('€50.00')
  await cashBalance(page, 'zł 715.00')

  await page.goto('/tools/debts')
  await card(page, 'Eva').getByRole('button', { name: 'Edit Eva', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit debt' })
  await expect(edit.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await expect(edit.getByLabel('Exchange rate (EUR → PLN)')).toHaveValue('4.50')
  await edit.getByLabel('Note', { exact: true }).fill('Concert tickets')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Debt updated')).toBeVisible()
  await expect(card(page, 'Eva')).toContainText('Concert tickets')
  await cashBalance(page, 'zł 715.00')

  await page.goto('/tools/debts')
  await card(page, 'Max').getByRole('button', { name: 'Edit Max', exact: true }).click()
  await expect(edit.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  const currency = edit.getByRole('combobox', { name: 'Currency' })
  await expect(currency).toBeDisabled()
  await expect(edit.getByText('The currency cannot change once a repayment is recorded.')).toBeVisible()
  await expect(currency).toHaveAccessibleDescription('The currency cannot change once a repayment is recorded.')
})

test('refuses a due date before the date', async ({ page }) => {
  const dialog = await openNewDebt(page)
  await dialog.getByLabel('Who', { exact: true }).fill('Ola')
  await dialog.getByLabel('Amount').pressSequentially('100')
  const due = dialog.getByLabel('Due date', { exact: true })
  await due.fill('01/01/2020')
  await due.press('Escape')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('The due date cannot be before the date of the debt.')).toBeVisible()
  await expect(due).toHaveAttribute('aria-invalid', 'true')
  await expect(due).toBeFocused()
})

test('records a partial repayment into an account', async ({ page }) => {
  const dialog = await openRepayment(page, 'Max', 'Repayment from Max')
  await expect(dialog.getByRole('combobox', { name: 'Currency' })).toContainText('PLN')
  await expect(dialog.getByRole('combobox', { name: 'Account' })).toContainText('Gotówka · PLN')
  await expect(dialog.getByText('The money enters this account.')).toBeVisible()
  await expect(dialog.getByText('Left to repay: zł 400.00')).toBeVisible()
  await dialog.getByLabel('Amount').pressSequentially('100')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Repayment saved')).toBeVisible()
  const max = card(page, 'Max')
  await expect(max).toContainText('zł 300.00')
  await expect(max).toContainText('of zł 500.00')
  await cashBalance(page, 'zł 1,040.00')
})

test('settles a debt with repay the rest', async ({ page }) => {
  const dialog = await openRepayment(page, 'Kasia', 'Repayment from Kasia')
  await expect(dialog.getByRole('combobox', { name: 'Account' })).toContainText('No account')
  await dialog.getByRole('button', { name: 'Repay the rest', exact: true }).click()
  await expect(dialog.getByLabel('Amount')).toHaveValue('€50.00')
  await expect(dialog.getByRole('combobox', { name: 'Currency' })).toContainText('EUR')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Repayment saved')).toBeVisible()
  await expect(card(page, 'Kasia')).toHaveCount(0)
  await expect(cards(page).getByRole('heading')).toHaveText(['Max', 'Mama'])
  await expect(summary(page, 'overdue')).toHaveText(/^\s*Overdue\s*0\s*$/)
  const focused = page.locator(':focus')
  await expect(focused).toHaveAccessibleName('New debt')
  await expect(focused).toBeVisible()
  await page.getByRole('button', { name: 'Settled', exact: true }).click()
  await expect(cards(page).getByRole('heading')).toHaveText(['Kasia', 'Tomek'])
  await expect(card(page, 'Kasia')).toContainText('€0.00')
})

test('repays in another currency', async ({ page }) => {
  const dialog = await openRepayment(page, 'Mama', 'Repayment to Mama')
  await expect(dialog.getByRole('combobox', { name: 'Account' })).toContainText('Konto główne · PLN')
  await expect(dialog.getByText('The money leaves this account.')).toBeVisible()
  await dialog.getByLabel('Amount').pressSequentially('100')
  await expect(dialog.locator('p[aria-live="polite"]')).toHaveText('')
  await dialog.getByRole('combobox', { name: 'Currency' }).click()
  await pickOverlayOption(page, 'EUR — Euro')
  const rate = dialog.getByLabel('Exchange rate (EUR → PLN)')
  await expect(rate).toHaveValue(/^4\.\d+$/)
  await rate.fill('')
  await rate.pressSequentially('4.30')
  await expect(dialog.getByText('Reduces the debt by zł 430.00')).toBeVisible()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Repayment saved')).toBeVisible()
  await expect(card(page, 'Mama')).toContainText('zł 1,070.00')
})

test('refuses more than what is left', async ({ page }) => {
  const dialog = await openRepayment(page, 'Max', 'Repayment from Max')
  const amount = dialog.getByLabel('Amount')
  await amount.pressSequentially('401')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('The repayment is more than what is still owed.')).toBeVisible()
  await expect(amount).toHaveAttribute('aria-invalid', 'true')
  await expect(amount).toBeFocused()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await expect(card(page, 'Max')).toContainText('zł 400.00')
})

test('deletes a repayment from the history', async ({ page }) => {
  await page.goto('/tools/debts')
  const max = card(page, 'Max')
  await expect(card(page, 'Kasia').getByRole('button', { name: 'Repayment history for Kasia' })).toHaveCount(0)
  const history = max.getByRole('button', { name: 'Repayment history for Max', exact: true })
  await expect(history).toHaveAttribute('aria-expanded', 'false')
  await history.click()
  await expect(history).toHaveAttribute('aria-expanded', 'true')
  const rows = max.getByRole('list', { name: 'Repayments' }).getByRole('listitem')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(dayFromToday(-5))
  await expect(rows.first()).toContainText('zł 100.00')
  await expect(rows.first()).toContainText('Gotówka')
  const remove = rows.first().getByRole('button', { name: `Delete the repayment of ${dayFromToday(-5)}`, exact: true })
  expect((await remove.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  await remove.click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Delete this repayment?')
  await expect(confirm).toContainText('The debt and the account balance are restored.')
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Repayment deleted')).toBeVisible()
  await expect(max).toContainText('zł 500.00')
  await expect(max).not.toContainText('of zł 500.00')
  await expect(history).toHaveCount(0)
  await expect(max.getByRole('button', { name: 'Record a repayment for Max', exact: true })).toBeFocused()
  await cashBalance(page, 'zł 840.00')
})

test('shows a failed account conversion of a repayment under the account', async ({ page }) => {
  const dialog = await openRepayment(page, 'Max', 'Repayment from Max')
  await dialog.getByLabel('Amount').pressSequentially('0.01')
  const account = dialog.getByRole('combobox', { name: 'Account' })
  await account.click()
  await pickOverlayOption(page, 'Konto EUR · EUR')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('Enter an amount above zero.')).toBeVisible()
  await expect(account).toHaveAttribute('aria-invalid', 'true')
  await expect(account).toBeFocused()
  await expect(dialog).toBeVisible()
})

test('moves the focus to New debt when an edit moves the debt to the other list', async ({ page }) => {
  await page.goto('/tools/debts')
  await card(page, 'Max').getByRole('button', { name: 'Edit Max', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit debt' })
  await expect(edit.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  const amount = edit.getByLabel('Amount')
  await amount.fill('')
  await amount.pressSequentially('100')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(edit).toBeHidden()
  await expect(cards(page).getByRole('heading')).toHaveText(['Kasia', 'Mama'])
  await expect(newDebtButton(page)).toBeFocused()

  await page.getByRole('button', { name: 'Settled', exact: true }).click()
  await expect(cards(page).getByRole('heading')).toHaveText(['Max', 'Tomek'])
  await card(page, 'Tomek').getByRole('button', { name: 'Edit Tomek', exact: true }).click()
  await expect(edit.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await amount.fill('')
  await amount.pressSequentially('150')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(edit).toBeHidden()
  await expect(cards(page).getByRole('heading')).toHaveText(['Max'])
  await expect(newDebtButton(page)).toBeFocused()
})

test('moves the focus to New debt when deleting a repayment reopens a settled debt', async ({ page }) => {
  await page.goto('/tools/debts')
  await page.getByRole('button', { name: 'Settled', exact: true }).click()
  const tomek = card(page, 'Tomek')
  await tomek.getByRole('button', { name: 'Repayment history for Tomek', exact: true }).click()
  await tomek.getByRole('button', { name: `Delete the repayment of ${dayFromToday(-70)}`, exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Repayment deleted')).toBeVisible()
  await expect(tomek).toHaveCount(0)
  await expect(page.getByText('No settled debts yet')).toBeVisible()
  await expect(newDebtButton(page)).toBeFocused()
})

const groupsRegion = (page: Page) => page.getByRole('region', { name: 'Groups', exact: true })
const groupLine = (page: Page, name: string) => groupsRegion(page).getByRole('link', { name, exact: true })
const inMain = (page: Page, name: string) => page.getByRole('main').getByRole('link', { name, exact: true })
const toolsEntry = (page: Page, name: string) =>
  page.getByRole('list', { name: 'Tools', exact: true }).getByRole('link', { name, exact: true })

const openGroupsFromDebts = async (page: Page) => {
  await inMain(page, 'Tools').click()
  await toolsEntry(page, 'Groups').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Groups', exact: true })).toBeVisible()
}

const openDebtsFromGroups = async (page: Page) => {
  await inMain(page, 'Tools').click()
  await toolsEntry(page, 'Debts').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Debts', exact: true })).toBeVisible()
}

test('shows the balance of a group you are linked to', async ({ page }) => {
  await page.goto('/tools/debts')
  await expect(cards(page)).toHaveCount(3)
  await expect(groupsRegion(page)).toHaveCount(0)
  const owedToMeBefore = await summary(page, 'owed-to-me').textContent()

  await openGroupsFromDebts(page)
  await page
    .getByRole('list', { name: 'Groups', exact: true })
    .getByRole('link', { name: 'Albania 2026', exact: true })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Albania 2026', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  const members = page.getByRole('dialog', { name: 'Members', exact: true })
  await members.getByRole('button', { name: 'This is me: Anna', exact: true }).click()
  await expect(page.getByText('Linked to you', { exact: true })).toBeVisible()
  await members.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(members).toBeHidden()
  await inMain(page, 'Groups').click()
  await openDebtsFromGroups(page)

  const groups = groupsRegion(page)
  await expect(groups.getByRole('heading', { level: 2, name: 'Groups', exact: true })).toBeVisible()
  await expect(groups.getByRole('link')).toHaveCount(1)
  const line = groupLine(page, 'Albania 2026')
  await expect(line).toContainText('+€42.32')
  await expect(line).toContainText('You get back')
  await expect(line).toHaveAttribute('href', '/tools/groups/grp_albania')
  expect((await line.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  await expect(summary(page, 'owed-to-me')).not.toHaveText(owedToMeBefore ?? '')
  const personalTop = (await debtsRegion(page).boundingBox())?.y ?? Number.POSITIVE_INFINITY
  const groupsTop = (await groups.boundingBox())?.y ?? 0
  expect(personalTop).toBeLessThan(groupsTop)

  await page.reload()
  await expect(groupLine(page, 'Albania 2026')).toContainText('+€42.32')
  await line.click()
  await expect(page).toHaveURL('/tools/groups/grp_albania')
  await expect(page.getByRole('heading', { level: 1, name: 'Albania 2026', exact: true })).toBeVisible()
})

test('counts accepted groups in I owe', async ({ page }) => {
  await page.goto('/tools/debts')
  await expect(summary(page, 'owed-by-me')).toContainText('zł 1,500.00')
  await expect(groupsRegion(page)).toHaveCount(0)

  await openGroupsFromDebts(page)
  await page
    .getByRole('region', { name: 'Invitations', exact: true })
    .getByRole('button', { name: 'Accept the invitation to Kraków', exact: true })
    .click()
  await expect(page.getByText('You joined “Kraków”', { exact: true })).toBeVisible()
  await openDebtsFromGroups(page)

  const line = groupLine(page, 'Kraków')
  await expect(line).toContainText('-zł 100.00')
  await expect(line).toContainText('You owe')
  await expect(line).toHaveAttribute('href', '/tools/groups/grp_krakow')
  await expect(summary(page, 'owed-by-me')).toContainText('zł 1,600.00')
  await expect(cards(page)).toHaveCount(3)
})

test('drops a group you left from the debts at once', async ({ page }) => {
  await page.goto('/tools/debts')
  await expect(summary(page, 'owed-by-me')).toContainText('zł 1,500.00')

  await openGroupsFromDebts(page)
  await page
    .getByRole('region', { name: 'Invitations', exact: true })
    .getByRole('button', { name: 'Accept the invitation to Kraków', exact: true })
    .click()
  await expect(page.getByText('You joined “Kraków”', { exact: true })).toBeVisible()
  await openDebtsFromGroups(page)
  await expect(groupLine(page, 'Kraków')).toContainText('-zł 100.00')
  await expect(summary(page, 'owed-by-me')).toContainText('zł 1,600.00')

  await openGroupsFromDebts(page)
  await page
    .getByRole('list', { name: 'Groups', exact: true })
    .getByRole('link', { name: 'Kraków', exact: true })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Kraków', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Leave group', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Leave group', exact: true }).click()
  await expect(page.getByText('You left the group', { exact: true })).toBeVisible()
  await expect(page).toHaveURL('/tools/groups')
  await openDebtsFromGroups(page)

  await expect(summary(page, 'owed-by-me')).toContainText('zł 1,500.00')
  await expect(groupLine(page, 'Kraków')).toHaveCount(0)
  await expect(groupsRegion(page)).toHaveCount(0)
})

test('/pl/tools/debts shows the page in Polish', async ({ page }) => {
  await page.goto('/pl/tools/debts')
  await expect(page.getByRole('heading', { level: 1, name: 'Długi', exact: true })).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: 'Narzędzia', exact: true })).toHaveAttribute(
    'href',
    '/pl/tools',
  )
  await expect(card(page, 'Max')).toContainText(/400,00\s?zł/)
})
