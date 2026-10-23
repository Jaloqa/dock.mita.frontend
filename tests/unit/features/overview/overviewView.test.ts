import { describe, expect, it } from 'bun:test'
import {
  balanceWithDebts,
  budgetTone,
  dayLabelOf,
  hasOpenDebts,
  initialOf,
  previousMonthKey,
  resolveOverviewRange,
  sameYear,
  shownBalance,
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

  it('adds what is owed to me and takes what I owe off the balance', () => {
    expect(balanceWithDebts(1_000_000, { owedToMe: 61_500, owedByMe: 150_000, open: 3, overdue: 1, groups: 0 })).toBe(
      911_500,
    )
    expect(balanceWithDebts(500, { owedToMe: 0, owedByMe: 0, open: 0, overdue: 0, groups: 0 })).toBe(500)
    expect(balanceWithDebts(-2_000, { owedToMe: 10_000, owedByMe: 0, open: 1, overdue: 0, groups: 0 })).toBe(8_000)
  })

  it('counts debts as open while at least one is open or a linked group has a balance', () => {
    expect(hasOpenDebts({ owedToMe: 0, owedByMe: 100, open: 1, overdue: 0, groups: 0 })).toBe(true)
    expect(hasOpenDebts({ owedToMe: 100, owedByMe: 0, open: 0, overdue: 0, groups: 1 })).toBe(true)
    expect(hasOpenDebts({ owedToMe: 0, owedByMe: 0, open: 0, overdue: 0, groups: 0 })).toBe(false)
  })

  it('shows the balance with debts only when the switch is on and a debt is open', () => {
    const balance = { amount: 1_000_000, accounts: 4 }
    const open = { owedToMe: 61_500, owedByMe: 150_000, open: 3, overdue: 1, groups: 0 }
    const none = { owedToMe: 0, owedByMe: 0, open: 0, overdue: 0, groups: 0 }
    expect(shownBalance({ balance, debts: open }, true)).toEqual({ amount: 911_500, withDebts: true })
    expect(shownBalance({ balance, debts: open }, false)).toEqual({ amount: 1_000_000, withDebts: false })
    expect(shownBalance({ balance, debts: none }, true)).toEqual({ amount: 1_000_000, withDebts: false })
    expect(shownBalance({ balance, debts: none }, false)).toEqual({ amount: 1_000_000, withDebts: false })
    const groupsOnly = { owedToMe: 4_232, owedByMe: 0, open: 0, overdue: 0, groups: 1 }
    expect(shownBalance({ balance, debts: groupsOnly }, true)).toEqual({ amount: 1_004_232, withDebts: true })
  })

  it('takes the first letter of a title', () => {
    expect(initialOf('  żabka')).toBe('Ż')
    expect(initialOf('Biedronka')).toBe('B')
    expect(initialOf('')).toBe('')
  })
})
