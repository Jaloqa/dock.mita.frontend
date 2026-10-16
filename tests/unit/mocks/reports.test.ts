import { describe, expect, it } from 'bun:test'
import type { ReportDto } from '../../../app/shared/api/contract'
import { convertMinor } from '../../../app/shared/money/money'
import { addDaysIso, periodFor, shiftPeriod, todayIso } from '../../../app/shared/period/period'
import { createMockApi, type MockApi } from '../../../mocks/api'
import { defaultHandlers } from '../../../mocks/handlers'
import { lastPeriods } from '../../../mocks/overview'
import { rateOn } from '../../../mocks/rates'
import { savingsRateOf } from '../../../mocks/reports'

const today = todayIso()
const current = periodFor(today, 1)
const back = (months: number) => shiftPeriod(current.key, -months, 1)
const expenseCategory = (key: string) => `cat_anna_expense_${key}`
const salary = 'cat_anna_income_salary'

const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)

const api = (): MockApi => {
  const mock = createMockApi({ register: defaultHandlers })
  Object.assign(mock.db.state, { transactions: [], transfers: [], budgets: [], goals: [], goalContributions: [] })
  return mock
}

const report = (mock: MockApi, range?: string) =>
  mock.handle({
    method: 'GET',
    path: '/v1/reports',
    query: range === undefined ? undefined : { range },
  }) as Promise<ReportDto>

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

describe('report rules', () => {
  it('lists the financial periods ending with the current one, oldest first', () => {
    expect(lastPeriods('2026-10-16', 1, 3)).toEqual([
      { key: '2026-08', from: '2026-08-01', to: '2026-08-31' },
      { key: '2026-09', from: '2026-09-01', to: '2026-09-30' },
      { key: '2026-10', from: '2026-10-01', to: '2026-10-31' },
    ])
    expect(lastPeriods('2026-10-16', 10, 3)).toEqual([
      { key: '2026-08', from: '2026-08-10', to: '2026-09-09' },
      { key: '2026-09', from: '2026-09-10', to: '2026-10-09' },
      { key: '2026-10', from: '2026-10-10', to: '2026-11-09' },
    ])
    expect(lastPeriods('2026-10-05', 10, 3).map((row) => row.key)).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(lastPeriods('2026-02-10', 1, 12).map((row) => row.key)).toEqual([
      '2025-03',
      '2025-04',
      '2025-05',
      '2025-06',
      '2025-07',
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
  })

  it('computes the savings rate with one decimal, rounded half away from zero', () => {
    expect(savingsRateOf(300_000, 200_000)).toBe(33.3)
    expect(savingsRateOf(1_000, 0)).toBe(100)
    expect(savingsRateOf(100_000, 150_000)).toBe(-50)
    expect(savingsRateOf(2_000, 1_999)).toBe(0.1)
    expect(savingsRateOf(2_000, 2_001)).toBe(-0.1)
    expect(savingsRateOf(2_000, 2_000)).toBe(0)
    expect(savingsRateOf(100_000, 100_004)).toBe(0)
    expect(savingsRateOf(0, 5_000)).toBeNull()
    expect(savingsRateOf(0, 0)).toBeNull()
  })
})

describe('report', () => {
  it('sums income and expenses per financial period over six months by default', async () => {
    const mock = api()
    await record(mock, 'income', salary, 700_000, current.from)
    await record(mock, 'expense', expenseCategory('housing'), 80_000, today)
    await record(mock, 'income', salary, 500_000, back(5).from)
    await record(mock, 'expense', expenseCategory('groceries'), 40_000, back(5).to)
    await record(mock, 'expense', expenseCategory('groceries'), 10_001, back(2).from)
    await record(mock, 'expense', expenseCategory('groceries'), 99_999, back(6).to)
    const result = await report(mock)
    expect(result).toMatchObject({ range: '6m', from: back(5).from, to: current.to, currency: 'PLN' })
    expect(result.periods.map((row) => row.period)).toEqual([5, 4, 3, 2, 1, 0].map((months) => back(months).key))
    expect(result.periods[0]).toEqual({
      period: back(5).key,
      from: back(5).from,
      to: back(5).to,
      income: 500_000,
      expense: 40_000,
    })
    expect(result.periods[3]).toMatchObject({ period: back(2).key, income: 0, expense: 10_001 })
    expect(result.periods[5]).toMatchObject({ period: current.key, income: 700_000, expense: 80_000 })
    expect(result).toMatchObject({
      totals: { income: 1_200_000, expense: 130_001 },
      averageIncome: 200_000,
      averageExpense: 21_667,
      savingsRate: 89.2,
      hasTransactions: true,
    })
  })

  it('covers three and twelve financial periods', async () => {
    const mock = api()
    await record(mock, 'expense', expenseCategory('groceries'), 1_000, back(2).from)
    await record(mock, 'expense', expenseCategory('groceries'), 2_000, back(3).to)
    await record(mock, 'expense', expenseCategory('groceries'), 4_000, back(11).from)
    await record(mock, 'expense', expenseCategory('groceries'), 8_000, back(12).to)
    const quarter = await report(mock, '3m')
    expect(quarter).toMatchObject({
      range: '3m',
      from: back(2).from,
      to: current.to,
      totals: { income: 0, expense: 1_000 },
      averageIncome: 0,
      averageExpense: 333,
      savingsRate: null,
    })
    expect(quarter.periods).toHaveLength(3)
    const year = await report(mock, '12m')
    expect(year).toMatchObject({ range: '12m', from: back(11).from, totals: { expense: 7_000 }, averageExpense: 583 })
    expect(year.periods).toHaveLength(12)
  })

  it('follows the financial month of the session user and never mixes users', async () => {
    const mock = api()
    await record(mock, 'expense', expenseCategory('groceries'), 5_000)
    mock.db.state.activeUserId = 'usr_oleh'
    const period = periodFor(today, 10)
    const olehCard = { accountId: 'acc_oleh_card', currency: 'UAH' }
    await record(mock, 'expense', 'cat_oleh_expense_groceries', 30_000, period.from, olehCard)
    await record(mock, 'expense', 'cat_oleh_expense_groceries', 20_000, addDaysIso(period.from, -1), olehCard)
    const result = await report(mock)
    expect(result.currency).toBe('UAH')
    expect(result.periods.at(-1)).toEqual({
      period: period.key,
      from: period.from,
      to: period.to,
      income: 0,
      expense: 30_000,
    })
    expect(result.periods.at(-2)).toMatchObject({ to: addDaysIso(period.from, -1), expense: 20_000 })
    expect(result.totals).toEqual({ income: 0, expense: 50_000 })
    expect(result.structure).toMatchObject({ period: period.key, total: 30_000 })
  })

  it('re-prices every amount when the base currency changes', async () => {
    const mock = api()
    await record(mock, 'expense', expenseCategory('groceries'), 10_000)
    await record(mock, 'income', salary, 50_000)
    const settings = mock.db.state.settings.find((row) => row.userId === 'usr_anna')
    if (!settings) throw new Error('Anna has no settings')
    settings.baseCurrency = 'EUR'
    const inEur = (amount: number) => convertMinor(amount, rateOn(mock.db.state.rates, today, 'PLN', 'EUR'))
    const result = await report(mock)
    expect(result.currency).toBe('EUR')
    expect(result.periods.at(-1)).toMatchObject({ income: inEur(50_000), expense: inEur(10_000) })
    expect(result.totals).toEqual({ income: inEur(50_000), expense: inEur(10_000) })
    expect(result.structure.items[0]?.amount).toBe(inEur(10_000))
  })

  it('leaves transfers out of every figure', async () => {
    const mock = api()
    await record(mock, 'expense', expenseCategory('groceries'), 10_000)
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
    await mock.handle({
      method: 'POST',
      path: '/v1/transfers',
      body: { date: today, fromAccountId: 'acc_anna_card', toAccountId: 'acc_anna_savings', fromAmount: 50_000 },
    })
    const result = await report(mock)
    expect(result.totals).toEqual({ income: 0, expense: 10_000 })
    expect(result.periods.at(-1)).toMatchObject({ income: 0, expense: 10_000 })
    expect(result.structure.items.map((item) => item.categoryId)).toEqual([expenseCategory('groceries')])
  })

  it('breaks the current period’s spending down by category, largest first', async () => {
    const mock = api()
    const amounts: [string, number][] = [
      ['housing', 210_000],
      ['groceries', 124_000],
      ['other', 50_000],
      ['health', 20_000],
      ['shopping', 20_000],
    ]
    for (const [key, amount] of amounts) await record(mock, 'expense', expenseCategory(key), amount)
    await record(mock, 'expense', expenseCategory('cafes'), 7_000, back(1).from)
    await record(mock, 'income', salary, 500_000)
    const { structure } = await report(mock)
    expect(structure).toEqual({
      period: current.key,
      from: current.from,
      to: current.to,
      total: 424_000,
      items: [
        {
          categoryId: expenseCategory('housing'),
          name: 'Mieszkanie',
          color: 'chart-1',
          amount: 210_000,
          percent: 49.5,
        },
        {
          categoryId: expenseCategory('groceries'),
          name: 'Spożywcze',
          color: 'chart-2',
          amount: 124_000,
          percent: 29.3,
        },
        { categoryId: expenseCategory('other'), name: 'Inne', color: 'chart-6', amount: 50_000, percent: 11.8 },
        { categoryId: expenseCategory('shopping'), name: 'Zakupy', color: 'chart-4', amount: 20_000, percent: 4.7 },
        { categoryId: expenseCategory('health'), name: 'Zdrowie', color: 'chart-3', amount: 20_000, percent: 4.7 },
      ],
    })
    expect(structure.items.reduce((sum, item) => sum + Math.round(item.percent * 10), 0)).toBe(1000)
  })

  it('returns an empty report for a user without transactions', async () => {
    const result = await report(api())
    expect(result).toMatchObject({
      totals: { income: 0, expense: 0 },
      averageIncome: 0,
      averageExpense: 0,
      savingsRate: null,
      structure: { period: current.key, total: 0, items: [] },
      hasTransactions: false,
    })
    expect(result.periods).toHaveLength(6)
    expect(result.periods.every((row) => row.income === 0 && row.expense === 0)).toBe(true)
  })

  it('rejects unknown ranges', async () => {
    const mock = api()
    for (const range of ['1m', '6M', 'year', '6', '']) {
      expect(await failure(report(mock, range))).toMatchObject({
        problem: { status: 400, errors: { range: ['validation.invalidValue'] } },
      })
    }
    expect((await report(mock, '12m')).range).toBe('12m')
  })
})
