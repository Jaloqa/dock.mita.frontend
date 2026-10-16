import { describe, expect, it } from 'bun:test'
import { invalidationMap } from '../../../app/shared/api/invalidation'

describe('invalidation map', () => {
  it('refreshes budgets after budget, transaction, category and settings changes', () => {
    expect(invalidationMap.budgets).toEqual([['budgets'], ['overview']])
    for (const change of ['transactions', 'categories', 'settings'] as const) {
      expect(invalidationMap[change]).toContainEqual(['budgets'])
    }
  })
})
