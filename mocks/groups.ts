import {
  type GroupActorDto,
  type GroupDto,
  type GroupEntryAction,
  type GroupExpenseDto,
  type GroupShareDto,
  type GroupSummaryDto,
  type StandardGroupCategory,
  standardGroupCategories,
} from '../app/shared/api/contract'
import { allocateMinor, type Currency, convertMinor, roundRate, sumMinor } from '../app/shared/money/money'
import type { GroupEventRow, GroupExpenseRow, GroupMemberRow, GroupRow, MockState, RateRow } from './db'
import { notFound, ratesUnavailable } from './errors'
import { newId } from './ids'
import { freshRateOn } from './rates'

export type EntryPriceInput = {
  date: string
  today: string
  amount: number
  currency: Currency
  groupCurrency: Currency
  rate?: number
}

type ExactShare = { memberId: string; amount: number }

export const isStandardCategory = (value: string): value is StandardGroupCategory =>
  standardGroupCategories.includes(value as StandardGroupCategory)

export const findGroup = (state: MockState, userId: string, id: string | undefined): GroupRow | undefined =>
  state.groups.find((row) => row.id === id && row.userId === userId)

export const ownGroup = (state: MockState, userId: string, id: string | undefined): GroupRow =>
  findGroup(state, userId, id) ?? notFound()

export const membersOf = (state: MockState, groupId: string): GroupMemberRow[] =>
  state.groupMembers.filter((row) => row.groupId === groupId).sort((a, b) => a.position - b.position)

export const hasEntries = (state: MockState, groupId: string): boolean =>
  state.groupExpenses.some((row) => row.groupId === groupId) ||
  state.groupRepayments.some((row) => row.groupId === groupId)

const liveTotal = (state: MockState, groupId: string): number =>
  sumMinor(state.groupExpenses.filter((row) => row.groupId === groupId && !row.deleted).map((row) => row.groupAmount))

export const memberInUse = (state: MockState, memberId: string): boolean =>
  state.groupExpenses.some(
    (row) => row.payerId === memberId || row.shares.some((share) => share.memberId === memberId),
  ) ||
  state.groupRepayments.some((row) => row.fromMemberId === memberId || row.toMemberId === memberId) ||
  state.groupEvents.some((row) => row.actorMemberId === memberId)

export function groupView(state: MockState, row: GroupRow): GroupDto {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    currencyLocked: hasEntries(state, row.id),
    total: liveTotal(state, row.id),
    members: membersOf(state, row.id).map((member) => ({
      id: member.id,
      name: member.name,
      inUse: memberInUse(state, member.id),
    })),
    categories: [
      ...standardGroupCategories.map((key) => ({ id: key, standard: true, name: null })),
      ...state.groupCategories
        .filter((category) => category.groupId === row.id)
        .map((category) => ({ id: category.id, standard: false, name: category.name })),
    ],
  }
}

export function groupSummaries(state: MockState, userId: string): GroupSummaryDto[] {
  return state.groups
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.userId === userId)
    .sort((a, b) => b.row.createdAt.localeCompare(a.row.createdAt) || b.index - a.index)
    .map(({ row }) => ({
      id: row.id,
      name: row.name,
      currency: row.currency,
      members: membersOf(state, row.id).length,
      total: liveTotal(state, row.id),
    }))
}

export function priceEntry(
  rates: readonly RateRow[],
  input: EntryPriceInput,
): { rate: number; rateManual: boolean; groupAmount: number } {
  const { amount, currency, groupCurrency } = input
  if (currency === groupCurrency) return { rate: 1, rateManual: false, groupAmount: amount }
  const rate =
    input.rate !== undefined
      ? roundRate(input.rate)
      : (freshRateOn(rates, input.date, input.today, currency, groupCurrency) ?? ratesUnavailable())
  return {
    rate,
    rateManual: input.rate !== undefined,
    groupAmount: convertMinor(amount, rate, currency, groupCurrency),
  }
}

const payerFirst = (memberIds: readonly string[], payerId: string): number[] => {
  const payer = memberIds.indexOf(payerId)
  const others = memberIds.map((_, index) => index).filter((index) => index !== payer)
  return payer < 0 ? others : [payer, ...others]
}

export function exactShares(groupAmount: number, shares: readonly ExactShare[], payerId: string): GroupShareDto[] {
  const groupAmounts = allocateMinor(
    groupAmount,
    shares.map((share) => share.amount),
    payerFirst(
      shares.map((share) => share.memberId),
      payerId,
    ),
  )
  return shares.map((share, index) => ({ ...share, groupAmount: groupAmounts[index] ?? 0 }))
}

export function equalShares(
  amount: number,
  groupAmount: number,
  memberIds: readonly string[],
  payerId: string,
): GroupShareDto[] {
  const amounts = allocateMinor(
    amount,
    memberIds.map(() => 1),
    payerFirst(memberIds, payerId),
  )
  const sharing = memberIds.flatMap((memberId, index) => {
    const share = amounts[index] ?? 0
    return share > 0 ? [{ memberId, amount: share }] : []
  })
  return exactShares(groupAmount, sharing, payerId)
}

export function actorView(state: MockState, group: GroupRow, event: GroupEventRow): GroupActorDto {
  const { actorMemberId } = event
  if (actorMemberId !== null) {
    const member = state.groupMembers.find((row) => row.id === actorMemberId)
    return { kind: 'member', memberId: actorMemberId, name: member?.name ?? '' }
  }
  return { kind: 'owner', memberId: null, name: state.users.find((user) => user.id === group.userId)?.name ?? '' }
}

export const entryEvents = (state: MockState, kind: GroupEventRow['kind'], entryId: string): GroupEventRow[] =>
  state.groupEvents.filter((row) => row.kind === kind && row.entryId === entryId)

export function expenseView(state: MockState, row: GroupExpenseRow): GroupExpenseDto {
  const group = state.groups.find((candidate) => candidate.id === row.groupId) ?? notFound()
  const [created, ...changes] = entryEvents(state, 'expense', row.id)
  if (!created) throw new Error('Every expense has a creation event.')
  const updated = changes.at(-1)
  const { groupId: _groupId, createdAt: _createdAt, ...expense } = row
  return {
    ...expense,
    createdBy: actorView(state, group, created),
    createdAt: created.at,
    updatedBy: updated ? actorView(state, group, updated) : null,
    updatedAt: updated?.at ?? null,
  }
}

export function expensesOf(state: MockState, groupId: string, deleted: boolean): GroupExpenseDto[] {
  return state.groupExpenses
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.groupId === groupId && row.deleted === deleted)
    .sort((a, b) => b.row.date.localeCompare(a.row.date) || b.index - a.index)
    .map(({ row }) => expenseView(state, row))
}

export function appendEvent(
  state: MockState,
  group: GroupRow,
  kind: GroupEventRow['kind'],
  entryId: string,
  action: GroupEntryAction,
  entryState: GroupEventRow['state'],
  actorUserId: string,
): void {
  state.groupEvents.push({
    id: newId('gevt'),
    groupId: group.id,
    kind,
    entryId,
    action,
    at: new Date().toISOString(),
    actorUserId,
    actorMemberId: null,
    state: entryState,
  })
}
