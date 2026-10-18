import { describe, expect, it } from 'bun:test'
import { seedState } from '../../../mocks/seed'
import { cloneUserData } from '../../../mocks/seed/cloneUser'

const ownedBy = (state: ReturnType<typeof seedState>, userId: string) => ({
  accounts: state.accounts.filter((row) => row.userId === userId),
  categories: state.categories.filter((row) => row.userId === userId),
  transactions: state.transactions.filter((row) => row.userId === userId),
  budgets: state.budgets.filter((row) => row.userId === userId),
  goals: state.goals.filter((row) => row.userId === userId),
  goalContributions: state.goalContributions.filter((row) => row.userId === userId),
  transfers: state.transfers.filter((row) => row.userId === userId),
  settings: state.settings.filter((row) => row.userId === userId),
  users: state.users.filter((row) => row.id === userId),
})

const tables = [
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'goals',
  'goalContributions',
  'transfers',
  'settings',
  'users',
] as const

describe('cloneUserData', () => {
  it('copies every table with the same row counts', () => {
    const state = seedState()
    cloneUserData(state, 'usr_anna', 'u-real-1')
    const anna = ownedBy(state, 'usr_anna')
    const copy = ownedBy(state, 'u-real-1')
    for (const table of tables) {
      expect(copy[table].length).toBe(anna[table].length)
      expect(copy[table].length).toBeGreaterThan(0)
    }
  })

  it('shares no id with the source rows', () => {
    const state = seedState()
    cloneUserData(state, 'usr_anna', 'u-real-1')
    const anna = ownedBy(state, 'usr_anna')
    const copy = ownedBy(state, 'u-real-1')
    for (const table of tables) {
      if (table === 'settings') continue
      const taken = new Set(anna[table].map((row) => ('id' in row ? row.id : '')))
      for (const row of copy[table]) expect(taken.has('id' in row ? row.id : '')).toBe(false)
    }
  })

  it('remaps every cross reference to the copied rows', () => {
    const state = seedState()
    cloneUserData(state, 'usr_anna', 'u-real-1')
    const copy = ownedBy(state, 'u-real-1')
    const accountIds = new Set(copy.accounts.map((row) => row.id))
    const categoryIds = new Set(copy.categories.map((row) => row.id))
    const goalIds = new Set(copy.goals.map((row) => row.id))
    const transferIds = new Set(copy.transfers.map((row) => row.id))
    for (const row of copy.transactions) {
      expect(accountIds.has(row.accountId)).toBe(true)
      expect(categoryIds.has(row.categoryId)).toBe(true)
    }
    for (const row of copy.transfers) {
      expect(accountIds.has(row.fromAccountId)).toBe(true)
      expect(accountIds.has(row.toAccountId)).toBe(true)
    }
    for (const row of copy.budgets) expect(categoryIds.has(row.categoryId)).toBe(true)
    for (const row of copy.goals) expect(row.accountId === null || accountIds.has(row.accountId)).toBe(true)
    for (const row of copy.goalContributions) {
      expect(goalIds.has(row.goalId)).toBe(true)
      expect(row.fromAccountId === null || accountIds.has(row.fromAccountId)).toBe(true)
      expect(row.transferId === null || transferIds.has(row.transferId)).toBe(true)
    }
  })

  it('keeps the base currency and leaves the source untouched', () => {
    const state = seedState()
    const before = JSON.stringify(ownedBy(state, 'usr_anna'))
    cloneUserData(state, 'usr_anna', 'u-real-1')
    expect(state.settings.find((row) => row.userId === 'u-real-1')?.baseCurrency).toBe('PLN')
    expect(JSON.stringify(ownedBy(state, 'usr_anna'))).toBe(before)
  })

  it('does not duplicate when called twice', () => {
    const state = seedState()
    cloneUserData(state, 'usr_anna', 'u-real-1')
    const copy = JSON.stringify(ownedBy(state, 'u-real-1'))
    expect(cloneUserData(state, 'usr_anna', 'u-real-1')).toBe(false)
    expect(JSON.stringify(ownedBy(state, 'u-real-1'))).toBe(copy)
  })
})
