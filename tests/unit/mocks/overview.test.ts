import { describe, expect, it } from 'bun:test'
import type { BudgetDto, GoalDto, OverviewDto } from '../../../app/shared/api/contract'
import { convertMinor } from '../../../app/shared/money/money'
import { addDaysIso, periodFor, shiftPeriod, todayIso } from '../../../app/shared/period/period'
import { createMockApi, type MockApi } from '../../../mocks/api'
import { defaultHandlers } from '../../../mocks/handlers'
import { percentChange, rangesOf, shareTenths } from '../../../mocks/overview'
import { rateOn } from '../../../mocks/rates'

const today = todayIso()
const current = periodFor(today, 1)
const previous = shiftPeriod(current.key, -1, 1)
const expenseCategory = (key: string) => `cat_anna_expense_${key}`
const salary = 'cat_anna_income_salary'

const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)

const api = (): MockApi => {
  const mock = createMockApi({ register: defaultHandlers })
  Object.assign(mock.db.state, { transactions: [], transfers: [], budgets: [], goals: [], goalContributions: [] })
  return mock
}

const overview = (mock: MockApi, period?: string) =>
  mock.handle({
    method: 'GET',
    path: '/v1/overview',
    query: period === undefined ? undefined : { period },
  }) as Promise<OverviewDto>

const record = (
  mock: MockApi,
  kind: 'expense' | 'income',
  categoryId: string,
  amount: number,
  date = today,
  extra: Record<string, unknown> = {},
) =>
  mock.handle({
    method: 'POST',
    path: '/v1/transactions',
    body: { kind, date, categoryId, accountId: 'acc_anna_card', amount, currency: 'PLN', ...extra },
  })

const budget = (mock: MockApi, key: string, limit: number) =>
  mock.handle({
    method: 'POST',
    path: '/v1/budgets',
    body: { categoryId: expenseCategory(key), period: current.key, limit },
  }) as Promise<BudgetDto>

const goal = (mock: MockApi, name: string, target: number) =>
  mock.handle({
    method: 'POST',
    path: '/v1/goals',
    body: { name, target, deadline: null, accountId: null },
  }) as Promise<GoalDto>

describe('overview rules', () => {
  it('derives the current and previous ranges from the financial periods', () => {
    expect(rangesOf('week', '2026-10-16', 1)).toEqual({
      current: { from: '2026-10-10', to: '2026-10-16' },
      previous: { from: '2026-10-03', to: '2026-10-09' },
    })
    expect(rangesOf('month', '2026-10-16', 1)).toEqual({
      current: { from: '2026-10-01', to: '2026-10-31' },
      previous: { from: '2026-09-01', to: '2026-09-30' },
    })
    expect(rangesOf('month', '2026-10-16', 10)).toEqual({
      current: { from: '2026-10-10', to: '2026-11-09' },
      previous: { from: '2026-09-10', to: '2026-10-09' },
    })
    expect(rangesOf('year', '2026-10-16', 1)).toEqual({
      current: { from: '2025-11-01', to: '2026-10-31' },
      previous: { from: '2024-11-01', to: '2025-10-31' },
    })
    expect(rangesOf('year', '2026-10-16', 10)).toEqual({
      current: { from: '2025-11-10', to: '2026-11-09' },
      previous: { from: '2024-11-10', to: '2025-11-09' },
    })
  })

  it('rounds shares to tenths that always add up to a whole', () => {
    expect(shareTenths([210_000, 124_000, 42_000, 41_200, 31_000, 45_370])).toEqual([425, 251, 85, 84, 63, 92])
    expect(shareTenths([1, 1, 1])).toEqual([334, 333, 333])
    expect(shareTenths([5])).toEqual([1000])
    expect(shareTenths([0, 0])).toEqual([0, 0])
    expect(shareTenths([])).toEqual([])
  })

  it('compares with the previous range in percent with one decimal', () => {
    expect(percentChange(5_240, 5_000)).toBe(4.8)
    expect(percentChange(4_500, 5_000)).toBe(-10)
    expect(percentChange(5_000, 5_000)).toBe(0)
    expect(percentChange(100, 0)).toBeNull()
    expect(percentChange(0, 0)).toBeNull()
  })
})

describe('overview', () => {
  it('sums income and expenses of the current financial month and compares them with the previous one', async () => {
    const mock = api()
    await record(mock, 'expense', expenseCategory('groceries'), 30_000, current.from)
    await record(mock, 'expense', expenseCategory('housing'), 50_000, today)
    await record(mock, 'income', salary, 700_000, current.from)
    await record(mock, 'expense', expenseCategory('groceries'), 40_000, previous.from)
    await record(mock, 'income', salary, 500_000, previous.from)
    expect(await overview(mock)).toMatchObject({
      range: 'month',
      from: current.from,
      to: current.to,
      previousFrom: previous.from,
      previousTo: previous.to,
      currency: 'PLN',
      income: { amount: 700_000, count: 1, change: 40 },
      expense: { amount: 80_000, count: 2, change: 100 },
      averageExpense: 40_000,
      transactionCount: 3,
      hasTransactions: true,
    })
  })

  it('counts a EUR expense from a PLN card at its converted amount', async () => {
    const mock = api()
    await record(mock, 'expense', expenseCategory('gifts'), 5_000, today, { currency: 'EUR', rate: 4 })
    const result = await overview(mock)
    expect(result.expense).toMatchObject({ amount: 20_000, count: 1 })
    expect(result.spending).toEqual([
      { categoryId: expenseCategory('gifts'), name: 'Prezenty', amount: 20_000, percent: 100 },
    ])
  })

  it('splits spending into the top five categories and one bucket, without transfers', async () => {
    const mock = api()
    const amounts: [string, number][] = [
      ['housing', 210_000],
      ['groceries', 124_000],
      ['leisure', 42_000],
      ['cafes', 41_200],
      ['transport', 31_000],
      ['health', 20_000],
      ['shopping', 15_370],
      ['other', 10_000],
    ]
    for (const [key, amount] of amounts) await record(mock, 'expense', expenseCategory(key), amount)
    const sample = mock.db.state.transactions[0]
    if (!sample) throw new Error('no transaction recorded')
    mock.db.state.transactions.push({
      ...sample,
      id: 'txn_transfer_category',
      categoryId: expenseCategory('transfer'),
      amount: 99_000,
      accountAmount: 99_000,
      baseAmount: 99_000,
    })
    const result = await overview(mock)
    expect(result.spending).toEqual([
      { categoryId: expenseCategory('housing'), name: 'Mieszkanie', amount: 210_000, percent: 42.5 },
      { categoryId: expenseCategory('groceries'), name: 'Spożywcze', amount: 124_000, percent: 25.1 },
      { categoryId: expenseCategory('leisure'), name: 'Rozrywka', amount: 42_000, percent: 8.5 },
      { categoryId: expenseCategory('cafes'), name: 'Kawiarnie', amount: 41_200, percent: 8.4 },
      { categoryId: expenseCategory('transport'), name: 'Transport', amount: 31_000, percent: 6.3 },
      { categoryId: null, name: null, amount: 45_370, percent: 9.2 },
    ])
    expect(result.spending.reduce((sum, slice) => sum + Math.round(slice.percent * 10), 0)).toBe(1000)
    expect(result.expense).toMatchObject({ amount: 493_570, count: 8 })
    expect(result.recent.map((row) => row.id)).not.toContain('txn_transfer_category')
  })

  it('covers the last seven days for the week range', async () => {
    const mock = api()
    await record(mock, 'expense', expenseCategory('groceries'), 1_000, today)
    await record(mock, 'expense', expenseCategory('groceries'), 2_000, addDaysIso(today, -6))
    await record(mock, 'expense', expenseCategory('groceries'), 4_000, addDaysIso(today, -7))
    await record(mock, 'expense', expenseCategory('groceries'), 8_000, addDaysIso(today, -13))
    await record(mock, 'expense', expenseCategory('groceries'), 16_000, addDaysIso(today, -14))
    expect(await overview(mock, 'week')).toMatchObject({
      range: 'week',
      from: addDaysIso(today, -6),
      to: today,
      previousFrom: addDaysIso(today, -13),
      previousTo: addDaysIso(today, -7),
      expense: { amount: 3_000, count: 2, change: -75 },
    })
  })

  it('covers twelve financial periods for the year range', async () => {
    const mock = api()
    const yearStart = shiftPeriod(current.key, -11, 1).from
    await record(mock, 'expense', expenseCategory('groceries'), 1_000, yearStart)
    await record(mock, 'expense', expenseCategory('groceries'), 2_000, addDaysIso(yearStart, -1))
    expect(await overview(mock, 'year')).toMatchObject({
      range: 'year',
      from: yearStart,
      to: current.to,
      previousFrom: shiftPeriod(current.key, -23, 1).from,
      previousTo: addDaysIso(yearStart, -1),
      expense: { amount: 1_000, count: 1, change: -50 },
    })
  })

  it('keeps budget figures on the current financial month whatever the range', async () => {
    const mock = api()
    for (const [key, limit] of [
      ['groceries', 100_000],
      ['cafes', 10_000],
      ['housing', 20_000],
      ['sport', 50_000],
      ['transport', 30_000],
      ['leisure', 40_000],
    ] as const) {
      await budget(mock, key, limit)
    }
    await record(mock, 'expense', expenseCategory('groceries'), 50_000)
    await record(mock, 'expense', expenseCategory('cafes'), 9_000)
    await record(mock, 'expense', expenseCategory('housing'), 25_000)
    const result = await overview(mock, 'week')
    expect(result.month).toEqual({
      period: current.key,
      from: current.from,
      to: current.to,
      planned: 250_000,
      spent: 84_000,
      left: 166_000,
      budgets: 6,
    })
    expect(result.topBudgets.map((row) => [row.name, row.status, row.remaining])).toEqual([
      ['Mieszkanie', 'over_budget', -5_000],
      ['Kawiarnie', 'almost_spent', 1_000],
      ['Spożywcze', 'on_track', 50_000],
      ['Sport', 'on_track', 50_000],
      ['Transport', 'on_track', 30_000],
    ])
    expect(result.topBudgets[0]).toMatchObject({ categoryId: expenseCategory('housing'), limit: 20_000, spent: 25_000 })
  })

  it('totals the balances of every account holding money at today’s rate', async () => {
    const mock = api()
    const own = mock.db.state.accounts.filter((row) => row.userId === 'usr_anna')
    const inPln = (row: (typeof own)[number]) =>
      row.currency === 'PLN'
        ? row.openingBalance
        : convertMinor(row.openingBalance, rateOn(mock.db.state.rates, today, row.currency, 'PLN'))
    const expected = own.reduce((sum, row) => sum + inPln(row), 0)
    expect((await overview(mock)).balance).toEqual({ amount: expected, accounts: 4 })
    await record(mock, 'expense', expenseCategory('groceries'), 12_345)
    expect((await overview(mock)).balance).toEqual({ amount: expected - 12_345, accounts: 4 })
    const cash = own.find((row) => row.id === 'acc_anna_cash')
    if (!cash) throw new Error('no cash account')
    const cashOpening = cash.openingBalance
    cash.archived = true
    expect((await overview(mock)).balance).toEqual({ amount: expected - 12_345, accounts: 4 })
    cash.openingBalance = 0
    expect((await overview(mock)).balance).toEqual({ amount: expected - 12_345 - cashOpening, accounts: 3 })
  })

  it('lists the newest transactions of the range and all of today', async () => {
    const mock = api()
    await record(mock, 'expense', expenseCategory('groceries'), 500, previous.from, { title: 'old' })
    for (let index = 1; index <= 8; index += 1) {
      await record(mock, 'expense', expenseCategory('groceries'), index * 1_000, today, { title: `t${index}` })
    }
    const result = await overview(mock)
    expect(result.recent.map((row) => row.title)).toEqual(['t8', 't7', 't6', 't5', 't4', 't3'])
    expect(result.recent[0]).toEqual({
      id: expect.stringMatching(/^txn_/),
      kind: 'expense',
      date: today,
      title: 't8',
      categoryName: 'Spożywcze',
      accountName: 'Konto główne',
      amount: 8_000,
    })
  })

  it('previews three goals that are not reached yet', async () => {
    const mock = api()
    const first = await goal(mock, 'A', 10_000)
    await goal(mock, 'B', 20_000)
    await goal(mock, 'C', 30_000)
    await goal(mock, 'D', 40_000)
    await mock.handle({
      method: 'POST',
      path: `/v1/goals/${first.id}/contributions`,
      body: { amount: 10_000, date: today },
    })
    const result = await overview(mock)
    expect(result.goals.map((row) => row.name)).toEqual(['B', 'C', 'D'])
    expect(result.goals[0]).toEqual({
      id: expect.stringMatching(/^goal_/),
      name: 'B',
      target: 20_000,
      saved: 0,
      percent: 0,
      status: 'active',
      deadline: null,
    })
    expect(result.goalCount).toBe(4)
  })

  it('returns an empty overview for a user without data', async () => {
    const mock = api()
    mock.db.state.accounts = mock.db.state.accounts.filter((row) => row.userId !== 'usr_anna')
    expect(await overview(mock)).toMatchObject({
      balance: { amount: 0, accounts: 0 },
      income: { amount: 0, count: 0, change: null },
      expense: { amount: 0, count: 0, change: null },
      averageExpense: null,
      transactionCount: 0,
      spending: [],
      month: { planned: 0, spent: 0, left: 0, budgets: 0 },
      topBudgets: [],
      recent: [],
      goals: [],
      goalCount: 0,
      hasTransactions: false,
    })
  })

  it('re-prices totals when the base currency changes', async () => {
    const mock = api()
    await record(mock, 'expense', expenseCategory('groceries'), 10_000)
    const settings = mock.db.state.settings.find((row) => row.userId === 'usr_anna')
    if (!settings) throw new Error('Anna has no settings')
    settings.baseCurrency = 'EUR'
    const result = await overview(mock)
    expect(result.currency).toBe('EUR')
    expect(result.expense.amount).toBe(convertMinor(10_000, rateOn(mock.db.state.rates, today, 'PLN', 'EUR')))
  })

  it('rejects unknown ranges and serves only the session user', async () => {
    const mock = api()
    for (const period of ['day', '2026-10', 'Week', '']) {
      expect(await failure(overview(mock, period))).toMatchObject({
        problem: { status: 400, errors: { period: ['validation.invalidValue'] } },
      })
    }
    await record(mock, 'expense', expenseCategory('groceries'), 1_000)
    mock.db.state.activeUserId = 'usr_oleh'
    expect(await overview(mock)).toMatchObject({
      currency: 'UAH',
      expense: { amount: 0, count: 0 },
      hasTransactions: false,
      month: { period: periodFor(today, 10).key },
      balance: { accounts: 3 },
    })
  })
})
