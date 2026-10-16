import type { BudgetDto, BudgetStatus, BudgetSummary } from '../app/shared/api/contract'
import { type Currency, convertMinor } from '../app/shared/money/money'
import { daysLeft, type MonthStart, type Period, periodByKey } from '../app/shared/period/period'
import type { CategoryReference } from './categories'
import type { BudgetRow, MockState } from './db'
import { rateOn } from './rates'
import { baseAmountOf, baseCurrencyOf, transactionsIn } from './transactions'

export function budgetStatus(spent: number, limit: number): BudgetStatus {
  if (spent > limit) return 'over_budget'
  if (spent * 100 >= limit * 85) return 'almost_spent'
  return 'on_track'
}

export const perDayHint = (remaining: number, days: number): number | null =>
  remaining > 0 && days > 0 ? Math.floor(remaining / days) : null

export const monthStartOf = (state: MockState, userId: string): MonthStart =>
  state.settings.find((row) => row.userId === userId)?.monthStartDay ?? 1

export const limitIn = (state: MockState, row: BudgetRow, base: Currency, period: Period): number =>
  row.currency === base ? row.limit : convertMinor(row.limit, rateOn(state.rates, period.from, row.currency, base))

export function spentByCategory(
  state: MockState,
  userId: string,
  base: Currency,
  range: Pick<Period, 'from' | 'to'>,
): Map<string, number> {
  const spent = new Map<string, number>()
  for (const row of transactionsIn(state, userId, range)) {
    if (row.kind !== 'expense') continue
    spent.set(row.categoryId, (spent.get(row.categoryId) ?? 0) + baseAmountOf(state, row, base))
  }
  return spent
}

export function budgetsOf(state: MockState, userId: string, period: Period, today: string): BudgetDto[] {
  const base = baseCurrencyOf(state, userId)
  const spent = spentByCategory(state, userId, base, period)
  const days = daysLeft(period, today)
  return state.budgets
    .filter((row) => row.userId === userId && row.period === period.key)
    .map((row) => {
      const limit = limitIn(state, row, base, period)
      const used = spent.get(row.categoryId) ?? 0
      const remaining = limit - used
      return {
        id: row.id,
        categoryId: row.categoryId,
        period: row.period,
        limit,
        spent: used,
        remaining,
        status: budgetStatus(used, limit),
        perDay: perDayHint(remaining, days),
      }
    })
}

export function summarize(budgets: readonly BudgetDto[], days: number): BudgetSummary {
  const planned = budgets.reduce((sum, budget) => sum + budget.limit, 0)
  const spent = budgets.reduce((sum, budget) => sum + budget.spent, 0)
  return { planned, spent, left: planned - spent, daysLeft: days }
}

export const budgetReference: CategoryReference = {
  usedCategoryIds: (state, userId) =>
    new Set(state.budgets.filter((row) => row.userId === userId).map((row) => row.categoryId)),
  reassign: (state, userId, fromId, toId) => {
    const base = baseCurrencyOf(state, userId)
    const monthStart = monthStartOf(state, userId)
    const merged = new Set<string>()
    for (const row of state.budgets) {
      if (row.userId !== userId || row.categoryId !== fromId) continue
      const target = state.budgets.find(
        (candidate) => candidate.userId === userId && candidate.categoryId === toId && candidate.period === row.period,
      )
      if (!target) {
        row.categoryId = toId
        continue
      }
      const period = periodByKey(row.period, monthStart)
      target.limit = limitIn(state, target, base, period) + limitIn(state, row, base, period)
      target.currency = base
      merged.add(row.id)
    }
    state.budgets = state.budgets.filter((row) => !merged.has(row.id))
  },
}
