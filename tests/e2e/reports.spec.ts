import { expect, type Locator, type Page, test } from '@playwright/test'

const MOCK_DB = 'mita-mock-db-v1'

const monthAt = (offset: number) => {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 15))
}
const longMonth = (date: Date, withYear: boolean) =>
  date.toLocaleString('en-US', {
    month: 'long',
    ...(withYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  })
const coveredLabel = (count: number) => {
  const from = monthAt(1 - count)
  const to = monthAt(0)
  return `${longMonth(from, from.getUTCFullYear() !== to.getUTCFullYear())} – ${longMonth(to, true)}`
}
const monthName = longMonth(monthAt(0), false)
const daysAgoIso = (days: number) => {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - days)).toISOString().slice(0, 10)
}
const pressed = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

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
  await page.goto('/reports')
  await expect(page.getByRole('region', { name: 'Key figures' }).getByTestId('report-average-expense')).toContainText(
    /PLN\s[\d,]+\.\d{2}/,
  )
  await page.getByRole('button', { name: 'New transaction' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await expect(dialog.getByRole('combobox', { name: 'Account' })).toContainText('Konto główne')
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
  await page.goto('/reports')
}

test('the desktop report shows the averages, the savings rate and the spending structure', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'desktop layout')
  await page.goto('/reports')
  await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible()
  await expect(page.getByText('Analytics', { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(pressed(page, '6 months')).toHaveAttribute('aria-pressed', 'true')

  const stats = page.getByRole('region', { name: 'Key figures' })
  const income = stats.getByTestId('report-average-income')
  await expect(income).toContainText('Average income')
  await expect(income).toContainText(/PLN\s[\d,]+\.\d{2}/)
  await expect(stats.getByTestId('report-average-expense')).toContainText(/PLN\s[\d,]+\.\d{2}/)
  await expect(stats.getByTestId('report-savings-rate')).toContainText(/Savings rate\s*(-?\d+%|—)/)

  const structure = page.getByRole('region', { name: `Spending structure · ${monthName}` })
  await expect(structure).toContainText(/PLN\s[\d,]+\.\d{2}/)
  await expect(structure.getByRole('listitem').first()).toContainText(/\d+\.\d%/)
})

test('the range is kept in the URL and an unknown one falls back to six months', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mobile layout')
  await page.goto('/reports')
  await pressed(page, '3 months').click()
  await expect(page).toHaveURL(/\/reports\?range=3m$/)
  await expect(pressed(page, '3 months')).toHaveAttribute('aria-pressed', 'true')
  await pressed(page, 'Year').click()
  await expect(page).toHaveURL(/\/reports\?range=12m$/)
  await page.reload()
  await expect(pressed(page, 'Year')).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/reports?range=decade')
  await expect(pressed(page, '6 months')).toHaveAttribute('aria-pressed', 'true')
})

test('reports are localized', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout')
  await page.goto('/pl/reports')
  await expect(page.getByRole('heading', { level: 1, name: 'Raporty' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Wskaźniki' })).toContainText('Średni przychód')
  await expect(pressed(page, '6 miesięcy')).toHaveAttribute('aria-pressed', 'true')
})

test('a brand-new user is pointed to transactions', async ({ page, isMobile }) => {
  await startAsNewUser(page, isMobile)
  await expect(page.getByRole('heading', { name: 'No reports yet' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add a transaction' })).toHaveAttribute('href', '/transactions')
  await expect(page.getByRole('region', { name: 'Key figures' })).toHaveCount(0)
})

test('a range without data offers the whole year', async ({ page, isMobile }) => {
  await persistMockDb(page, isMobile)
  await page.evaluate(
    ({ key, cutoff }) => {
      type Row = { userId: string; date: string; categoryId: string }
      const state = JSON.parse(localStorage.getItem(key) ?? '{}')
      const own = (row: Row) => row.userId === state.activeUserId
      const old = state.transactions.find(
        (row: Row) => own(row) && row.date < cutoff && !row.categoryId.endsWith('_transfer'),
      )
      state.transactions = [...state.transactions.filter((row: Row) => !own(row)), ...(old ? [old] : [])]
      localStorage.setItem(key, JSON.stringify(state))
    },
    { key: MOCK_DB, cutoff: daysAgoIso(120) },
  )
  await page.goto('/reports?range=3m')
  await expect(page.getByRole('heading', { name: 'No data for this range' })).toBeVisible()
  await expect(page.getByText(`Nothing was recorded in ${coveredLabel(3)}.`)).toBeVisible()
  await page.getByRole('button', { name: 'Show the year' }).click()
  await expect(page).toHaveURL(/\/reports\?range=12m$/)
  await expect(page.getByRole('heading', { name: 'No data for this range' })).toHaveCount(0)
})

test('a failed report shows one error and recovers on retry', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mobile layout')
  await failEveryRequest(page, isMobile)
  await page.goto('/reports')
  await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Something went wrong')
  await expect(alert).toHaveCount(1)

  await recover(page)
  await alert.getByRole('button', { name: 'Try again' }).click()
  await expect(alert).toHaveCount(0)
  await expect(page.getByTestId('report-savings-rate').filter({ visible: true })).toBeVisible()
})

const table = (page: Page) => page.getByRole('table', { name: 'Income and expenses by month' })

const tokenPixel = (page: Page, token: string) =>
  page.evaluate((name) => {
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return []
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    context.fillRect(0, 0, 1, 1)
    return Array.from(context.getImageData(0, 0, 1, 1).data)
  }, `--mita-${token}`)

const colorPixels = (canvas: Locator, rgba: number[]) =>
  canvas.evaluate((element: HTMLCanvasElement, target) => {
    const context = element.getContext('2d')
    if (!context || element.width === 0 || element.height === 0) return 0
    const { data } = context.getImageData(0, 0, element.width, element.height)
    let count = 0
    for (let index = 0; index < data.length; index += 4) {
      if (
        data[index] === target[0] &&
        data[index + 1] === target[1] &&
        data[index + 2] === target[2] &&
        data[index + 3] === 255
      ) {
        count += 1
      }
    }
    return count
  }, rgba)

test('the chart lists every period of the selected range', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mobile layout')
  await page.goto('/reports')
  await expect(table(page).getByRole('row')).toHaveCount(7)
  await expect(table(page).getByRole('row').last()).toContainText(longMonth(monthAt(0), true))
  await expect(
    page.getByRole('img', { name: new RegExp(`^Income and expenses, ${coveredLabel(6)}: total income PLN`) }),
  ).toBeVisible()
  await pressed(page, '3 months').click()
  await expect(table(page).getByRole('row')).toHaveCount(4)
  await pressed(page, 'Year').click()
  await expect(table(page).getByRole('row')).toHaveCount(13)
  await expect(table(page).getByRole('row').nth(1)).toContainText(longMonth(monthAt(-11), true))
})

test('the chart follows the theme', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop chart')
  await page.goto('/reports?range=12m')
  const chart = page.getByRole('img', { name: /^Income and expenses, / })
  await expect(chart).toBeVisible()
  const lightIncome = await tokenPixel(page, 'chart-income')
  const lightExpense = await tokenPixel(page, 'chart-expense')
  await expect.poll(() => colorPixels(chart, lightIncome)).toBeGreaterThan(0)
  await expect.poll(() => colorPixels(chart, lightExpense)).toBeGreaterThan(0)

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  const darkIncome = await tokenPixel(page, 'chart-income')
  const darkExpense = await tokenPixel(page, 'chart-expense')
  expect(darkIncome).not.toEqual(lightIncome)
  expect(darkExpense).not.toEqual(lightExpense)
  await expect.poll(() => colorPixels(chart, darkIncome)).toBeGreaterThan(0)
  await expect.poll(() => colorPixels(chart, darkExpense)).toBeGreaterThan(0)
  await expect.poll(() => colorPixels(chart, lightIncome)).toBe(0)
})
