import {
  type CategoryColor,
  type ReportDto,
  type ReportPeriodDto,
  type ReportRange,
  type ReportStructureDto,
  reportRangePeriods,
} from '../app/shared/api/contract'
import { type Currency, roundHalfAwayFromZero } from '../app/shared/money/money'
import { type Period, periodFor } from '../app/shared/period/period'
import { monthStartOf, spentByCategory } from './budgets'
import { ownCategories } from './categories'
import type { CategoryRow, MockDb, MockState, TransactionRow } from './db'
import { lastPeriods, shareTenths } from './overview'
import { baseAmountOf, baseCurrencyOf, transactionsIn } from './transactions'

type Categories = ReadonlyMap<string, Pick<CategoryRow, 'name' | 'color' | 'system'>>

export function savingsRateOf(income: number, expense: number): number | null {
  if (income <= 0) return null
  return roundHalfAwayFromZero(((income - expense) * 1000) / income) / 10
}

function periodTotals(
  state: MockState,
  rows: readonly TransactionRow[],
  base: Currency,
  period: Period,
): ReportPeriodDto {
  let income = 0
  let expense = 0
  for (const row of rows) {
    if (row.date < period.from || row.date > period.to) continue
    const amount = baseAmountOf(state, row, base)
    if (row.kind === 'income') income += amount
    else expense += amount
  }
  return { period: period.key, from: period.from, to: period.to, income, expense }
}

function structureOf(spent: ReadonlyMap<string, number>, categories: Categories, period: Period): ReportStructureDto {
  const entries: { categoryId: string; name: string; color: CategoryColor; amount: number }[] = []
  for (const [categoryId, amount] of spent) {
    const category = categories.get(categoryId)
    if (!category || amount <= 0 || category.system === 'transfer') continue
    entries.push({ categoryId, name: category.name, color: category.color, amount })
  }
  entries.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  const tenths = shareTenths(entries.map((entry) => entry.amount))
  return {
    period: period.key,
    from: period.from,
    to: period.to,
    total: entries.reduce((sum, entry) => sum + entry.amount, 0),
    items: entries.map((entry, index) => ({ ...entry, percent: (tenths[index] ?? 0) / 10 })),
  }
}

export function reportOf(db: MockDb, userId: string, range: ReportRange, today: string): ReportDto {
  const { state } = db
  const base = baseCurrencyOf(state, userId)
  const monthStart = monthStartOf(state, userId)
  const categories: Categories = new Map(ownCategories(db, userId).map((row) => [row.id, row]))
  const current = periodFor(today, monthStart)
  const periods = lastPeriods(today, monthStart, reportRangePeriods[range])
  const from = periods[0]?.from ?? current.from
  const rows = transactionsIn(state, userId, { from, to: current.to }).filter(
    (row) => categories.get(row.categoryId)?.system !== 'transfer',
  )
  const byPeriod = periods.map((period) => periodTotals(state, rows, base, period))
  const totals = byPeriod.reduce(
    (sum, row) => ({ income: sum.income + row.income, expense: sum.expense + row.expense }),
    { income: 0, expense: 0 },
  )
  const count = Math.max(byPeriod.length, 1)

  return {
    range,
    from,
    to: current.to,
    currency: base,
    periods: byPeriod,
    totals,
    averageIncome: Math.round(totals.income / count),
    averageExpense: Math.round(totals.expense / count),
    savingsRate: savingsRateOf(totals.income, totals.expense),
    structure: structureOf(spentByCategory(state, userId, base, current), categories, current),
    hasTransactions: state.transactions.some((row) => row.userId === userId),
  }
}
