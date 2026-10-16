import type { GoalDto, GoalStatus, GoalSummary } from '../app/shared/api/contract'
import { type Currency, convertMinor } from '../app/shared/money/money'
import { shiftPeriod, toIsoDate } from '../app/shared/period/period'
import type { GoalContributionRow, GoalRow, MockState } from './db'
import { rateOn } from './rates'
import { baseCurrencyOf } from './transactions'

export const GOAL_DEADLINE_MAX_MONTHS = 600

export const SAVING_WINDOW_MONTHS = 3

export const monthKeyOf = (iso: string): string => iso.slice(0, 7)

export const addMonthsToKey = (key: string, months: number): string => shiftPeriod(key, months, 1).key

const monthIndex = (value: string): number => {
  const [year, month] = value.split('-').map(Number)
  return (year ?? 0) * 12 + (month ?? 1)
}

export const monthsUntil = (deadline: string, today: string): number => monthIndex(deadline) - monthIndex(today)

export function goalStatus(saved: number, target: number, deadline: string | null, today: string): GoalStatus {
  if (saved >= target) return 'reached'
  if (deadline !== null && monthsUntil(deadline, today) < 0) return 'overdue'
  return 'active'
}

export function monthlyHint(remaining: number, deadline: string | null, today: string): number | null {
  if (deadline === null || remaining <= 0) return null
  const months = monthsUntil(deadline, today)
  return months < 0 ? null : Math.ceil(remaining / Math.max(months, 1))
}

export function monthsBefore(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const first = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1 - months, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return toIsoDate(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day ?? 1, lastDay))))
}

export const amountIn = (state: MockState, amount: number, from: Currency, to: Currency, date: string): number =>
  from === to ? amount : convertMinor(amount, rateOn(state.rates, date, from, to))

export function rebaseGoal(state: MockState, row: GoalRow, base: Currency, today: string): void {
  if (row.currency === base) return
  row.target = amountIn(state, row.target, row.currency, base, today)
  row.saved = amountIn(state, row.saved, row.currency, base, today)
  row.currency = base
}

export function goalView(state: MockState, row: GoalRow, base: Currency, today: string): GoalDto {
  const target = amountIn(state, row.target, row.currency, base, today)
  const saved = amountIn(state, row.saved, row.currency, base, today)
  const remaining = Math.max(target - saved, 0)
  return {
    id: row.id,
    name: row.name,
    target,
    saved,
    remaining,
    percent: target > 0 ? Math.floor((saved * 100) / target) : 0,
    monthly: monthlyHint(remaining, row.deadline, today),
    status: goalStatus(saved, target, row.deadline, today),
    deadline: row.deadline,
    accountId: row.accountId,
    currency: base,
  }
}

export function goalsOf(state: MockState, userId: string, today: string): GoalDto[] {
  const base = baseCurrencyOf(state, userId)
  return state.goals.filter((row) => row.userId === userId).map((row) => goalView(state, row, base, today))
}

export const contributionValue = (state: MockState, row: GoalContributionRow, base: Currency): number =>
  amountIn(state, row.baseAmount, row.baseCurrency, base, row.date)

export function summarizeGoals(
  state: MockState,
  userId: string,
  goals: readonly GoalDto[],
  today: string,
): GoalSummary {
  const base = baseCurrencyOf(state, userId)
  const since = monthsBefore(today, SAVING_WINDOW_MONTHS)
  const recent = state.goalContributions
    .filter((row) => row.userId === userId && row.date > since && row.date <= today)
    .reduce((sum, row) => sum + contributionValue(state, row, base), 0)
  return {
    saved: goals.reduce((sum, goal) => sum + goal.saved, 0),
    monthly: Math.round(recent / SAVING_WINDOW_MONTHS),
    active: goals.filter((goal) => goal.status !== 'reached').length,
  }
}

export function linkedGoalCounts(state: MockState, userId: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of state.goals) {
    if (row.userId !== userId || row.accountId === null) continue
    counts.set(row.accountId, (counts.get(row.accountId) ?? 0) + 1)
  }
  return counts
}

export function unlinkAccount(state: MockState, userId: string, accountId: string): void {
  for (const row of state.goals) {
    if (row.userId === userId && row.accountId === accountId) row.accountId = null
  }
}
