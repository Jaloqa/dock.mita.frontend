import { expect, type Locator, type Page, test } from '@playwright/test'
import { pickOverlayOption } from './overlayOption'

const dayFromToday = (offset: number) => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const expenses = (page: Page) => page.getByRole('region', { name: 'Expenses', exact: true })
const rows = (page: Page) => expenses(page).getByRole('article')
const row = (page: Page, title: string) => expenses(page).getByRole('article', { name: title, exact: true })
const titles = (page: Page) => expenses(page).getByRole('heading', { level: 3 })
const total = (page: Page) => page.getByTestId('group-summary-total')
const addExpenseButton = (page: Page) => page.getByRole('button', { name: 'Add expense', exact: true })
const saveButton = (dialog: Locator) => dialog.getByRole('button', { name: 'Save', exact: true })
const amountField = (dialog: Locator) => dialog.getByLabel('Amount', { exact: true })

const openAlbania = async (page: Page) => {
  await page.goto('/tools/groups/grp_albania')
  await expect(page.getByRole('heading', { level: 1, name: 'Albania 2026', exact: true })).toBeVisible()
  await expect(rows(page)).toHaveCount(3)
}

const openNewExpense = async (page: Page) => {
  await openAlbania(page)
  await addExpenseButton(page).click()
  const dialog = page.getByRole('dialog', { name: 'New expense', exact: true })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  return dialog
}

const openEdit = async (page: Page, title: string) => {
  await openAlbania(page)
  await row(page, title)
    .getByRole('button', { name: `Edit ${title}`, exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Edit expense', exact: true })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  return dialog
}

const choosePayer = async (page: Page, dialog: Locator, name: string) => {
  const payer = dialog.getByRole('combobox', { name: 'Paid by', exact: true })
  await payer.click()
  await pickOverlayOption(page, name)
  await expect(payer).toContainText(name)
  await expect(page.locator('[data-pc-section="overlay"]')).toHaveCount(0)
}

const typeInto = async (field: Locator, text: string) => {
  await field.fill('')
  await field.pressSequentially(text)
}

test('lists the expenses newest first', async ({ page }) => {
  await openAlbania(page)
  await expect(expenses(page).getByRole('heading', { level: 2, name: 'Expenses', exact: true })).toBeVisible()
  await expect(titles(page)).toHaveText(['Boat trip', 'Groceries', 'Dinner'])
  await expect(row(page, 'Taxi')).toHaveCount(0)

  const groceries = row(page, 'Groceries')
  await expect(groceries).toContainText(dayFromToday(-9))
  await expect(groceries).toContainText('Paid by Olya')
  await expect(groceries).toContainText('ALL 3,000.00')
  await expect(groceries).toContainText('= €30.70')
  await expect(groceries).toContainText('Split equally between everyone')

  const boat = row(page, 'Boat trip')
  await expect(boat).toContainText('Paid by Max')
  await expect(boat).toContainText('€40.00')
  await expect(boat).not.toContainText('= €')
  await expect(boat).toContainText('Leisure')
  await expect(boat).toContainText('Split equally: Anna, Max')
  await expect(boat).toContainText('Added by Anna Nowak')
  await expect(boat).not.toContainText('Edited by')

  const dinner = row(page, 'Dinner')
  await expect(dinner).toContainText('€120.00')
  await expect(dinner).toContainText('Cafes')
  await expect(dinner.getByRole('list', { name: 'Tags', exact: true })).toHaveText('dinner')
  await expect(dinner).toContainText('Edited by Anna Nowak')
  const edit = dinner.getByRole('button', { name: 'Edit Dinner', exact: true })
  const box = await edit.boundingBox()
  expect(box?.height).toBeGreaterThanOrEqual(44)
  expect(box?.width).toBeGreaterThanOrEqual(44)
  const add = await addExpenseButton(page).boundingBox()
  expect(add?.height).toBeGreaterThanOrEqual(44)
  await expect(expenses(page).getByRole('button', { name: 'Show more', exact: true })).toHaveCount(0)
})

test('adds an expense split equally', async ({ page }) => {
  const dialog = await openNewExpense(page)
  await expect(dialog.getByRole('combobox', { name: 'Currency', exact: true })).toContainText('EUR')
  await expect(dialog.getByRole('combobox', { name: 'Category', exact: true })).toContainText('Other')
  await expect(dialog.getByRole('button', { name: 'Equally', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const name of ['Anna', 'Olya', 'Max', 'Kasia'])
    await expect(dialog.getByLabel(name, { exact: true })).toBeChecked()
  await expect(dialog.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)

  await choosePayer(page, dialog, 'Anna')
  await amountField(dialog).pressSequentially('30')
  await expect(dialog.getByLabel('Anna', { exact: true })).toHaveAccessibleDescription('€7.50')
  await dialog.getByLabel('Description', { exact: true }).fill('Coffee')
  await saveButton(dialog).click()

  await expect(page.getByText('Expense added')).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(titles(page).first()).toHaveText('Coffee')
  const coffee = row(page, 'Coffee')
  await expect(coffee).toContainText('Paid by Anna')
  await expect(coffee).toContainText('€30.00')
  await expect(coffee).toContainText(dayFromToday(0))
  await expect(coffee).toContainText('Split equally between everyone')
  await expect(total(page)).toContainText('€220.70')
})

test('splits equally between the chosen members with the remainder to the payer', async ({ page }) => {
  const dialog = await openNewExpense(page)
  await choosePayer(page, dialog, 'Olya')
  await amountField(dialog).pressSequentially('100')
  await dialog.getByLabel('Kasia', { exact: true }).uncheck()
  await expect(dialog.getByLabel('Anna', { exact: true })).toHaveAccessibleDescription('€33.33')
  await expect(dialog.getByLabel('Olya', { exact: true })).toHaveAccessibleDescription('€33.34')
  await expect(dialog.getByLabel('Max', { exact: true })).toHaveAccessibleDescription('€33.33')
  await dialog.getByLabel('Description', { exact: true }).fill('Museum')
  await saveButton(dialog).click()
  await expect(page.getByText('Expense added')).toBeVisible()
  await expect(row(page, 'Museum')).toContainText('Split equally: Anna, Olya, Max')
})

test('adds an expense in another currency with exact amounts', async ({ page }) => {
  const dialog = await openNewExpense(page)
  await choosePayer(page, dialog, 'Olya')
  await amountField(dialog).pressSequentially('200')
  await dialog.getByRole('combobox', { name: 'Currency', exact: true }).click()
  await pickOverlayOption(page, 'PLN — Polish Zloty')
  const rate = dialog.getByLabel('Exchange rate (PLN → EUR)', { exact: true })
  await expect(rate).toHaveValue(/^0\.\d+$/)
  await expect(rate).toHaveAccessibleDescription('Official NBP rate of the date. Change it to use your own.')
  await typeInto(rate, '0.25')
  await expect(dialog.getByText('= €50.00', { exact: true })).toBeVisible()

  await dialog.getByRole('button', { name: 'Exact amounts', exact: true }).click()
  await dialog.getByLabel('Olya', { exact: true }).pressSequentially('50')
  await expect(dialog.getByText('Left to assign: zł 150.00', { exact: true })).toBeVisible()
  await dialog.getByLabel('Max', { exact: true }).pressSequentially('150')
  await expect(dialog.getByText(/^(Left to assign|Assigned too much)/)).toHaveCount(0)
  await saveButton(dialog).click()

  await expect(page.getByText('Expense added')).toBeVisible()
  await expect(titles(page).first()).toHaveText('Other')
  const added = row(page, 'Other')
  await expect(added).toContainText('Paid by Olya')
  await expect(added).toContainText('zł 200.00')
  await expect(added).toContainText('= €50.00')
  await expect(added).toContainText('Exact amounts')
  await expect(total(page)).toContainText('€240.70')
})

test('refuses exact amounts that do not add up', async ({ page }) => {
  const dialog = await openNewExpense(page)
  await choosePayer(page, dialog, 'Anna')
  await amountField(dialog).pressSequentially('100')
  await dialog.getByRole('button', { name: 'Exact amounts', exact: true }).click()
  const anna = dialog.getByLabel('Anna', { exact: true })
  const olya = dialog.getByLabel('Olya', { exact: true })
  await anna.pressSequentially('40')
  await olya.pressSequentially('59.99')
  await expect(dialog.getByText('Left to assign: €0.01', { exact: true })).toBeVisible()
  await saveButton(dialog).click()
  await expect(dialog.getByText('The amounts must add up to the total.')).toBeVisible()
  await expect(anna).toHaveAttribute('aria-invalid', 'true')
  await expect(anna).toBeFocused()
  await expect(dialog).toBeVisible()

  await typeInto(olya, '60.01')
  await expect(dialog.getByText('Assigned too much: €0.01', { exact: true })).toBeVisible()
  await typeInto(olya, '60')
  await expect(dialog.getByText('The amounts must add up to the total.')).toHaveCount(0)
  await saveButton(dialog).click()
  await expect(page.getByText('Expense added')).toBeVisible()
  await expect(row(page, 'Other')).toContainText('Exact amounts')
})

test('types the amounts in the digits of the currency', async ({ page }) => {
  const dialog = await openNewExpense(page)
  const currency = dialog.getByRole('combobox', { name: 'Currency', exact: true })
  await currency.click()
  await pickOverlayOption(page, 'JPY — Japanese Yen')
  await amountField(dialog).pressSequentially('1000')
  await expect(amountField(dialog)).toHaveValue('¥1,000')
  await dialog.getByRole('button', { name: 'Exact amounts', exact: true }).click()
  const anna = dialog.getByLabel('Anna', { exact: true })
  await anna.pressSequentially('400')
  await expect(anna).toHaveValue('¥400')
  await expect(dialog.getByText('Left to assign: ¥600', { exact: true })).toBeVisible()

  await currency.click()
  await pickOverlayOption(page, 'KWD — Kuwaiti Dinar')
  await expect(amountField(dialog)).toHaveValue(/^KWD\s1,000\.000$/)
  await expect(anna).toHaveValue(/^KWD\s400\.000$/)
  await typeInto(anna, '0.125')
  await expect(anna).toHaveValue(/^KWD\s0\.125$/)
  await expect(dialog.getByText(/^Left to assign: KWD\s999\.875$/)).toBeVisible()
})

test('checks the expense before sending it', async ({ page }) => {
  const dialog = await openNewExpense(page)
  for (const name of ['Anna', 'Olya', 'Max', 'Kasia']) await dialog.getByLabel(name, { exact: true }).uncheck()
  await saveButton(dialog).click()
  await expect(dialog.getByText('This field is required.')).toHaveCount(2)
  await expect(dialog.getByText('Choose at least one member.')).toBeVisible()
  await expect(dialog.getByRole('combobox', { name: 'Paid by', exact: true })).toBeFocused()
  await dialog.getByLabel('Description', { exact: true }).fill('x'.repeat(101))
  await expect(dialog.getByText('Use at most 100 characters.')).toBeVisible()
  await dialog.getByLabel('Olya', { exact: true }).check()
  await expect(dialog.getByText('Choose at least one member.')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'New expense', exact: true })).toBeVisible()
})

test('adds a group category from the dialog', async ({ page }) => {
  const dialog = await openNewExpense(page)
  await choosePayer(page, dialog, 'Max')
  await amountField(dialog).pressSequentially('12')
  const category = dialog.getByRole('combobox', { name: 'Category', exact: true })
  const newCategory = dialog.getByRole('button', { name: 'New category', exact: true })
  await newCategory.click()
  await expect(newCategory).toHaveAttribute('aria-expanded', 'true')
  const name = dialog.getByRole('textbox', { name: 'New category', exact: true })
  await expect(name).toBeFocused()

  await name.fill('beach')
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dialog.getByText('A category with this name already exists.')).toBeVisible()
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  await name.fill('Spożywcze')
  await name.press('Enter')
  await expect(dialog.getByText('A category with this name already exists.')).toBeVisible()
  await expect(name).toBeFocused()
  await expect(dialog).toBeVisible()

  await name.fill('Ferry')
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(category).toContainText('Ferry')
  await expect(name).toHaveCount(0)
  await expect(newCategory).toHaveAttribute('aria-expanded', 'false')
  await saveButton(dialog).click()

  await expect(page.getByText('Expense added')).toBeVisible()
  await expect(titles(page).first()).toHaveText('Ferry')
  await expect(row(page, 'Ferry')).toContainText('Paid by Max')
})

test('suggests the tags used in the group', async ({ page }) => {
  const dialog = await openNewExpense(page)
  await choosePayer(page, dialog, 'Kasia')
  await amountField(dialog).pressSequentially('8')
  const tags = dialog.getByRole('combobox', { name: 'Tags', exact: true })
  await tags.pressSequentially('din')
  await pickOverlayOption(page, 'dinner')
  await tags.pressSequentially('late')
  await tags.press('Enter')
  await expect(dialog.getByRole('button', { name: 'Remove tag dinner', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Remove tag late', exact: true })).toBeVisible()
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Description', { exact: true }).fill('Snack')
  await saveButton(dialog).click()
  await expect(page.getByText('Expense added')).toBeVisible()
  await expect(row(page, 'Snack').getByRole('list', { name: 'Tags', exact: true }).getByRole('listitem')).toHaveText([
    'dinner',
    'late',
  ])
})

test('edits an expense', async ({ page }) => {
  const dialog = await openEdit(page, 'Dinner')
  await expect(dialog.getByRole('combobox', { name: 'Paid by', exact: true })).toContainText('Anna')
  await expect(amountField(dialog)).toHaveValue('€120.00')
  await expect(dialog.getByRole('combobox', { name: 'Category', exact: true })).toContainText('Cafes')
  await expect(dialog.getByLabel('Description', { exact: true })).toHaveValue('Dinner')
  await expect(dialog.getByRole('button', { name: 'Remove tag dinner', exact: true })).toBeVisible()
  await typeInto(amountField(dialog), '100')
  await saveButton(dialog).click()

  await expect(page.getByText('Expense updated')).toBeVisible()
  const dinner = row(page, 'Dinner')
  await expect(dinner).toContainText('€100.00')
  await expect(dinner).toContainText('Edited by Anna Nowak')
  await expect(dinner).toContainText('Split equally between everyone')
  await expect(total(page)).toContainText('€170.70')
})

test('keeps the manual rate of an expense when it is edited', async ({ page }) => {
  const dialog = await openEdit(page, 'Groceries')
  await expect(dialog.getByLabel('Exchange rate (ALL → EUR)', { exact: true })).toHaveValue('0.0102326')
  await dialog.getByLabel('Description', { exact: true }).fill('Market')
  await saveButton(dialog).click()
  await expect(page.getByText('Expense updated')).toBeVisible()
  const market = row(page, 'Market')
  await expect(market).toContainText('ALL 3,000.00')
  await expect(market).toContainText('= €30.70')
  await expect(total(page)).toContainText('€190.70')
})

test('keeps an exact split when an expense is edited', async ({ page }) => {
  const dialog = await openNewExpense(page)
  await choosePayer(page, dialog, 'Anna')
  await amountField(dialog).pressSequentially('10')
  await dialog.getByRole('button', { name: 'Exact amounts', exact: true }).click()
  await dialog.getByLabel('Anna', { exact: true }).pressSequentially('4')
  await dialog.getByLabel('Max', { exact: true }).pressSequentially('6')
  await dialog.getByLabel('Description', { exact: true }).fill('Ice cream')
  await saveButton(dialog).click()
  await expect(page.getByText('Expense added')).toBeVisible()

  await row(page, 'Ice cream').getByRole('button', { name: 'Edit Ice cream', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit expense', exact: true })
  await expect(edit.getByRole('button', { name: 'Exact amounts', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(edit.getByLabel('Anna', { exact: true })).toHaveValue('€4.00')
  await expect(edit.getByLabel('Olya', { exact: true })).toHaveValue('')
  await expect(edit.getByLabel('Max', { exact: true })).toHaveValue('€6.00')
})

test('deletes an expense', async ({ page }) => {
  const dialog = await openEdit(page, 'Boat trip')
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Delete this expense?')
  await expect(confirm).toContainText('It moves to Deleted and can be restored there.')
  await confirm.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByText('Expense deleted')).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(titles(page)).toHaveText(['Groceries', 'Dinner'])
  await expect(total(page)).toContainText('€150.70')
  const focused = page.locator(':focus')
  await expect(focused).toHaveAccessibleName('Add expense')
  await expect(focused).toBeVisible()

  await expenses(page).getByRole('button', { name: 'Deleted', exact: true }).click()
  await expect(titles(page)).toHaveText(['Taxi', 'Boat trip'])
  await expect(row(page, 'Taxi')).toContainText('€15.00')
  await expect(expenses(page).getByRole('button', { name: /^Edit / })).toHaveCount(0)
  await expenses(page).getByRole('button', { name: 'Active', exact: true }).click()
  await expect(titles(page)).toHaveText(['Groceries', 'Dinner'])
})

test('keeps the active and the deleted expenses apart while switching', async ({ page }) => {
  await openAlbania(page)
  const active = expenses(page).getByRole('button', { name: 'Active', exact: true })
  const deleted = expenses(page).getByRole('button', { name: 'Deleted', exact: true })
  await deleted.click()
  await expect(titles(page)).toHaveText(['Taxi'])
  await active.click()
  await expect(titles(page)).toHaveText(['Boat trip', 'Groceries', 'Dinner'])
  await deleted.click()
  await expect(titles(page)).toHaveText(['Taxi'])

  await addExpenseButton(page).click()
  const dialog = page.getByRole('dialog', { name: 'New expense', exact: true })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await choosePayer(page, dialog, 'Kasia')
  await amountField(dialog).pressSequentially('4')
  await dialog.getByLabel('Description', { exact: true }).fill('Tea')
  await saveButton(dialog).click()
  await expect(page.getByText('Expense added')).toBeVisible()
  await expect(titles(page)).toHaveText(['Taxi'])
  await active.click()
  await expect(titles(page)).toHaveText(['Tea', 'Boat trip', 'Groceries', 'Dinner'])
})

test('shows more expenses on demand', async ({ page }) => {
  await page.goto('/tools/groups')
  await expect(page.getByRole('list', { name: 'Groups', exact: true }).getByRole('link')).toHaveCount(1)
  await page.evaluate(() => {
    const key = 'mita-mock-db-v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    const dinner = state.groupExpenses.find((expense: { id: string }) => expense.id === 'gex_dinner')
    const created = state.groupEvents.find((event: { entryId: string }) => event.entryId === 'gex_dinner')
    const day = new Date(`${dinner.date}T00:00:00Z`)
    day.setUTCDate(day.getUTCDate() - 30)
    const date = day.toISOString().slice(0, 10)
    for (let number = 1; number <= 100; number += 1) {
      const id = `gex_bulk_${number}`
      state.groupExpenses.push({ ...dinner, id, date, description: `Bulk ${number}` })
      state.groupEvents.push({ ...created, id: `gevt_bulk_${number}`, entryId: id })
    }
    localStorage.setItem(key, JSON.stringify(state))
  })
  await page.goto('/tools/groups/grp_albania')
  await expect(rows(page)).toHaveCount(100)
  const more = expenses(page).getByRole('button', { name: 'Show more', exact: true })
  await more.click()
  await expect(rows(page)).toHaveCount(103)
  await expect(more).toHaveCount(0)
})

test('offers the first expense of a new group', async ({ page }) => {
  await page.goto('/tools/groups')
  await page.getByRole('button', { name: 'New group', exact: true }).click()
  const create = page.getByRole('dialog', { name: 'New group', exact: true })
  await create.getByLabel('Name', { exact: true }).fill('Rome')
  await create.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Rome', exact: true })).toBeVisible()

  await expect(expenses(page).getByRole('heading', { name: 'No expenses yet', exact: true })).toBeVisible()
  await expenses(page).getByRole('button', { name: 'Deleted', exact: true }).click()
  await expect(expenses(page).getByRole('heading', { name: 'No deleted expenses', exact: true })).toBeVisible()
  await expenses(page).getByRole('button', { name: 'Active', exact: true }).click()
  await expenses(page).getByRole('button', { name: 'Add expense', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New expense', exact: true })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await choosePayer(page, dialog, 'Anna Nowak')
  await amountField(dialog).pressSequentially('5')
  await saveButton(dialog).click()
  await expect(page.getByText('Expense added')).toBeVisible()
  await expect(titles(page)).toHaveText(['Other'])
})

test('/pl/tools/groups/grp_albania shows the expenses in Polish', async ({ page }) => {
  await page.goto('/pl/tools/groups/grp_albania')
  const region = page.getByRole('region', { name: 'Wydatki', exact: true })
  await expect(region.getByRole('article')).toHaveCount(3)
  const groceries = region.getByRole('article', { name: 'Groceries', exact: true })
  await expect(groceries).toContainText('Płatnik: Olya')
  await expect(groceries).toContainText('Spożywcze')
  await expect(groceries).toContainText('Po równo między wszystkich')
  await page.getByRole('button', { name: 'Dodaj wydatek', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Nowy wydatek', exact: true })).toBeVisible()
})
