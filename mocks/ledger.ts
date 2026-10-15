import type { MockState } from './db'

export type Movement = { accountId: string; amount: number }

export type Ledger = (state: MockState, userId: string) => Movement[]

export const ledgers: Ledger[] = []

const movementsOf = (state: MockState, userId: string): Movement[] => ledgers.flatMap((ledger) => ledger(state, userId))

export function accountBalances(state: MockState, userId: string): Map<string, number> {
  const balances = new Map(
    state.accounts
      .filter((account) => account.userId === userId)
      .map((account) => [account.id, account.openingBalance]),
  )
  for (const movement of movementsOf(state, userId)) {
    balances.set(movement.accountId, (balances.get(movement.accountId) ?? 0) + movement.amount)
  }
  return balances
}

export function accountsInUse(state: MockState, userId: string): Set<string> {
  return new Set(movementsOf(state, userId).map((movement) => movement.accountId))
}
