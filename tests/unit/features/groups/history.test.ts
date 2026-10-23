import { describe, expect, it } from 'bun:test'
import { expenseChanges, isExpenseState, repaymentChanges } from '../../../../app/features/groups/utils/history'
import type { GroupExpenseState, GroupRepaymentState } from '../../../../app/shared/api/contract'
import { todayIso } from '../../../../app/shared/period/period'
import { equalShares, exactShares } from '../../../../mocks/groups'
import { demoGroups } from '../../../../mocks/seed/groups'

const seeded = demoGroups(todayIso())

const statesOf = <T>(entryId: string): T[] =>
  seeded.groupEvents.filter((event) => event.entryId === entryId).map((event) => event.state as T)

const [created, updated] = statesOf<GroupExpenseState>('gex_dinner') as [GroupExpenseState, GroupExpenseState]
const [repayment] = statesOf<GroupRepaymentState>('gpay_kasia_anna') as [GroupRepaymentState]

const members = ['gmb_anna', 'gmb_olya', 'gmb_max', 'gmb_kasia']

describe('expense changes', () => {
  it('finds the amount of an edited dinner', () => {
    expect(created.amount).toBe(10_000)
    expect(updated.amount).toBe(12_000)
    expect(expenseChanges(created, updated)).toEqual(['amount'])
  })

  it('finds nothing between identical states', () => {
    expect(expenseChanges(created, structuredClone(created))).toEqual([])
    expect(expenseChanges(updated, updated)).toEqual([])
  })

  it('finds the payer and the split in this order', () => {
    const next: GroupExpenseState = {
      ...updated,
      payerId: 'gmb_olya',
      shares: equalShares(updated.amount, updated.groupAmount, ['gmb_anna', 'gmb_olya'], 'gmb_olya'),
    }
    expect(expenseChanges(updated, next)).toEqual(['payer', 'split'])
  })

  it('counts a changed currency as an amount change', () => {
    expect(expenseChanges(updated, { ...updated, currency: 'PLN' })).toEqual(['amount'])
  })

  it('finds the date, the category, the tags and the description', () => {
    const next: GroupExpenseState = {
      ...updated,
      description: 'Late dinner',
      tags: ['dinner', 'late'],
      categoryId: 'gifts',
      date: '2020-01-01',
    }
    expect(expenseChanges(updated, next)).toEqual(['date', 'category', 'tags', 'description'])
  })

  it('treats the spelling and the order of the tags as a change', () => {
    const tagged = { ...updated, tags: ['a', 'b'] }
    expect(expenseChanges(tagged, { ...tagged, tags: ['b', 'a'] })).toEqual(['tags'])
    expect(expenseChanges(tagged, { ...tagged, tags: ['A', 'b'] })).toEqual(['tags'])
    expect(expenseChanges(tagged, { ...tagged, tags: [...tagged.tags] })).toEqual([])
  })

  it('counts a changed rate or a changed manual flag as a rate change', () => {
    expect(expenseChanges(updated, { ...updated, rate: 0.25 })).toEqual(['rate'])
    expect(expenseChanges(updated, { ...updated, rateManual: true })).toEqual(['rate'])
  })

  it('does not report the split when only its amounts follow the expense amount', () => {
    const repriced: GroupExpenseState = {
      ...updated,
      amount: 20_000,
      groupAmount: 20_000,
      shares: equalShares(20_000, 20_000, members, updated.payerId),
    }
    expect(expenseChanges(updated, repriced)).toEqual(['amount'])
  })

  it('does not report the split when only the converted amounts of the shares move with the rate', () => {
    const repriced: GroupExpenseState = {
      ...updated,
      rate: 2,
      groupAmount: 24_000,
      shares: equalShares(updated.amount, 24_000, members, updated.payerId),
    }
    expect(expenseChanges(updated, repriced)).toEqual(['rate'])
  })

  it('reports a split that moves from equal to exact and the members of an equal split', () => {
    const exact: GroupExpenseState = {
      ...updated,
      split: 'exact',
      shares: exactShares(
        updated.groupAmount,
        [
          { memberId: 'gmb_anna', amount: 7_000 },
          { memberId: 'gmb_max', amount: 5_000 },
        ],
        updated.payerId,
      ),
    }
    expect(expenseChanges(updated, exact)).toEqual(['split'])
    const fewer: GroupExpenseState = {
      ...updated,
      shares: equalShares(updated.amount, updated.groupAmount, ['gmb_anna', 'gmb_max'], updated.payerId),
    }
    expect(expenseChanges(updated, fewer)).toEqual(['split'])
  })

  it('reports exact amounts that moved between the same members', () => {
    const shares = (anna: number, max: number) =>
      exactShares(
        12_000,
        [
          { memberId: 'gmb_anna', amount: anna },
          { memberId: 'gmb_max', amount: max },
        ],
        updated.payerId,
      )
    const before: GroupExpenseState = { ...updated, split: 'exact', shares: shares(7_000, 5_000) }
    expect(expenseChanges(before, { ...before, shares: shares(6_000, 6_000) })).toEqual(['split'])
    expect(expenseChanges(before, { ...before, shares: shares(7_000, 5_000) })).toEqual([])
  })
})

describe('repayment changes', () => {
  it('finds a changed note', () => {
    expect(repaymentChanges(repayment, { ...repayment, note: 'Cash' })).toEqual(['note'])
  })

  it('finds nothing between identical states', () => {
    expect(repaymentChanges(repayment, structuredClone(repayment))).toEqual([])
  })

  it('finds every field in this order', () => {
    const next: GroupRepaymentState = {
      fromMemberId: 'gmb_max',
      toMemberId: 'gmb_olya',
      amount: 500,
      currency: 'PLN',
      date: '2020-01-01',
      rate: 0.25,
      rateManual: true,
      groupAmount: 125,
      note: 'Cash',
    }
    expect(repaymentChanges(repayment, next)).toEqual(['from', 'to', 'amount', 'date', 'rate', 'note'])
  })

  it('counts a changed currency as an amount change and a changed manual flag as a rate change', () => {
    expect(repaymentChanges(repayment, { ...repayment, currency: 'PLN' })).toEqual(['amount'])
    expect(repaymentChanges(repayment, { ...repayment, rateManual: true })).toEqual(['rate'])
  })
})

describe('state kind', () => {
  it('tells an expense state from a repayment state', () => {
    expect(isExpenseState(updated)).toBe(true)
    expect(isExpenseState(repayment)).toBe(false)
  })
})
