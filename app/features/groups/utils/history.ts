import type { GroupExpenseState, GroupRepaymentState } from '../../../shared/api/contract'

export type ExpenseField = 'payer' | 'amount' | 'date' | 'category' | 'tags' | 'description' | 'rate' | 'split'

export type RepaymentField = 'from' | 'to' | 'amount' | 'date' | 'rate' | 'note'

type Change<Field extends string> = readonly [Field, boolean]

const sameList = <T>(first: readonly T[], second: readonly T[]): boolean =>
  first.length === second.length && first.every((value, index) => value === second[index])

function sameSplit(previous: GroupExpenseState, current: GroupExpenseState): boolean {
  if (previous.split !== current.split) return false
  const members = (state: GroupExpenseState) => state.shares.map((share) => share.memberId)
  if (!sameList(members(previous), members(current))) return false
  if (current.split === 'equal') return true
  return previous.shares.every((share, index) => share.amount === current.shares[index]?.amount)
}

const changed = <Field extends string>(changes: readonly Change<Field>[]): Field[] =>
  changes.flatMap(([field, differs]) => (differs ? [field] : []))

export const isExpenseState = (state: GroupExpenseState | GroupRepaymentState): state is GroupExpenseState =>
  'payerId' in state

export function expenseChanges(previous: GroupExpenseState, current: GroupExpenseState): ExpenseField[] {
  return changed<ExpenseField>([
    ['payer', previous.payerId !== current.payerId],
    ['amount', previous.amount !== current.amount || previous.currency !== current.currency],
    ['date', previous.date !== current.date],
    ['category', previous.categoryId !== current.categoryId],
    ['tags', !sameList(previous.tags, current.tags)],
    ['description', previous.description !== current.description],
    ['rate', previous.rate !== current.rate || previous.rateManual !== current.rateManual],
    ['split', !sameSplit(previous, current)],
  ])
}

export function repaymentChanges(previous: GroupRepaymentState, current: GroupRepaymentState): RepaymentField[] {
  return changed<RepaymentField>([
    ['from', previous.fromMemberId !== current.fromMemberId],
    ['to', previous.toMemberId !== current.toMemberId],
    ['amount', previous.amount !== current.amount || previous.currency !== current.currency],
    ['date', previous.date !== current.date],
    ['rate', previous.rate !== current.rate || previous.rateManual !== current.rateManual],
    ['note', previous.note !== current.note],
  ])
}
