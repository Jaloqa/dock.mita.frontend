import type { DebtRepaymentRow, DebtRow, MockState } from './db'

export type Movement = { accountId: string; amount: number }

export type Ledger = (state: MockState, userId: string) => Movement[]

export const transferMovements: Ledger = (state, userId) =>
  state.transfers
    .filter((transfer) => transfer.userId === userId)
    .flatMap((transfer) => [
      { accountId: transfer.fromAccountId, amount: -transfer.fromAmount },
      { accountId: transfer.toAccountId, amount: transfer.toAmount },
    ])

export const transactionMovements: Ledger = (state, userId) =>
  state.transactions
    .filter((row) => row.userId === userId)
    .map((row) => ({
      accountId: row.accountId,
      amount: row.kind === 'income' ? row.accountAmount : -row.accountAmount,
    }))

export function debtLegs(debts: readonly DebtRow[], repayments: readonly DebtRepaymentRow[]): Movement[] {
  const directions = new Map(debts.map((debt) => [debt.id, debt.direction]))
  const legs: Movement[] = []
  for (const debt of debts) {
    if (debt.accountId === null || debt.accountAmount === null) continue
    legs.push({
      accountId: debt.accountId,
      amount: debt.direction === 'lent' ? -debt.accountAmount : debt.accountAmount,
    })
  }
  for (const repayment of repayments) {
    const direction = directions.get(repayment.debtId)
    if (direction === undefined || repayment.accountId === null || repayment.accountAmount === null) continue
    legs.push({
      accountId: repayment.accountId,
      amount: direction === 'lent' ? repayment.accountAmount : -repayment.accountAmount,
    })
  }
  return legs
}

export const debtMovements: Ledger = (state, userId) =>
  debtLegs(
    state.debts.filter((row) => row.userId === userId),
    state.debtRepayments.filter((row) => row.userId === userId),
  )

export const ledgers: Ledger[] = [transferMovements, transactionMovements, debtMovements]

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
