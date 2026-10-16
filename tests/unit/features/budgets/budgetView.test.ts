import { describe, expect, it } from 'bun:test'
import {
  budgetableCategories,
  resolvePeriodKey,
  spentShare,
  statusBadgeClass,
  statusBarTone,
  statusLabelKey,
} from '../../../../app/features/budgets/utils/budgetView'
import type { CategoryDto } from '../../../../app/shared/api/contract'

const category = (id: string, patch: Partial<CategoryDto> = {}): CategoryDto => ({
  id,
  name: id,
  kind: 'expense',
  color: 'chart-1',
  system: null,
  inUse: false,
  ...patch,
})

describe('budget view helpers', () => {
  it('offers expense categories without a budget, never transfers or income', () => {
    const categories = [
      category('food'),
      category('rent'),
      category('salary', { kind: 'income' }),
      category('other', { system: 'other' }),
      category('transfer', { system: 'transfer' }),
    ]
    expect(budgetableCategories(categories, [{ categoryId: 'rent' }]).map((item) => item.id)).toEqual(['food', 'other'])
  })

  it('uses the period from the URL only when it is a valid key', () => {
    expect(resolvePeriodKey('2026-09', '2026-10')).toBe('2026-09')
    for (const value of ['2026-13', 'abc', '', '0000-01', undefined, null, ['2026-09']]) {
      expect(resolvePeriodKey(value, '2026-10')).toBe('2026-10')
    }
  })

  it('measures the spent share and guards an empty plan', () => {
    expect(spentShare(493_570, 700_000)).toBeCloseTo(0.705, 3)
    expect(spentShare(100, 0)).toBe(0)
  })

  it('maps statuses to labels, badges and bar tones', () => {
    expect(statusLabelKey).toEqual({
      on_track: 'budgets.status.onTrack',
      almost_spent: 'budgets.status.almostSpent',
      over_budget: 'budgets.status.overBudget',
    })
    expect(statusBarTone('over_budget')).toBe('ink')
    expect(statusBarTone('almost_spent')).toBe('accent')
    expect(statusBarTone('on_track')).toBe('accent')
    expect(new Set(Object.values(statusBadgeClass)).size).toBe(3)
  })
})
