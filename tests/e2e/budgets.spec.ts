import { expect, type Locator, type Page, test } from '@playwright/test'

const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const shift = (months: number) => {
  const now = new Date()
  return keyOf(new Date(now.getFullYear(), now.getMonth() + months, 1))
}
const monthName = (key: string, locale = 'en') =>
  new Date(`${key}-15T00:00:00Z`).toLocaleString(locale, { month: 'long', timeZone: 'UTC' })
const monthButton = (page: Page, key: string) => page.getByRole('button', { name: monthName(key), exact: true })
const card = (page: Page, name: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
const cards = (page: Page) => page.getByRole('region', { name: 'Budget categories' }).getByRole('article')

test('shows the planned budgets of the current period', async ({ page }) => {
  await page.goto('/budgets')
  await expect(page.getByRole('heading', { level: 1, name: 'Budgets' })).toBeVisible()
  const summary = page.getByRole('region', { name: 'Period summary' })
  await expect(summary).toContainText('zł 7,000.00')
  await expect(summary).toContainText(/\d+ days?/)
  await expect(summary.getByRole('progressbar', { name: 'Share of the plan spent' })).toBeVisible()
  await expect(cards(page)).toHaveCount(8)
  const housing = card(page, 'Mieszkanie')
  await expect(housing).toContainText('of zł 2,160.00')
  await expect(housing).toContainText(/On track|Almost spent|Over budget/)
  await expect(housing.getByRole('progressbar', { name: 'Mieszkanie: share of the limit spent' })).toBeVisible()
  await expect(monthButton(page, shift(0))).toHaveAttribute('aria-pressed', 'true')
})

test('switches periods and keeps the choice in the URL', async ({ page }) => {
  await page.goto('/budgets')
  await expect(cards(page)).toHaveCount(8)
  await monthButton(page, shift(-1)).click()
  await expect(page).toHaveURL(new RegExp(`period=${shift(-1)}`))
  await expect(monthButton(page, shift(-1))).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Period summary' })).toContainText('0 days')
  await page.reload()
  await expect(monthButton(page, shift(-1))).toHaveAttribute('aria-pressed', 'true')
  await expect(cards(page)).toHaveCount(8)
})

test('falls back to the current period for an invalid period in the URL', async ({ page }) => {
  await page.goto('/budgets?period=2026-13')
  await expect(monthButton(page, shift(0))).toHaveAttribute('aria-pressed', 'true')
  await expect(cards(page)).toHaveCount(8)
})

test('shows an empty state for a period without budgets', async ({ page }) => {
  await page.goto(`/budgets?period=${shift(2)}`)
  await expect(page.getByRole('heading', { name: 'No budgets for this period' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Period summary' })).toHaveCount(0)
})

test('budgets are localized', async ({ page }) => {
  await page.goto('/pl/budgets')
  await expect(page.getByRole('heading', { level: 1, name: 'Budżety' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Podsumowanie okresu' })).toContainText(/7\s?000,00\s?zł/)
  await expect(page.getByRole('region', { name: 'Kategorie budżetu' }).getByRole('article')).toHaveCount(8)
})

const openNewBudget = async (page: Page, trigger: string) => {
  await page.getByRole('button', { name: trigger, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New budget' })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  return dialog
}

const chooseCategory = async (page: Page, dialog: Locator, name: string) => {
  const combobox = dialog.getByRole('combobox', { name: 'Category' })
  await combobox.click()
  await page.getByRole('option', { name, exact: true }).click()
  await expect(combobox).toHaveAttribute('aria-expanded', 'false')
}

const addBudget = async (page: Page, category: string, limit: string) => {
  const dialog = await openNewBudget(page, 'Add category')
  await chooseCategory(page, dialog, category)
  await dialog.getByLabel('Monthly limit').pressSequentially(limit)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
}

test('creates, edits and deletes a budget', async ({ page }) => {
  await page.goto(`/budgets?period=${shift(2)}`)
  await expect(page.getByRole('heading', { name: 'No budgets for this period' })).toBeVisible()
  const dialog = await openNewBudget(page, 'New budget')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('This field is required.')).toHaveCount(2)
  await chooseCategory(page, dialog, 'Sport')
  await dialog.getByLabel('Monthly limit').pressSequentially('250')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Budget created')).toBeVisible()
  const sport = card(page, 'Sport')
  await expect(sport).toContainText('of zł 250.00')
  await expect(sport).toContainText('On track')
  await expect(sport).toContainText('zł 250.00 left')

  await sport.getByRole('button', { name: 'Edit budget Sport' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit budget' })
  await expect(edit.getByLabel('Category')).toHaveValue('Sport')
  await expect(edit.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  const limit = edit.getByLabel('Monthly limit')
  await limit.fill('')
  await limit.pressSequentially('300')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Budget updated')).toBeVisible()
  await expect(sport).toContainText('of zł 300.00')

  await sport.getByRole('button', { name: 'Edit budget Sport' }).click()
  await edit.getByRole('button', { name: 'Delete' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Sport')
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Budget deleted')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No budgets for this period' })).toBeVisible()
})

test('copies budgets from the previous period into an empty one', async ({ page }) => {
  await page.goto(`/budgets?period=${shift(1)}`)
  await page.getByRole('button', { name: `Copy budgets from ${monthName(shift(0))}` }).click()
  await expect(page.getByText('8 budgets copied')).toBeVisible()
  await expect(cards(page)).toHaveCount(8)
  await expect(card(page, 'Mieszkanie')).toContainText('of zł 2,160.00')
})

test('does not offer copying when the previous period is empty', async ({ page }) => {
  await page.goto(`/budgets?period=${shift(2)}`)
  await expect(page.getByRole('button', { name: 'Create a budget' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Copy budgets from/ })).toHaveCount(0)
})

test('the add tile offers only expense categories without a budget', async ({ page }) => {
  await page.goto('/budgets')
  const dialog = await openNewBudget(page, 'Add category')
  await dialog.getByRole('combobox', { name: 'Category' }).click()
  await expect(page.getByRole('option')).toHaveCount(2)
  await expect(page.getByRole('option', { name: 'Sport', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Inne', exact: true })).toBeVisible()
})

test('offers the category manager when every expense category has a budget', async ({ page }) => {
  await page.goto('/budgets')
  await addBudget(page, 'Sport', '100')
  await addBudget(page, 'Inne', '100')
  await expect(cards(page)).toHaveCount(10)
  const dialog = await openNewBudget(page, 'Add category')
  await expect(dialog).toContainText('Every expense category already has a budget')
  await dialog.getByRole('button', { name: 'Manage categories' }).click()
  await expect(page.getByRole('dialog', { name: 'Categories' })).toBeVisible()
})

test('a new expense updates the budget of its category', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the sidebar button exists on desktop only')
  await page.goto('/budgets')
  const gifts = card(page, 'Prezenty')
  await expect(gifts).toContainText('of zł 500.00')
  await page.getByRole('button', { name: 'New transaction' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await dialog.getByLabel('Amount').pressSequentially('600')
  await dialog.getByRole('combobox', { name: 'Category' }).click()
  await page.getByRole('option', { name: 'Prezenty', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Transaction saved')).toBeVisible()
  await expect(gifts).toContainText('Over budget')
  await expect(gifts).toContainText(/Overspent by zł\s\d/)
})
