import {
  type BudgetStatus,
  type CategoryColor,
  isOverviewRange,
  type OverviewRange,
} from '../../../shared/api/contract'
import { addDaysIso, shiftPeriod } from '../../../shared/period/period'

const SLICE_COLORS: readonly CategoryColor[] = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5']

export const resolveOverviewRange = (value: unknown): OverviewRange => (isOverviewRange(value) ? value : 'month')

export const sliceColor = (index: number, bucket: boolean): CategoryColor =>
  bucket ? 'chart-6' : (SLICE_COLORS[index] ?? 'chart-5')

export const sameYear = (from: string, to: string): boolean => from.slice(0, 4) === to.slice(0, 4)

export const previousMonthKey = (key: string): string => shiftPeriod(key, -1, 1).key

export type DayLabel = 'today' | 'yesterday' | 'date'

export function dayLabelOf(date: string, today: string): DayLabel {
  if (date === today) return 'today'
  return date === addDaysIso(today, -1) ? 'yesterday' : 'date'
}

export const usedShare = (spent: number, limit: number): number => (limit > 0 ? spent / limit : 0)

export const budgetTone = (status: BudgetStatus): 'accent' | 'ink' => (status === 'over_budget' ? 'ink' : 'accent')

export const initialOf = (text: string): string => Array.from(text.trim())[0]?.toLocaleUpperCase() ?? ''
