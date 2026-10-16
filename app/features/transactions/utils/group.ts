import type { TransactionDto, TransactionSort } from '../../../shared/api/contract'

type Signed = Pick<TransactionDto, 'kind'>

const sign = (transaction: Signed, amount: number): number => (transaction.kind === 'income' ? amount : -amount)

export const signedAmount = (transaction: Signed & Pick<TransactionDto, 'amount'>): number =>
  sign(transaction, transaction.amount)

export const signedAccountAmount = (transaction: Signed & Pick<TransactionDto, 'accountAmount'>): number =>
  sign(transaction, transaction.accountAmount)

export const signedBaseAmount = (transaction: Signed & Pick<TransactionDto, 'baseAmount'>): number =>
  sign(transaction, transaction.baseAmount)

export type DayGroup<T> = { date: string; items: T[]; sum: number }

export function groupByDay<T>(items: readonly T[], transactionOf: (item: T) => TransactionDto): DayGroup<T>[] {
  const groups = new Map<string, DayGroup<T>>()
  for (const item of items) {
    const transaction = transactionOf(item)
    const group = groups.get(transaction.date) ?? { date: transaction.date, items: [], sum: 0 }
    group.items.push(item)
    group.sum += signedBaseAmount(transaction)
    groups.set(transaction.date, group)
  }
  return [...groups.values()]
}

export function orderDayGroups<T>(groups: readonly DayGroup<T>[], sort: TransactionSort): DayGroup<T>[] {
  const direction = sort === 'date' ? 1 : -1
  return [...groups].sort((a, b) => direction * a.date.localeCompare(b.date))
}
