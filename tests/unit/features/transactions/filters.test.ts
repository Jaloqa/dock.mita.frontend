import { describe, expect, it } from 'bun:test'
import {
  defaultFilters,
  isDefaultFilters,
  periodKeyOf,
  periodRange,
  toQuery,
} from '../../../../app/features/transactions/utils/filters'

describe('transaction filters', () => {
  it('turns period presets into date ranges of financial periods', () => {
    expect(periodRange('thisPeriod', '2026-10-16', 1)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(periodRange('thisPeriod', '2026-10-05', 10)).toEqual({ from: '2026-09-10', to: '2026-10-09' })
    expect(periodRange('lastPeriod', '2026-01-03', 1)).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(periodRange('last3Months', '2026-10-16', 1)).toEqual({ from: '2026-08-01', to: '2026-10-31' })
    expect(periodRange('thisYear', '2026-10-16', 10)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(periodRange('all', '2026-10-16', 1)).toEqual({})
  })

  it('names the month of single-period presets only', () => {
    expect(periodKeyOf('thisPeriod', '2026-10-05', 10)).toBe('2026-09')
    expect(periodKeyOf('lastPeriod', '2026-10-16', 1)).toBe('2026-09')
    expect(periodKeyOf('all', '2026-10-16', 1)).toBeUndefined()
  })

  it('builds a query with only the active filters', () => {
    expect(toQuery(defaultFilters(), '-date', '2026-10-16', 1)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
      sort: '-date',
    })
    expect(
      toQuery(
        { search: '  lidl ', categoryId: 'cat_1', accountId: 'acc_1', kind: 'expense', period: 'all' },
        'amount',
        '2026-10-16',
        1,
      ),
    ).toEqual({ search: 'lidl', categoryId: 'cat_1', accountId: 'acc_1', kind: 'expense', sort: 'amount' })
  })

  it('knows when filters are untouched', () => {
    expect(isDefaultFilters(defaultFilters())).toBe(true)
    expect(isDefaultFilters({ ...defaultFilters(), search: '   ' })).toBe(true)
    expect(isDefaultFilters({ ...defaultFilters(), kind: 'income' })).toBe(false)
    expect(isDefaultFilters({ ...defaultFilters(), period: 'all' })).toBe(false)
  })
})
