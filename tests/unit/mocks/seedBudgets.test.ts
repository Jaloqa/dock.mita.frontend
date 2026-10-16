import { describe, expect, it } from 'bun:test'
import type { BudgetPage } from '../../../app/shared/api/contract'
import { periodFor, shiftPeriod } from '../../../app/shared/period/period'
import { createMockApi } from '../../../mocks/api'
import { defaultHandlers } from '../../../mocks/handlers'
import { seedState } from '../../../mocks/seed'

const seedDays = ['2026-10-16', '2026-03-01', '2026-12-31', '2027-01-05']

const annaLimits = [
  ['cat_anna_expense_housing', 216_000],
  ['cat_anna_expense_groceries', 180_000],
  ['cat_anna_expense_leisure', 60_000],
  ['cat_anna_expense_transport', 50_000],
  ['cat_anna_expense_health', 30_000],
  ['cat_anna_expense_cafes', 34_000],
  ['cat_anna_expense_shopping', 80_000],
  ['cat_anna_expense_gifts', 50_000],
]

const periodsAround = (today: string, start: number) => {
  const current = periodFor(today, start).key
  return [-3, -2, -1, 0].map((offset) => shiftPeriod(current, offset, start).key)
}

describe('seeded budgets', () => {
  it.each(seedDays)('gives Anna the designed limits for the current and three previous periods on %s', (today) => {
    const state = seedState(today)
    const anna = state.budgets.filter((row) => row.userId === 'usr_anna')
    expect(anna).toHaveLength(32)
    for (const period of periodsAround(today, 1)) {
      const rows = anna.filter((row) => row.period === period)
      expect(rows.map((row) => [row.categoryId, row.limit])).toEqual(annaLimits)
      expect(rows.every((row) => row.currency === 'PLN')).toBe(true)
    }
  })

  it.each(seedDays)('keys Oleh budgets by his month start in UAH on %s', (today) => {
    const state = seedState(today)
    const oleh = state.budgets.filter((row) => row.userId === 'usr_oleh')
    expect(oleh).toHaveLength(32)
    expect(new Set(oleh.map((row) => row.period))).toEqual(new Set(periodsAround(today, 10)))
    expect(oleh.every((row) => row.currency === 'UAH')).toBe(true)
    expect(oleh.filter((row) => row.period === periodFor(today, 10).key).reduce((sum, row) => sum + row.limit, 0)).toBe(
      3_790_000,
    )
  })

  it('references expense categories of the same user and never repeats a category in a period', () => {
    const state = seedState('2026-10-16')
    for (const row of state.budgets) {
      const category = state.categories.find((candidate) => candidate.id === row.categoryId)
      expect(category).toMatchObject({ userId: row.userId, kind: 'expense', system: null })
    }
    const keys = state.budgets.map((row) => `${row.userId}:${row.period}:${row.categoryId}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(state.budgets.map((row) => row.id)).size).toBe(state.budgets.length)
  })

  it('plans 7 000 zł for Anna in the current period through the API', async () => {
    const mock = createMockApi({ register: defaultHandlers })
    const page = (await mock.handle({ method: 'GET', path: '/v1/budgets' })) as BudgetPage
    expect(page.total).toBe(8)
    expect(page.currency).toBe('PLN')
    expect(page.summary.planned).toBe(700_000)
  })
})
