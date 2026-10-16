import { describe, expect, it } from 'bun:test'
import {
  barShare,
  canExport,
  largestOf,
  rangeEnds,
  reportStateOf,
  resolveReportRange,
  sameYear,
} from '../../../../app/features/reports/utils/reportsView'
import { isReportRange, reportRangePeriods } from '../../../../app/shared/api/contract'

const totals = (income: number, expense: number) => ({ income, expense })

describe('report view helpers', () => {
  it('accepts the three ranges and falls back to six months', () => {
    expect(['3m', '6m', '12m'].map((value) => isReportRange(value))).toEqual([true, true, true])
    expect(reportRangePeriods).toEqual({ '3m': 3, '6m': 6, '12m': 12 })
    expect(resolveReportRange('12m')).toBe('12m')
    expect(resolveReportRange('3m')).toBe('3m')
    for (const value of [undefined, null, '', '1m', '6M', 'year', ['3m'], 6]) {
      expect(resolveReportRange(value)).toBe('6m')
    }
  })

  it('finds the first and the last period and compares their years', () => {
    expect(rangeEnds([{ period: '2026-05' }, { period: '2026-06' }, { period: '2026-10' }])).toEqual({
      first: '2026-05',
      last: '2026-10',
    })
    expect(rangeEnds([])).toBeNull()
    expect(sameYear('2026-05', '2026-10')).toBe(true)
    expect(sameYear('2025-11', '2026-10')).toBe(false)
  })

  it('tells an account without transactions from a range without data', () => {
    expect(reportStateOf({ hasTransactions: false, totals: totals(0, 0) })).toBe('noTransactions')
    expect(reportStateOf({ hasTransactions: true, totals: totals(0, 0) })).toBe('noData')
    expect(reportStateOf({ hasTransactions: true, totals: totals(100, 0) })).toBe('ready')
    expect(reportStateOf({ hasTransactions: true, totals: totals(0, 100) })).toBe('ready')
  })

  it('allows export only for a loaded, current report with data', () => {
    const ready = { hasTransactions: true, totals: totals(100, 50) }
    expect(canExport(ready, false)).toBe(true)
    expect(canExport(ready, true)).toBe(false)
    expect(canExport(undefined, false)).toBe(false)
    expect(canExport({ hasTransactions: true, totals: totals(0, 0) }, false)).toBe(false)
    expect(canExport({ hasTransactions: false, totals: totals(0, 0) }, false)).toBe(false)
  })

  it('scales structure bars to the largest amount', () => {
    expect(largestOf([{ amount: 50 }, { amount: 200 }, { amount: 120 }])).toBe(200)
    expect(largestOf([])).toBe(0)
    expect(barShare(50, 200)).toBe(0.25)
    expect(barShare(200, 200)).toBe(1)
    expect(barShare(10, 0)).toBe(0)
  })
})
