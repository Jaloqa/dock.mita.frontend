import { expect, type Locator, type Page, test } from '@playwright/test'

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
const desktopSections = [/^Summary$/, /^Spending by category$/, /^Budgets/, /^Recent transactions$/, /^Savings goals$/]

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
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
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
  await expect(balance).toContainText(/zł\s[\d,]+\.\d{2}/)
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
  await expect(recent.getByRole('listitem').first()).toContainText('zł')
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
  const spending = page.getByRole('region', { name: 'Spending by category' })
  await expect(spending).toContainText('No transactions yet')
  await expect(spending.locator('dl')).toHaveCount(0)
  await spending.getByRole('button', { name: 'Add your first transaction' }).click()
  await expect(page.getByRole('dialog', { name: 'New transaction' })).toBeVisible()
})

const ringPixel = (canvas: Locator) =>
  canvas.evaluate((element: HTMLCanvasElement) => {
    const scale = element.width / element.clientWidth
    const radius = (element.clientWidth / 2) * 0.85
    const angle = (20 * Math.PI) / 180
    const x = Math.round((element.clientWidth / 2 + radius * Math.sin(angle)) * scale)
    const y = Math.round((element.clientHeight / 2 - radius * Math.cos(angle)) * scale)
    return Array.from(element.getContext('2d')?.getImageData(x, y, 1, 1).data ?? [])
  })

const tokenPixel = (page: Page, token: string) =>
  page.evaluate((name) => {
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return []
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    context.fillRect(0, 0, 1, 1)
    return Array.from(context.getImageData(0, 0, 1, 1).data)
  }, `--mita-${token}`)

test('spending donut shows the top categories, their shares and an accessible description', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'desktop layout')
  await page.goto('/?range=year')
  const spending = page.getByRole('region', { name: 'Spending by category' })
  const donut = spending.getByRole('img', { name: /^Spending by category: .+ \d+\.\d%/ })
  await expect(donut).toBeVisible()
  const table = spending.getByRole('table', { name: 'Spending by category' })
  await expect(table.getByRole('row')).toHaveCount(7)
  await expect(table.getByRole('row').last()).toContainText('Other')
  const shares = await table.locator('tbody td:last-child').allTextContents()
  expect(shares.reduce((sum, text) => sum + Number(text.replace('%', '')), 0)).toBeCloseTo(100, 5)
  const footer = spending.locator('dl')
  await expect(footer).toContainText('vs previous 12 months')
  await expect(footer).toContainText('—')
  await expect(footer).toContainText('Average expense')
  await expect(spending.getByRole('link', { name: 'Details' })).toHaveAttribute('href', '/reports')

  const lightFirst = await tokenPixel(page, 'chart-1')
  await expect.poll(() => ringPixel(donut)).toEqual(lightFirst)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  const darkFirst = await tokenPixel(page, 'chart-1')
  expect(darkFirst).not.toEqual(lightFirst)
  await expect.poll(() => ringPixel(donut)).toEqual(darkFirst)
  await pressed(page, 'Month').click()
  await expect(spending).toContainText(
    `vs ${new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15).toLocaleString('en-US', { month: 'long' })}`,
  )
})

test('quick add validates, records an expense, resets and refreshes the overview', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout')
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Quick add' })
  await expect(panel.getByRole('button', { name: 'Expense', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await panel.getByRole('button', { name: 'Save' }).click()
  await expect(panel.getByText('This field is required.')).toBeVisible()
  await expect(panel.getByLabel('Amount')).toBeFocused()

  await panel.getByRole('button', { name: 'Income', exact: true }).click()
  await expect(panel.getByRole('combobox', { name: 'Category' })).toContainText('Wynagrodzenie')
  await panel.getByRole('button', { name: 'Expense', exact: true }).click()

  await panel.getByLabel('Amount').pressSequentially('42.5')
  await panel.getByRole('combobox', { name: 'Category' }).click()
  await page.getByRole('listbox').getByRole('option', { name: 'Kawiarnie' }).click()
  await expect(panel.getByRole('combobox', { name: 'Account' })).toContainText('Konto główne')
  await panel.getByLabel('Note').fill('Flat white')
  await panel.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Transaction saved')).toBeVisible()
  await expect(panel.getByLabel('Amount')).toHaveValue('')
  await expect(panel.getByLabel('Note')).toHaveValue('')
  await expect(panel.getByText('This field is required.')).toHaveCount(0)

  const latest = page.getByRole('region', { name: 'Recent transactions' }).getByRole('listitem').first()
  await expect(latest).toContainText('Kawiarnie')
  await expect(latest).toContainText('-zł 42.50')
  await expect(latest).toContainText('Kawiarnie · today')
})

test('quick add has its own error and retry, independent of the overview sections', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout')
  await failEveryRequest(page, isMobile)
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Quick add' })
  await expect(panel.getByRole('alert')).toContainText('Something went wrong')
  await recover(page)
  await panel.getByRole('button', { name: 'Try again' }).click()
  await expect(panel.getByLabel('Amount')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Recent transactions' }).getByRole('alert')).toBeVisible()
})

test('mobile overview shows the month left, the daily allowance, budgets and today', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout')
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(monthName)
  await expect(page.getByText('Budget for', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Budgets by period' })).toHaveAttribute('href', '/budgets')

  const balance = page.getByRole('region', { name: 'Left this month' })
  await expect(balance).toContainText(/-?zł\s[\d,]+\.\d{2}/)
  await expect(balance.getByRole('progressbar', { name: 'Share of the monthly budgets spent' })).toBeVisible()
  await expect(balance).toContainText('Income')
  await expect(balance).toContainText('Expenses')
  await expect(page.getByTestId('overview-per-day')).toContainText('You can spend per day')

  const budgets = page.getByRole('region', { name: 'Budgets', exact: true })
  await expect(budgets.getByRole('progressbar')).toHaveCount(3)
  await expect(budgets).toContainText(/left|Overspent by/)
  await expect(budgets.getByRole('link', { name: 'All' })).toHaveAttribute('href', '/budgets')

  const today = page.getByRole('region', { name: 'Today', exact: true })
  await expect(today).toBeVisible()
  await page.getByRole('link', { name: 'New transaction' }).click()
  await expect(page).toHaveURL('/transactions/new')
  const keypad = page.getByRole('group', { name: 'Keypad' })
  for (const key of ['4', '2', 'Decimal separator', '5']) {
    await keypad.getByRole('button', { name: key, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Kawiarnie' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page).toHaveURL('/')
  const added = today.getByRole('listitem').filter({ hasText: '-zł 42.50' }).first()
  await expect(added).toContainText('Kawiarnie · Konto główne')
})

test('mobile sections show their own error and one retry recovers them all', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout')
  const mobileSections = ['Left this month', 'Budgets', 'Today']
  await failEveryRequest(page, isMobile)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Budgets by period' })).toBeVisible()
  for (const name of mobileSections) {
    await expect(page.getByRole('region', { name, exact: true }).getByRole('alert')).toContainText(
      'Something went wrong',
    )
  }

  await recover(page)
  await page.getByRole('region', { name: 'Today', exact: true }).getByRole('button', { name: 'Try again' }).click()
  for (const name of mobileSections) {
    await expect(page.getByRole('region', { name, exact: true }).getByRole('alert')).toHaveCount(0)
  }
  await expect(page.getByTestId('overview-per-day')).toContainText('You can spend per day')
  await expect(page.getByRole('region', { name: 'Budgets', exact: true }).getByRole('progressbar')).toHaveCount(3)
})

test('a brand-new user on mobile sees the balance and what to add', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout')
  await startAsNewUser(page, isMobile)
  await expect(page.getByRole('link', { name: 'Add an account' })).toHaveAttribute('href', '/accounts')
  await expect(page.getByRole('region', { name: 'Total balance', exact: true })).toContainText('zł 0.00')
  await expect(page.getByTestId('overview-per-day')).toHaveCount(0)
  const budgets = page.getByRole('region', { name: 'Budgets', exact: true })
  await expect(budgets).toContainText('No budgets for this month.')
  await expect(budgets.getByRole('link', { name: 'Create a budget' })).toHaveAttribute('href', '/budgets')
  const today = page.getByRole('region', { name: 'Today', exact: true })
  await expect(today).toContainText('No transactions today.')
  await expect(today.getByRole('link', { name: 'Add a transaction' })).toHaveAttribute('href', '/transactions/new')
})

const amountOf = (text: string | null) => Number((text ?? '').replace(/[^\d.-]/g, ''))
const moneyOf = async (locator: Locator) => amountOf(await locator.locator('.font-mono').first().textContent())
const card = (page: Page, name: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) })

test('a EUR expense from a PLN card updates the account, the overview and the budget', async ({ page, isMobile }) => {
  test.skip(isMobile, 'currency and rate are picked in the desktop dialog')
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true })
  const open = async (name: string, path: string) => {
    await nav.getByRole('link', { name, exact: true }).click()
    await expect(page).toHaveURL(path)
  }
  await open('Budgets', '/budgets')
  const gifts = card(page, 'Prezenty')
  await expect(gifts).toContainText('of zł 500.00')
  const giftsBefore = await moneyOf(gifts)
  await open('Accounts', '/accounts')
  await expect(card(page, 'Konto główne')).toContainText('zł 8,820.40')

  await open('Overview', '/')
  const summary = page.getByRole('region', { name: 'Summary', exact: true })
  const balance = summary.getByTestId('overview-balance')
  const expense = summary.getByTestId('overview-expense')
  const left = summary.getByTestId('overview-budget-left')
  await expect(balance).toContainText(/zł\s[\d,]+\.\d{2}/)
  const balanceBefore = await moneyOf(balance)
  const expenseBefore = await moneyOf(expense)
  const leftBefore = await moneyOf(left)
  const countBefore = Number((await expense.innerText()).match(/(\d+) transactions?/)?.[1])

  await page.getByRole('button', { name: 'Add transaction' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await expect(dialog.getByRole('combobox', { name: 'Account' })).toContainText('Konto główne · PLN')
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await dialog.getByLabel('Amount').pressSequentially('50')
  await dialog.getByRole('combobox', { name: 'Currency' }).click()
  await page.getByRole('option', { name: 'EUR', exact: true }).click()
  const rate = dialog.getByLabel('Exchange rate (EUR → PLN)')
  await expect(rate).toHaveValue(/^4\.\d+$/)
  await rate.fill('')
  await rate.pressSequentially('4')
  await expect(dialog.getByText('On the account: zł 200.00')).toBeVisible()
  await dialog.getByRole('combobox', { name: 'Category' }).click()
  await page.getByRole('option', { name: 'Prezenty', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Transaction saved')).toBeVisible()

  await expect.poll(() => moneyOf(balance)).toBeCloseTo(balanceBefore - 200, 2)
  await expect.poll(() => moneyOf(expense)).toBeCloseTo(expenseBefore + 200, 2)
  await expect.poll(() => moneyOf(left)).toBeCloseTo(leftBefore - 200, 2)
  await expect(expense).toContainText(`${countBefore + 1} transactions`)

  await open('Accounts', '/accounts')
  await expect(card(page, 'Konto główne')).toContainText('zł 8,620.40')
  await open('Budgets', '/budgets')
  await expect(gifts).toContainText('of zł 500.00')
  await expect.poll(() => moneyOf(gifts)).toBeCloseTo(giftsBefore + 200, 2)
})
