import type { CategoryKind, TransactionQuery, TransactionSort } from '../../../shared/api/contract'
import { type MonthStart, periodFor, shiftPeriod } from '../../../shared/period/period'

export type KindFilter = CategoryKind | 'all'

export const periodPresets = ['thisPeriod', 'lastPeriod', 'last3Months', 'thisYear', 'all'] as const

export type PeriodPreset = (typeof periodPresets)[number]

export type TransactionFilters = {
  search: string
  categoryId: string | null
  accountId: string | null
  kind: KindFilter
  period: PeriodPreset
}

export const defaultFilters = (): TransactionFilters => ({
  search: '',
  categoryId: null,
  accountId: null,
  kind: 'all',
  period: 'thisPeriod',
})

export const isDefaultFilters = (filters: TransactionFilters): boolean =>
  filters.search.trim() === '' &&
  filters.categoryId === null &&
  filters.accountId === null &&
  filters.kind === 'all' &&
  filters.period === 'thisPeriod'

export function periodRange(
  preset: PeriodPreset,
  today: string,
  monthStart: MonthStart,
): { from?: string; to?: string } {
  const current = periodFor(today, monthStart)
  switch (preset) {
    case 'thisPeriod':
      return { from: current.from, to: current.to }
    case 'lastPeriod': {
      const last = shiftPeriod(current.key, -1, monthStart)
      return { from: last.from, to: last.to }
    }
    case 'last3Months':
      return { from: shiftPeriod(current.key, -2, monthStart).from, to: current.to }
    case 'thisYear':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` }
    case 'all':
      return {}
  }
}

export function periodKeyOf(preset: PeriodPreset, today: string, monthStart: MonthStart): string | undefined {
  const current = periodFor(today, monthStart)
  if (preset === 'thisPeriod') return current.key
  if (preset === 'lastPeriod') return shiftPeriod(current.key, -1, monthStart).key
  return undefined
}

export function toQuery(
  filters: TransactionFilters,
  sort: TransactionSort,
  today: string,
  monthStart: MonthStart,
): TransactionQuery {
  const search = filters.search.trim()
  return {
    ...(search ? { search } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.kind !== 'all' ? { kind: filters.kind } : {}),
    ...periodRange(filters.period, today, monthStart),
    sort,
  }
}
