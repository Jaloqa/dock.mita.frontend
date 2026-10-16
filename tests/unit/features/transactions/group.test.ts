import { describe, expect, it } from 'bun:test'
import {
  groupByDay,
  orderDayGroups,
  signedAccountAmount,
  signedAmount,
  signedBaseAmount,
} from '../../../../app/features/transactions/utils/group'
import type { TransactionDto, TransactionSort } from '../../../../app/shared/api/contract'

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

  it('orders day groups by date, ascending only for the ascending date sort', () => {
    const items = [
      transaction('a', '2026-10-10', 'expense', 900),
      transaction('b', '2026-10-16', 'expense', 500),
      transaction('c', '2026-10-12', 'expense', 300),
      transaction('d', '2026-10-10', 'expense', 100),
    ]
    const groups = groupByDay(items, (item) => item)
    const dates = (sort: TransactionSort) => orderDayGroups(groups, sort).map((group) => group.date)
    expect(dates('-amount')).toEqual(['2026-10-16', '2026-10-12', '2026-10-10'])
    expect(dates('amount')).toEqual(['2026-10-16', '2026-10-12', '2026-10-10'])
    expect(dates('-date')).toEqual(['2026-10-16', '2026-10-12', '2026-10-10'])
    expect(dates('date')).toEqual(['2026-10-10', '2026-10-12', '2026-10-16'])
    expect(orderDayGroups(groups, '-amount')[2]?.items.map((item) => item.id)).toEqual(['a', 'd'])
    expect(groups.map((group) => group.date)).toEqual(['2026-10-10', '2026-10-16', '2026-10-12'])
  })
})
