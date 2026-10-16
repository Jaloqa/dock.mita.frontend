import { expect, type Page, test } from '@playwright/test'

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
  await expect(summary).toContainText('PLN 7,000.00')
  await expect(summary).toContainText(/\d+ days?/)
  await expect(summary.getByRole('progressbar', { name: 'Share of the plan spent' })).toBeVisible()
  await expect(cards(page)).toHaveCount(8)
  const housing = card(page, 'Mieszkanie')
  await expect(housing).toContainText('of PLN 2,160.00')
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
