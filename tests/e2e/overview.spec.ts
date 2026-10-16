import { expect, type Page, test } from '@playwright/test'

const utcDay = (offset: number) => {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offset))
}
const monthEdge = (last: boolean) => {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() + (last ? 1 : 0), last ? 0 : 1))
}
const shortDate = (date: Date, withYear: boolean) =>
  date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  })
const rangeLabel = (from: Date, to: Date) =>
  `${shortDate(from, from.getUTCFullYear() !== to.getUTCFullYear())} – ${shortDate(to, true)}`
const monthName = new Date().toLocaleString('en-US', { month: 'long' })
const pressed = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

const MOCK_DB = 'mita-mock-db-v1'
const desktopSections = [/^Summary$/, /^Budgets/, /^Recent transactions$/, /^Savings goals$/]

const persistMockDb = async (page: Page, isMobile: boolean) => {
  if (isMobile) {
    await page.goto('/transactions/new')
    await expect(page.getByRole('button', { name: /^Account: / })).toBeVisible()
    await page.getByRole('group', { name: 'Keypad' }).getByRole('button', { name: '1', exact: true }).click()
    await page.getByRole('button', { name: 'Kawiarnie' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).not.toHaveURL(/\/transactions\/new$/)
    return
  }
  await page.goto('/')
  await expect(page.getByTestId('overview-balance')).toContainText('4 accounts')
  await page.getByRole('button', { name: 'Add transaction' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await dialog.getByLabel('Amount').pressSequentially('1')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Transaction saved')).toBeVisible()
}

const failEveryRequest = async (page: Page, isMobile: boolean) => {
  await persistMockDb(page, isMobile)
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    state.simulateErrors = true
    localStorage.setItem(key, JSON.stringify(state))
  }, MOCK_DB)
  await page.addInitScript(() => {
    Math.random = () => (Reflect.get(window, 'mitaRecovered') === true ? 0.99 : 0)
  })
}

const recover = (page: Page) => page.evaluate(() => Reflect.set(window, 'mitaRecovered', true))

const startAsNewUser = async (page: Page, isMobile: boolean) => {
  await persistMockDb(page, isMobile)
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    for (const table of ['accounts', 'transactions', 'transfers', 'budgets', 'goals', 'goalContributions']) {
      state[table] = state[table].filter((row: { userId: string }) => row.userId !== state.activeUserId)
    }
    localStorage.setItem(key, JSON.stringify(state))
  }, MOCK_DB)
  await page.goto('/')
}

test('overview shows the financial month at a glance and keeps the range in the URL', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout')
  await page.goto('/')
  const title = page.getByRole('heading', { level: 1 })
  await expect(title).toHaveText(rangeLabel(monthEdge(false), monthEdge(true)))
  await expect(pressed(page, 'Month')).toHaveAttribute('aria-pressed', 'true')

  const summary = page.getByRole('region', { name: 'Summary', exact: true })
  const balance = summary.getByTestId('overview-balance')
  await expect(balance).toContainText('Total balance')
  await expect(balance).toContainText(/PLN\s[\d,]+\.\d{2}/)
  await expect(balance).toContainText('4 accounts')
  await expect(summary.getByTestId('overview-income')).toContainText(/\d+ payments? in/)
  await expect(summary.getByTestId('overview-expense')).toContainText(/\d+ transactions?/)
  const left = summary.getByTestId('overview-budget-left')
  await expect(left).toContainText('Left in budgets')
  await expect(left).toContainText(`Budgets for ${monthName}`)
  await expect(left.getByRole('progressbar', { name: 'Share of the monthly budgets spent' })).toBeVisible()

  const budgets = page.getByRole('region', { name: `Budgets · ${monthName}` })
  await expect(budgets.getByRole('progressbar')).toHaveCount(5)
  await expect(budgets.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/budgets')
  const goals = page.getByRole('region', { name: 'Savings goals' })
  await expect(goals.getByRole('progressbar')).toHaveCount(3)
  await expect(goals).toContainText('Wakacje')
  await expect(goals).toContainText(/Deadline: \w+ \d{4}/)
  await expect(goals.getByRole('link', { name: 'New goal' })).toHaveAttribute('href', '/goals')
  const recent = page.getByRole('region', { name: 'Recent transactions' })
  await expect(recent.getByRole('link', { name: 'All' })).toHaveAttribute('href', '/transactions')

  await pressed(page, 'Week').click()
  await expect(page).toHaveURL(/\?range=week$/)
  await expect(title).toHaveText(rangeLabel(utcDay(-6), utcDay(0)))
  await expect(budgets.getByRole('progressbar')).toHaveCount(5)
  await page.reload()
  await expect(pressed(page, 'Week')).toHaveAttribute('aria-pressed', 'true')
  await pressed(page, 'Year').click()
  await expect(page).toHaveURL(/\?range=year$/)
  await expect(recent.getByRole('listitem')).toHaveCount(6)
  await expect(recent.getByRole('listitem').first()).toContainText('PLN')
})

test('falls back to the month for an unknown range', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout')
  await page.goto('/?range=decade')
  await expect(pressed(page, 'Month')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(rangeLabel(monthEdge(false), monthEdge(true)))
})

test('the header button opens the transaction dialog', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout')
  await page.goto('/')
  await page.getByRole('button', { name: 'Add transaction' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})

test('overview is localized', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout')
  await page.goto('/pl')
  await expect(page.getByRole('region', { name: 'Podsumowanie', exact: true })).toContainText('Saldo łączne')
  await expect(page.getByRole('region', { name: 'Cele oszczędnościowe' })).toContainText('Wakacje')
})

test('each overview section shows its own error and one retry recovers them all', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout')
  await failEveryRequest(page, isMobile)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add transaction' })).toBeEnabled()
  for (const name of desktopSections) {
    await expect(page.getByRole('region', { name }).getByRole('alert')).toContainText('Something went wrong')
  }

  await recover(page)
  await page.getByRole('region', { name: 'Recent transactions' }).getByRole('button', { name: 'Try again' }).click()
  for (const name of desktopSections) {
    await expect(page.getByRole('region', { name }).getByRole('alert')).toHaveCount(0)
  }
  await expect(
    page.getByRole('region', { name: 'Summary', exact: true }).getByTestId('overview-balance'),
  ).toContainText('4 accounts')
  await expect(page.getByRole('region', { name: 'Recent transactions' }).getByRole('listitem').first()).toBeVisible()
})

test('a brand-new user sees what to set up first', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout')
  await startAsNewUser(page, isMobile)
  await expect(page.getByRole('heading', { name: 'Start with an account' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add an account' })).toHaveAttribute('href', '/accounts')
  const summary = page.getByRole('region', { name: 'Summary', exact: true })
  await expect(summary.getByTestId('overview-balance')).toContainText('0 accounts')
  await expect(
    summary.getByTestId('overview-budget-left').getByRole('link', { name: 'Create a budget' }),
  ).toHaveAttribute('href', '/budgets')
  const budgets = page.getByRole('region', { name: /^Budgets/ })
  await expect(budgets).toContainText('No budgets for this month.')
  await expect(budgets.getByRole('link', { name: 'Create a budget' })).toHaveAttribute('href', '/budgets')
  await expect(page.getByRole('region', { name: 'Recent transactions' })).toContainText('No transactions yet.')
  const goals = page.getByRole('region', { name: 'Savings goals' })
  await expect(goals).toContainText('No goals yet.')
  await expect(goals.getByRole('link', { name: 'Create a goal' })).toHaveAttribute('href', '/goals')
})
