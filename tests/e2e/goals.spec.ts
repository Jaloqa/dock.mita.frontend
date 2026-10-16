import { expect, type Page, test } from '@playwright/test'

const monthYear = (offset: number) => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + offset, 15).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}
const card = (page: Page, name: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
const cards = (page: Page) => page.getByRole('region', { name: 'Goals', exact: true }).getByRole('article')

test('shows the savings summary and the goals with progress and hints', async ({ page, isMobile }) => {
  test.skip(isMobile, 'summary cards and hints are the desktop layout')
  await page.goto('/goals')
  await expect(page.getByRole('heading', { level: 1, name: 'Goals' })).toBeVisible()
  const summary = page.getByRole('region', { name: 'Goals summary' })
  await expect(summary).toContainText('PLN 14,300.00')
  await expect(summary).toContainText('PLN 1,400.00')
  await expect(summary.getByText('3', { exact: true })).toBeVisible()
  await expect(cards(page)).toHaveCount(3)
  const vacation = card(page, 'Wakacje')
  await expect(vacation).toContainText('52%')
  await expect(vacation).toContainText(`Deadline: ${monthYear(8)}`)
  await expect(vacation).toContainText('PLN 4,200.00')
  await expect(vacation).toContainText('PLN 8,000.00')
  await expect(vacation).toContainText('Save PLN 475.00 a month to make it on time')
  const progress = vacation.getByRole('progressbar', { name: 'Wakacje: share of the target saved' })
  await expect(progress).toBeVisible()
  expect((await progress.boundingBox())?.height).toBe(10)
  await expect(vacation.getByRole('button', { name: 'Contribute' })).toBeVisible()
  await expect(vacation.getByRole('button', { name: 'Edit Wakacje' })).toBeVisible()
  const fund = card(page, 'Fundusz awaryjny')
  await expect(fund).toContainText('31%')
  await expect(fund).toContainText('No deadline — any amount helps')
  await expect(card(page, 'Nowy laptop')).toContainText(`Deadline: ${monthYear(3)}`)
})

test('summary values fit their cards at the narrowest desktop width', async ({ page, isMobile }) => {
  test.skip(isMobile, 'summary cards are the desktop layout')
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/goals')
  const summaryCards = page.getByRole('region', { name: 'Goals summary' }).locator(':scope > *')
  await expect(summaryCards).toHaveCount(3)
  await expect(summaryCards.first()).toContainText('PLN 14,300.00')
  for (const summaryCard of await summaryCards.all()) {
    const overflow = await summaryCard.evaluate((element) => element.scrollWidth - element.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  }
})

test('shows compact goal cards on mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'compact cards are the mobile layout')
  await page.goto('/goals')
  await expect(page.getByText('Saved PLN 14,300.00', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Goals summary' })).toBeHidden()
  await expect(cards(page)).toHaveCount(3)
  const vacation = card(page, 'Wakacje')
  await expect(vacation.getByText('PLN 4,200.00 / PLN 8,000.00')).toBeVisible()
  await expect(vacation).toContainText('52%')
  const bar = await vacation.getByRole('progressbar').boundingBox()
  expect(bar?.height).toBe(8)
  await expect(vacation.getByRole('button', { name: 'Contribute' })).toBeVisible()
  await expect(vacation.getByRole('button', { name: 'Edit Wakacje' })).toBeVisible()
  await expect(vacation.getByText('Save PLN 475.00 a month to make it on time')).toBeHidden()
})

test('goals are localized', async ({ page }) => {
  await page.goto('/pl/goals')
  await expect(page.getByRole('heading', { level: 1, name: 'Cele' })).toBeVisible()
  await expect(card(page, 'Wakacje')).toContainText(/4\s?200,00\s?zł/)
  await expect(card(page, 'Fundusz awaryjny')).toContainText('Bez terminu')
})
