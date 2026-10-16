import { describe, expect, it } from 'bun:test'
import { invalidationMap } from '../../../app/shared/api/invalidation'

describe('invalidation map', () => {
  it('refreshes budgets after budget, transaction, category and settings changes', () => {
    expect(invalidationMap.budgets).toEqual([['budgets'], ['overview']])
    for (const change of ['transactions', 'categories', 'settings'] as const) {
      expect(invalidationMap[change]).toContainEqual(['budgets'])
    }
  })

  it('refreshes goals, linked accounts and transfers after goal changes and contributions', () => {
    expect(invalidationMap.goals).toEqual([['goals'], ['accounts'], ['overview']])
    expect(invalidationMap.goalContributions).toEqual([['goals'], ['accounts'], ['transfers'], ['overview']])
    for (const change of ['settings', 'accounts'] as const) {
      expect(invalidationMap[change]).toContainEqual(['goals'])
    }
  })

  it('refreshes the overview after every change that feeds it', () => {
    for (const change of [
      'transactions',
      'transfers',
      'accounts',
      'budgets',
      'goals',
      'goalContributions',
      'categories',
      'settings',
    ] as const) {
      expect(invalidationMap[change]).toContainEqual(['overview'])
    }
  })

  it('refreshes reports only after changes that feed them', () => {
    for (const change of ['transactions', 'accounts', 'categories', 'settings'] as const) {
      expect(invalidationMap[change]).toContainEqual(['reports'])
    }
    for (const change of ['transfers', 'budgets', 'goals', 'goalContributions'] as const) {
      expect(invalidationMap[change]).not.toContainEqual(['reports'])
    }
    expect(invalidationMap.demo).toEqual([[]])
  })
})
