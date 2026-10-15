import { describe, expect, it } from 'bun:test'
import {
  groupByDay,
  signedAccountAmount,
  signedAmount,
  signedBaseAmount,
} from '../../../../app/features/transactions/utils/group'
import type { TransactionDto } from '../../../../app/shared/api/contract'

const transaction = (id: string, date: string, kind: TransactionDto['kind'], baseAmount: number): TransactionDto => ({
  id,
  kind,
  date,
  title: id,
  note: null,
  categoryId: 'cat',
  accountId: 'acc',
  amount: baseAmount,
  currency: 'PLN',
  accountAmount: baseAmount,
  rate: 1,
  baseAmount,
})

describe('day grouping', () => {
  it('signs amounts by kind', () => {
    const expense = transaction('a', '2026-10-16', 'expense', 500)
    const income = transaction('b', '2026-10-16', 'income', 700)
    expect([signedAmount(expense), signedAccountAmount(expense), signedBaseAmount(expense)]).toEqual([-500, -500, -500])
    expect(signedBaseAmount(income)).toBe(700)
  })

  it('groups in order of first appearance with signed base sums', () => {
    const items = [
      transaction('a', '2026-10-16', 'expense', 8_640),
      transaction('b', '2026-10-16', 'expense', 9_200),
      transaction('c', '2026-10-10', 'income', 740_000),
      transaction('d', '2026-10-16', 'income', 1_000),
    ]
    const groups = groupByDay(items, (item) => item)
    expect(groups.map((group) => [group.date, group.items.map((item) => item.id), group.sum])).toEqual([
      ['2026-10-16', ['a', 'b', 'd'], -16_840],
      ['2026-10-10', ['c'], 740_000],
    ])
  })
})
