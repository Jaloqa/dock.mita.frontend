import type {
  OverviewBudgetDto,
  OverviewDto,
  OverviewGoalDto,
  OverviewRange,
  OverviewTotal,
  OverviewTransactionDto,
  SpendingSlice,
} from '../app/shared/api/contract'
import type { Currency } from '../app/shared/money/money'
import { addDaysIso, daysLeft, type MonthStart, type Period, periodFor, shiftPeriod } from '../app/shared/period/period'
import { budgetsOf, monthStartOf, spentByCategory, summarize } from './budgets'
import { ownCategories } from './categories'
import type { CategoryRow, MockDb, MockState, TransactionRow } from './db'
import { amountIn, goalsOf } from './goals'
import { accountBalances } from './ledger'
import { baseAmountOf, baseCurrencyOf, transactionsIn } from './transactions'

export const SPENDING_SLICES = 5
export const TOP_BUDGETS = 5
export const RECENT_TRANSACTIONS = 6
export const GOALS_PREVIEW = 3

export type DateRange = Pick<Period, 'from' | 'to'>

export type RangePair = { current: DateRange; previous: DateRange }

type Categories = ReadonlyMap<string, Pick<CategoryRow, 'name' | 'system'>>

type KindTotal = { amount: number; count: number }

type Totals = Record<TransactionRow['kind'], KindTotal>

export function rangesOf(range: OverviewRange, today: string, monthStart: MonthStart): RangePair {
  if (range === 'week') {
    return {
      current: { from: addDaysIso(today, -6), to: today },
      previous: { from: addDaysIso(today, -13), to: addDaysIso(today, -7) },
    }
  }
  const period = periodFor(today, monthStart)
  const span = (first: number, last: number): DateRange => ({
    from: shiftPeriod(period.key, first, monthStart).from,
    to: shiftPeriod(period.key, last, monthStart).to,
  })
  return range === 'month'
    ? { current: span(0, 0), previous: span(-1, -1) }
    : { current: span(-11, 0), previous: span(-23, -12) }
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) * 1000) / previous) / 10
}

export function shareTenths(amounts: readonly number[]): number[] {
  const total = amounts.reduce((sum, amount) => sum + amount, 0)
  if (total <= 0) return amounts.map(() => 0)
  const exact = amounts.map((amount) => (amount * 1000) / total)
  const tenths = exact.map((value) => Math.floor(value))
  let rest = 1000 - tenths.reduce((sum, value) => sum + value, 0)
  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (const { index } of byFraction) {
    if (rest <= 0) break
    tenths[index] = (tenths[index] ?? 0) + 1
    rest -= 1
  }
  return tenths
}

export function spendingSlices(spent: ReadonlyMap<string, number>, categories: Categories): SpendingSlice[] {
  let bucket = 0
  const named: { categoryId: string; name: string; amount: number }[] = []
  for (const [categoryId, amount] of spent) {
    const category = categories.get(categoryId)
    if (amount <= 0 || category?.system === 'transfer') continue
    if (!category || category.system === 'other') bucket += amount
    else named.push({ categoryId, name: category.name, amount })
  }
  named.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  const top = named.slice(0, SPENDING_SLICES)
  for (const entry of named.slice(SPENDING_SLICES)) bucket += entry.amount
  const tenths = shareTenths([...top.map((entry) => entry.amount), ...(bucket > 0 ? [bucket] : [])])
  const slices: SpendingSlice[] = top.map((entry, index) => ({ ...entry, percent: (tenths[index] ?? 0) / 10 }))
  if (bucket > 0) {
    slices.push({ categoryId: null, name: null, amount: bucket, percent: (tenths[top.length] ?? 0) / 10 })
  }
  return slices
}

function totalsOf(state: MockState, rows: readonly TransactionRow[], base: Currency): Totals {
  const totals: Totals = { income: { amount: 0, count: 0 }, expense: { amount: 0, count: 0 } }
  for (const row of rows) {
    totals[row.kind].amount += baseAmountOf(state, row, base)
    totals[row.kind].count += 1
  }
  return totals
}

const withChange = (current: KindTotal, previous: KindTotal): OverviewTotal => ({
  ...current,
  change: percentChange(current.amount, previous.amount),
})

const newestFirst = (rows: readonly TransactionRow[]): TransactionRow[] =>
  rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => b.row.date.localeCompare(a.row.date) || b.index - a.index)
    .map((entry) => entry.row)

function balanceOf(state: MockState, userId: string, base: Currency, today: string): OverviewDto['balance'] {
  const balances = accountBalances(state, userId)
  const holding = state.accounts
    .filter((row) => row.userId === userId)
    .map((row) => ({ row, balance: balances.get(row.id) ?? row.openingBalance }))
    .filter(({ row, balance }) => !row.archived || balance !== 0)
  return {
    amount: holding.reduce((sum, { row, balance }) => sum + amountIn(state, balance, row.currency, base, today), 0),
    accounts: holding.length,
  }
}

const usage = (budget: { spent: number; limit: number }): number => (budget.limit > 0 ? budget.spent / budget.limit : 0)

export function overviewOf(db: MockDb, userId: string, range: OverviewRange, today: string): OverviewDto {
  const { state } = db
  const base = baseCurrencyOf(state, userId)
  const monthStart = monthStartOf(state, userId)
  const categories: Categories = new Map(ownCategories(db, userId).map((row) => [row.id, row]))
  const accountNames = new Map(state.accounts.filter((row) => row.userId === userId).map((row) => [row.id, row.name]))
  const counted = (window: DateRange) =>
    transactionsIn(state, userId, window).filter((row) => categories.get(row.categoryId)?.system !== 'transfer')
  const transactionView = (row: TransactionRow): OverviewTransactionDto => ({
    id: row.id,
    kind: row.kind,
    date: row.date,
    title: row.title,
    categoryName: categories.get(row.categoryId)?.name ?? '',
    accountName: accountNames.get(row.accountId) ?? '',
    amount: baseAmountOf(state, row, base),
  })

  const { current, previous } = rangesOf(range, today, monthStart)
  const rows = counted(current)
  const now = totalsOf(state, rows, base)
  const before = totalsOf(state, counted(previous), base)

  const period = periodFor(today, monthStart)
  const days = daysLeft(period, today)
  const budgets = budgetsOf(state, userId, period, today)
  const summary = summarize(budgets, days)
  const topBudgets: OverviewBudgetDto[] = [...budgets]
    .sort((a, b) => usage(b) - usage(a) || b.spent - a.spent)
    .slice(0, TOP_BUDGETS)
    .map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      name: categories.get(row.categoryId)?.name ?? '',
      limit: row.limit,
      spent: row.spent,
      remaining: row.remaining,
      status: row.status,
    }))

  const goals = goalsOf(state, userId, today)
  const preview: OverviewGoalDto[] = [
    ...goals.filter((row) => row.status !== 'reached'),
    ...goals.filter((row) => row.status === 'reached'),
  ]
    .slice(0, GOALS_PREVIEW)
    .map((row) => ({
      id: row.id,
      name: row.name,
      target: row.target,
      saved: row.saved,
      percent: row.percent,
      status: row.status,
      deadline: row.deadline,
    }))

  return {
    range,
    from: current.from,
    to: current.to,
    previousFrom: previous.from,
    previousTo: previous.to,
    currency: base,
    balance: balanceOf(state, userId, base, today),
    income: withChange(now.income, before.income),
    expense: withChange(now.expense, before.expense),
    averageExpense: now.expense.count > 0 ? Math.round(now.expense.amount / now.expense.count) : null,
    transactionCount: now.income.count + now.expense.count,
    spending: spendingSlices(spentByCategory(state, userId, base, current), categories),
    month: {
      period: period.key,
      from: period.from,
      to: period.to,
      planned: summary.planned,
      spent: summary.spent,
      left: summary.left,
      budgets: budgets.length,
    },
    topBudgets,
    recent: newestFirst(rows).slice(0, RECENT_TRANSACTIONS).map(transactionView),
    goals: preview,
    goalCount: goals.length,
    hasTransactions: state.transactions.some((row) => row.userId === userId),
  }
}

export function lastPeriods(today: string, monthStart: MonthStart, count: number): Period[] {
  const current = periodFor(today, monthStart)
  return Array.from({ length: count }, (_, index) => shiftPeriod(current.key, index - count + 1, monthStart))
}
