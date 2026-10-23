import { describe, expect, it } from 'bun:test'
import {
  actorName,
  categoryLabel,
  entryAccess,
  memberName,
  splitSummary,
} from '../../../../app/features/groups/utils/groupView'
import { type GroupDto, type GroupExpenseDto, standardGroupCategories } from '../../../../app/shared/api/contract'
import { todayIso } from '../../../../app/shared/period/period'
import { demoGroups } from '../../../../mocks/seed/groups'

const t = (key: string, named?: Record<string, unknown>) =>
  named ? `${key}(${Object.values(named).map(String).join(';')})` : key

const seeded = demoGroups(todayIso())

const group: GroupDto = {
  id: 'grp_albania',
  name: 'Albania 2026',
  currency: 'EUR',
  currencyLocked: true,
  total: 19_070,
  members: seeded.groupMembers.map((member) => ({ id: member.id, name: member.name, inUse: true })),
  categories: [
    ...standardGroupCategories.map((key) => ({ id: key, standard: true, name: null })),
    { id: 'gcat_beach', standard: false, name: 'Beach' },
  ],
}

const expense = (id: string): Pick<GroupExpenseDto, 'split' | 'shares'> => {
  const row = seeded.groupExpenses.find((candidate) => candidate.id === id)
  if (!row) throw new Error(`No seeded expense ${id}`)
  return row
}

describe('group view', () => {
  it('names a member by id', () => {
    expect(memberName(group, 'gmb_olya')).toBe('Olya')
    expect(memberName(group, 'gmb_unknown')).toBe('')
  })

  it('translates the standard categories and shows the group categories by name', () => {
    expect(categoryLabel(t, group, 'groceries')).toBe('groups.categories.groceries')
    expect(categoryLabel(t, group, 'other')).toBe('groups.categories.other')
    expect(categoryLabel(t, group, 'gcat_beach')).toBe('Beach')
  })

  it('falls back to Other for a category the group does not list', () => {
    expect(categoryLabel(t, group, 'gcat_unknown')).toBe('groups.categories.other')
  })

  it('names the actor of a change', () => {
    expect(actorName({ kind: 'owner', memberId: null, name: 'Anna Nowak' })).toBe('Anna Nowak')
    expect(actorName({ kind: 'member', memberId: 'gmb_olya', name: 'Olya' })).toBe('Olya')
  })

  it('summarises the splits of the seeded expenses', () => {
    expect(splitSummary(t, group, expense('gex_dinner'))).toBe('groups.expense.summary.everyone')
    expect(splitSummary(t, group, expense('gex_groceries'))).toBe('groups.expense.summary.everyone')
    expect(splitSummary(t, group, expense('gex_boat'))).toBe('groups.expense.summary.some(Anna, Max)')
    expect(splitSummary(t, group, expense('gex_taxi'))).toBe('groups.expense.summary.everyone')
  })

  it('names the sharing members in member order', () => {
    const shares = [
      { memberId: 'gmb_kasia', amount: 500, groupAmount: 500 },
      { memberId: 'gmb_olya', amount: 500, groupAmount: 500 },
    ]
    expect(splitSummary(t, group, { split: 'equal', shares })).toBe('groups.expense.summary.some(Olya, Kasia)')
  })

  it('no longer says everyone once a member joined after the expense', () => {
    const grown: GroupDto = { ...group, members: [...group.members, { id: 'gmb_tomek', name: 'Tomek', inUse: false }] }
    expect(splitSummary(t, grown, expense('gex_dinner'))).toBe('groups.expense.summary.some(Anna, Olya, Max, Kasia)')
  })

  it('says exact amounts for an exact split', () => {
    const shares = [
      { memberId: 'gmb_olya', amount: 5_000, groupAmount: 1_250 },
      { memberId: 'gmb_max', amount: 15_000, groupAmount: 3_750 },
    ]
    expect(splitSummary(t, group, { split: 'exact', shares })).toBe('groups.expense.summary.exact')
  })

  it('lets entries be added once the group has a member and repayments once it has two', () => {
    const withMembers = (count: number) => ({ members: group.members.slice(0, count) })
    expect(entryAccess(withMembers(0))).toEqual({ canAddExpense: false, canRecordRepayment: false, hint: 'noMembers' })
    expect(entryAccess(withMembers(1))).toEqual({ canAddExpense: true, canRecordRepayment: false, hint: 'oneMember' })
    expect(entryAccess(withMembers(2))).toEqual({ canAddExpense: true, canRecordRepayment: true, hint: undefined })
    expect(entryAccess(group)).toEqual({ canAddExpense: true, canRecordRepayment: true, hint: undefined })
  })
})
