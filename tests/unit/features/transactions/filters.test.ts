import { describe, expect, it } from 'bun:test'
import {
  defaultFilters,
  emptyStateOf,
  isDefaultFilters,
  isUnfilteredQuery,
  offersAllTime,
  periodKeyOf,
  periodRange,
  shouldCheckHistory,
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
        { search: '  lidl ', categoryId: 'cat_1', accountId: 'acc_1', kind: 'expense', period: 'all', tags: [] },
        'amount',
        '2026-10-16',
        1,
      ),
    ).toEqual({ search: 'lidl', categoryId: 'cat_1', accountId: 'acc_1', kind: 'expense', sort: 'amount' })
  })

  it('sends the selected tag ids comma-separated', () => {
    const tags = [
      { id: 'tag_a', name: 'a' },
      { id: 'tag_b', name: 'b' },
    ]
    expect(toQuery({ ...defaultFilters(), period: 'all', tags }, '-date', '2026-10-16', 1)).toEqual({
      tagIds: 'tag_a,tag_b',
      sort: '-date',
    })
    expect('tagIds' in toQuery(defaultFilters(), '-date', '2026-10-16', 1)).toBe(false)
  })

  it('knows when filters are untouched', () => {
    expect(isDefaultFilters(defaultFilters())).toBe(true)
    expect(isDefaultFilters({ ...defaultFilters(), search: '   ' })).toBe(true)
    expect(isDefaultFilters({ ...defaultFilters(), kind: 'income' })).toBe(false)
    expect(isDefaultFilters({ ...defaultFilters(), period: 'all' })).toBe(false)
    expect(isDefaultFilters({ ...defaultFilters(), tags: [{ id: 'tag_a', name: 'a' }] })).toBe(false)
  })

  it('invites to add the first transaction only when there is no history at all', () => {
    expect(emptyStateOf(defaultFilters(), false)).toBe('firstUse')
    expect(emptyStateOf({ ...defaultFilters(), search: 'lidl' }, false)).toBe('firstUse')
  })

  it('offers all time when only the period hides existing transactions', () => {
    expect(emptyStateOf(defaultFilters(), true)).toBe('period')
    expect(emptyStateOf({ ...defaultFilters(), period: 'lastPeriod' }, true)).toBe('period')
    expect(emptyStateOf({ ...defaultFilters(), search: '  ' }, true)).toBe('period')
  })

  it('offers a reset when other filters hide existing transactions', () => {
    expect(emptyStateOf({ ...defaultFilters(), search: 'zzzz' }, true)).toBe('filtered')
    expect(emptyStateOf({ ...defaultFilters(), kind: 'income', period: 'all' }, true)).toBe('filtered')
    expect(emptyStateOf({ ...defaultFilters(), accountId: 'acc_1' }, true)).toBe('filtered')
    expect(emptyStateOf({ ...defaultFilters(), categoryId: 'cat_1' }, true)).toBe('filtered')
    expect(emptyStateOf({ ...defaultFilters(), period: 'all' }, true)).toBe('filtered')
    expect(emptyStateOf({ ...defaultFilters(), tags: [{ id: 'tag_a', name: 'a' }] }, true)).toBe('filtered')
  })

  it('offers all time next to a reset whenever a period bound applies', () => {
    expect(offersAllTime({ ...defaultFilters(), search: 'lidl' })).toBe(true)
    expect(offersAllTime({ ...defaultFilters(), kind: 'income', period: 'last3Months' })).toBe(true)
    expect(offersAllTime({ ...defaultFilters(), search: 'lidl', period: 'all' })).toBe(false)
  })

  it('treats a query with only a sort as unfiltered', () => {
    expect(isUnfilteredQuery({ sort: '-date' })).toBe(true)
    expect(isUnfilteredQuery({ sort: 'amount' })).toBe(true)
    expect(isUnfilteredQuery({ search: 'lidl', sort: '-date' })).toBe(false)
    expect(isUnfilteredQuery({ from: '2026-10-01', to: '2026-10-31', sort: '-date' })).toBe(false)
  })

  it('checks the history only when a filtered list has loaded empty', () => {
    const empty = { ready: true, unfiltered: false, listPending: false, listCount: 0 }
    expect(shouldCheckHistory(empty)).toBe(true)
    expect(shouldCheckHistory({ ...empty, ready: false })).toBe(false)
    expect(shouldCheckHistory({ ...empty, unfiltered: true })).toBe(false)
    expect(shouldCheckHistory({ ...empty, listPending: true })).toBe(false)
    expect(shouldCheckHistory({ ...empty, listCount: 3 })).toBe(false)
  })
})
