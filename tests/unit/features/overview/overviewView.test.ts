import { describe, expect, it } from 'bun:test'
import {
  budgetTone,
  dayLabelOf,
  initialOf,
  previousMonthKey,
  resolveOverviewRange,
  sameYear,
  sliceColor,
  usedShare,
} from '../../../../app/features/overview/utils/overviewView'
import { isOverviewRange } from '../../../../app/shared/api/contract'

describe('overview view helpers', () => {
  it('accepts the three ranges and falls back to the month', () => {
    expect(['week', 'month', 'year'].map((value) => isOverviewRange(value))).toEqual([true, true, true])
    expect(resolveOverviewRange('year')).toBe('year')
    for (const value of [undefined, null, '', 'decade', 'Week', ['week'], 7]) {
      expect(resolveOverviewRange(value)).toBe('month')
    }
  })

  it('colours slices by rank and the bucket last', () => {
    expect([0, 1, 2, 3, 4].map((index) => sliceColor(index, false))).toEqual([
      'chart-1',
      'chart-2',
      'chart-3',
      'chart-4',
      'chart-5',
    ])
    expect(sliceColor(5, false)).toBe('chart-5')
    expect(sliceColor(2, true)).toBe('chart-6')
  })

  it('compares years and steps back one month key', () => {
    expect(sameYear('2026-10-01', '2026-10-31')).toBe(true)
    expect(sameYear('2025-11-01', '2026-10-31')).toBe(false)
    expect(previousMonthKey('2026-10')).toBe('2026-09')
    expect(previousMonthKey('2026-01')).toBe('2025-12')
  })

  it('names today and yesterday', () => {
    expect(dayLabelOf('2026-10-16', '2026-10-16')).toBe('today')
    expect(dayLabelOf('2026-10-15', '2026-10-16')).toBe('yesterday')
    expect(dayLabelOf('2026-09-30', '2026-10-01')).toBe('yesterday')
    expect(dayLabelOf('2026-10-14', '2026-10-16')).toBe('date')
  })

  it('computes shares and bar tones', () => {
    expect(usedShare(50, 200)).toBe(0.25)
    expect(usedShare(10, 0)).toBe(0)
    expect(budgetTone('over_budget')).toBe('ink')
    expect(budgetTone('almost_spent')).toBe('accent')
    expect(budgetTone('on_track')).toBe('accent')
  })

  it('takes the first letter of a title', () => {
    expect(initialOf('  żabka')).toBe('Ż')
    expect(initialOf('Biedronka')).toBe('B')
    expect(initialOf('')).toBe('')
  })
})
