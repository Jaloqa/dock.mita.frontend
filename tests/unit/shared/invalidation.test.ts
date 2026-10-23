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

  it('refreshes debts, the accounts they move and the overview after debt changes', () => {
    expect(invalidationMap.debts).toEqual([['debts'], ['accounts'], ['overview']])
  })

  it('refreshes only the groups after a group change because groups never touch personal data', () => {
    expect(invalidationMap.groups).toEqual([['groups']])
    for (const change of ['transactions', 'accounts', 'debts', 'settings'] as const) {
      expect(invalidationMap[change]).not.toContainEqual(['groups'])
    }
  })

  it('refreshes debts after a settings change because their summary is in the base currency', () => {
    expect(invalidationMap.settings).toEqual([
      ['overview'],
      ['budgets'],
      ['reports'],
      ['transactions'],
      ['accounts'],
      ['goals'],
      ['debts'],
    ])
  })

  it('refreshes the overview after every change that feeds it', () => {
    for (const change of [
      'transactions',
      'transfers',
      'accounts',
      'budgets',
      'goals',
      'goalContributions',
      'debts',
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
    for (const change of ['transfers', 'budgets', 'goals', 'goalContributions', 'debts'] as const) {
      expect(invalidationMap[change]).not.toContainEqual(['reports'])
    }
    expect(invalidationMap.demo).toEqual([[]])
  })

  it('refreshes only the demo users after a profile change because the response replaces the current user', () => {
    expect(invalidationMap.profile).toEqual([['demo']])
  })

  it('refreshes tags and the transaction pages that show them after a tag change', () => {
    expect(invalidationMap.tags).toEqual([['tags'], ['transactions']])
    expect(invalidationMap.transactions).toContainEqual(['tags'])
  })
})
