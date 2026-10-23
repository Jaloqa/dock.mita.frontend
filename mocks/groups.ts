import {
  GROUP_MEMBER_HEADER,
  type GroupActorDto,
  type GroupBalancesDto,
  type GroupDto,
  type GroupEntryAction,
  type GroupEntryEvent,
  type GroupExpenseDto,
  type GroupExpenseState,
  type GroupMemberDto,
  type GroupRepaymentDto,
  type GroupRepaymentState,
  type GroupRole,
  type GroupShareDto,
  type GroupSummaryDto,
  type GroupTransferDto,
  type StandardGroupCategory,
  standardGroupCategories,
} from '../app/shared/api/contract'
import type { HttpMethod } from '../app/shared/api/transport'
import { allocateMinor, type Currency, convertMinor, roundRate, sumMinor } from '../app/shared/money/money'
import type {
  GroupEventRow,
  GroupExpenseRow,
  GroupMemberRow,
  GroupRepaymentRow,
  GroupRow,
  MockState,
  RateRow,
} from './db'
import { forbidden, notFound, ratesUnavailable } from './errors'
import { newId } from './ids'
import { freshRateOn, rateOn } from './rates'
import type { MockContext, MockRouter } from './router'
import type { ErrorCollector } from './validation'

export const GROUP_PAGE = { defaultPageSize: 100, maxPageSize: 100 }

const SHARE_TOKEN_BYTES = 32

export type GroupScope =
  | { kind: 'user'; userId: string; groupId: string | undefined }
  | { kind: 'link'; token: string | undefined; member: string | undefined }

type GroupViewer = { role: GroupRole; myMemberId: string | null }

type MemberFigures = {
  memberId: string
  paid: number
  share: number
  sent: number
  received: number
  balance: number
}

export type EventActor = Pick<GroupEventRow, 'actorUserId' | 'actorMemberId'>

type GroupHandler = (context: MockContext, scope: GroupScope) => unknown

export type EntryPriceInput = {
  date: string
  today: string
  amount: number
  currency: Currency
  groupCurrency: Currency
  rate?: number
}

type ExactShare = { memberId: string; amount: number }

type OpenBalance = { memberId: string; balance: number }

export const isStandardCategory = (value: string): value is StandardGroupCategory =>
  standardGroupCategories.includes(value as StandardGroupCategory)

export const linkedMemberOf = (state: MockState, groupId: string, userId: string): GroupMemberRow | undefined =>
  state.groupMembers.find((row) => row.groupId === groupId && row.userId === userId)

const opensFor = (state: MockState, row: GroupRow, userId: string): boolean =>
  row.userId === userId || linkedMemberOf(state, row.id, userId) !== undefined

const findGroup = (state: MockState, userId: string, id: string | undefined): GroupRow | undefined =>
  state.groups.find((row) => row.id === id && opensFor(state, row, userId))

export const ownGroup = (state: MockState, userId: string, id: string | undefined): GroupRow =>
  state.groups.find((row) => row.id === id && row.userId === userId) ?? notFound()

export const newShareToken = (): string =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(SHARE_TOKEN_BYTES))))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')

export const findScopedGroup = (state: MockState, scope: GroupScope): GroupRow | undefined =>
  scope.kind === 'user'
    ? findGroup(state, scope.userId, scope.groupId)
    : state.groups.find((row) => row.shareToken === scope.token)

export const openGroup = (state: MockState, scope: GroupScope): GroupRow => findScopedGroup(state, scope) ?? notFound()

export function openGroupForWrite(state: MockState, scope: GroupScope): { group: GroupRow; actor: EventActor } {
  const group = openGroup(state, scope)
  if (scope.kind === 'user') {
    if (group.userId === scope.userId) return { group, actor: { actorUserId: scope.userId, actorMemberId: null } }
    const linked = linkedMemberOf(state, group.id, scope.userId) ?? notFound()
    return { group, actor: { actorUserId: null, actorMemberId: linked.id } }
  }
  const member =
    state.groupMembers.find((row) => row.id === scope.member && row.groupId === group.id) ??
    forbidden('group.memberRequired')
  return { group, actor: { actorUserId: null, actorMemberId: member.id } }
}

const userScope = ({ userId, params }: MockContext): GroupScope => ({
  kind: 'user',
  userId,
  groupId: params.id,
})

// The token is checked before the body, as on the backend, so a bad token answers 404 whatever the request holds.
function linkScope({ db, params, headers }: MockContext): GroupScope {
  const scope: GroupScope = { kind: 'link', token: params.token, member: headers[GROUP_MEMBER_HEADER.toLowerCase()] }
  openGroup(db.state, scope)
  return scope
}

export function onLinkGroup(router: MockRouter, method: HttpMethod, suffix: string, handler: GroupHandler): void {
  router.on(method, `/v1/shared/groups/:token${suffix}`, (context) => handler(context, linkScope(context)))
}

export function onGroup(router: MockRouter, method: HttpMethod, suffix: string, handler: GroupHandler): void {
  router.on(method, `/v1/groups/:id${suffix}`, (context) => handler(context, userScope(context)))
  onLinkGroup(router, method, suffix, handler)
}

export const membersOf = (state: MockState, groupId: string): GroupMemberRow[] =>
  state.groupMembers.filter((row) => row.groupId === groupId).sort((a, b) => a.position - b.position)

export const memberOf = (state: MockState, group: GroupRow, memberId: string | undefined): GroupMemberRow =>
  state.groupMembers.find((row) => row.id === memberId && row.groupId === group.id) ?? notFound()

export const hasEntries = (state: MockState, groupId: string): boolean =>
  state.groupExpenses.some((row) => row.groupId === groupId) ||
  state.groupRepayments.some((row) => row.groupId === groupId)

const liveTotal = (state: MockState, groupId: string): number =>
  sumMinor(state.groupExpenses.filter((row) => row.groupId === groupId && !row.deleted).map((row) => row.groupAmount))

const stateNames = (entryState: GroupEventRow['state'], memberId: string): boolean =>
  'payerId' in entryState
    ? entryState.payerId === memberId || entryState.shares.some((share) => share.memberId === memberId)
    : entryState.fromMemberId === memberId || entryState.toMemberId === memberId

export const memberInUse = (state: MockState, memberId: string): boolean =>
  state.groupEvents.some((row) => row.actorMemberId === memberId || stateNames(row.state, memberId))

export function viewerOf(state: MockState, scope: GroupScope, group: GroupRow): GroupViewer {
  if (scope.kind === 'link') return { role: 'link', myMemberId: null }
  return {
    role: group.userId === scope.userId ? 'owner' : 'member',
    myMemberId: linkedMemberOf(state, group.id, scope.userId)?.id ?? null,
  }
}

export const ownerViewer = (state: MockState, group: GroupRow): GroupViewer => ({
  role: 'owner',
  myMemberId: linkedMemberOf(state, group.id, group.userId)?.id ?? null,
})

export function memberView(state: MockState, member: GroupMemberRow, forOwner: boolean): GroupMemberDto {
  return {
    id: member.id,
    name: member.name,
    inUse: memberInUse(state, member.id),
    linked: member.userId !== null,
    linkedName: forOwner ? (state.users.find((user) => user.id === member.userId)?.name ?? null) : null,
    invitedEmail: forOwner ? member.invitedEmail : null,
  }
}

export function groupView(state: MockState, row: GroupRow, viewer: GroupViewer): GroupDto {
  const forOwner = viewer.role === 'owner'
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    currencyLocked: hasEntries(state, row.id),
    total: liveTotal(state, row.id),
    members: membersOf(state, row.id).map((member) => memberView(state, member, forOwner)),
    categories: [
      ...standardGroupCategories.map((key) => ({ id: key, standard: true, name: null })),
      ...state.groupCategories
        .filter((category) => category.groupId === row.id)
        .map((category) => ({ id: category.id, standard: false, name: category.name })),
    ],
    shareToken: forOwner ? row.shareToken : null,
    role: viewer.role,
    myMemberId: viewer.myMemberId,
  }
}

export const groupSummary = (state: MockState, row: GroupRow, userId: string): GroupSummaryDto => ({
  id: row.id,
  name: row.name,
  currency: row.currency,
  members: membersOf(state, row.id).length,
  total: liveTotal(state, row.id),
  role: row.userId === userId ? 'owner' : 'member',
})

const groupsOf = (state: MockState, userId: string): GroupRow[] =>
  state.groups
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => opensFor(state, row, userId))
    .sort((a, b) => b.row.createdAt.localeCompare(a.row.createdAt) || b.index - a.index)
    .map(({ row }) => row)

export const groupSummaries = (state: MockState, userId: string): GroupSummaryDto[] =>
  groupsOf(state, userId).map((row) => groupSummary(state, row, userId))

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

const groupOf = (state: MockState, groupId: string): GroupRow =>
  state.groups.find((candidate) => candidate.id === groupId) ?? notFound()

function entryAudit(state: MockState, group: GroupRow, kind: GroupEventRow['kind'], entryId: string) {
  const [created, ...changes] = entryEvents(state, kind, entryId)
  if (!created) throw new Error('Every entry has a creation event.')
  const updated = changes.at(-1)
  return {
    createdBy: actorView(state, group, created),
    createdAt: created.at,
    updatedBy: updated ? actorView(state, group, updated) : null,
    updatedAt: updated?.at ?? null,
  }
}

export function expenseView(state: MockState, row: GroupExpenseRow): GroupExpenseDto {
  const { groupId, createdAt: _createdAt, ...expense } = row
  return { ...expense, ...entryAudit(state, groupOf(state, groupId), 'expense', row.id) }
}

export function repaymentView(state: MockState, row: GroupRepaymentRow): GroupRepaymentDto {
  const { groupId, createdAt: _createdAt, ...repayment } = row
  return { ...repayment, ...entryAudit(state, groupOf(state, groupId), 'repayment', row.id) }
}

export function expensesOf(state: MockState, groupId: string, deleted: boolean): GroupExpenseDto[] {
  return state.groupExpenses
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.groupId === groupId && row.deleted === deleted)
    .sort((a, b) => b.row.date.localeCompare(a.row.date) || b.index - a.index)
    .map(({ row }) => expenseView(state, row))
}

export function repaymentsOf(state: MockState, groupId: string, deleted: boolean): GroupRepaymentDto[] {
  return state.groupRepayments
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.groupId === groupId && row.deleted === deleted)
    .sort((a, b) => b.row.date.localeCompare(a.row.date) || b.index - a.index)
    .map(({ row }) => repaymentView(state, row))
}

export function historyOf<T extends GroupExpenseState | GroupRepaymentState>(
  state: MockState,
  group: GroupRow,
  kind: GroupEventRow['kind'],
  entryId: string,
): GroupEntryEvent<T>[] {
  return entryEvents(state, kind, entryId)
    .reverse()
    .map((event) => ({
      id: event.id,
      action: event.action,
      at: event.at,
      actor: actorView(state, group, event),
      state: event.state as T,
    }))
}

export function readDeleted(value: string | undefined, errors: ErrorCollector): boolean {
  if (value === undefined || value === 'false') return false
  if (value !== 'true') errors.add('deleted', 'validation.invalidValue')
  return value === 'true'
}

const largest = (open: readonly OpenBalance[], sign: 1 | -1): OpenBalance | undefined =>
  open.reduce<OpenBalance | undefined>(
    (found, row) => (row.balance * sign > 0 && (!found || row.balance * sign > found.balance * sign) ? row : found),
    undefined,
  )

export function settle(balances: readonly OpenBalance[]): GroupTransferDto[] {
  if (sumMinor(balances.map((row) => row.balance)) !== 0) throw new Error('The balances must sum to zero.')
  const open = balances.map(({ memberId, balance }) => ({ memberId, balance }))
  const transfers: GroupTransferDto[] = []
  for (const debtor of open) {
    const owed = -debtor.balance
    const creditor = owed > 0 ? open.find((row) => row.balance === owed) : undefined
    if (!creditor) continue
    transfers.push({ fromMemberId: debtor.memberId, toMemberId: creditor.memberId, amount: owed })
    debtor.balance = 0
    creditor.balance = 0
  }
  let debtor = largest(open, -1)
  let creditor = largest(open, 1)
  while (debtor && creditor) {
    const amount = Math.min(-debtor.balance, creditor.balance)
    transfers.push({ fromMemberId: debtor.memberId, toMemberId: creditor.memberId, amount })
    debtor.balance += amount
    creditor.balance -= amount
    debtor = largest(open, -1)
    creditor = largest(open, 1)
  }
  return transfers
}

function memberFigures(state: MockState, group: GroupRow): MemberFigures[] {
  const expenses = state.groupExpenses.filter((row) => row.groupId === group.id && !row.deleted)
  const repayments = state.groupRepayments.filter((row) => row.groupId === group.id && !row.deleted)
  return membersOf(state, group.id).map(({ id: memberId }) => {
    const paid = sumMinor(expenses.filter((row) => row.payerId === memberId).map((row) => row.groupAmount))
    const share = sumMinor(
      expenses
        .flatMap((row) => row.shares)
        .filter((row) => row.memberId === memberId)
        .map((row) => row.groupAmount),
    )
    const sent = sumMinor(repayments.filter((row) => row.fromMemberId === memberId).map((row) => row.groupAmount))
    const received = sumMinor(repayments.filter((row) => row.toMemberId === memberId).map((row) => row.groupAmount))
    return { memberId, paid, share, sent, received, balance: paid - share + sent - received }
  })
}

export function linkedBalances(state: MockState, userId: string): { group: GroupRow; balance: number }[] {
  return groupsOf(state, userId).flatMap((group) => {
    const member = linkedMemberOf(state, group.id, userId)
    if (!member) return []
    const figures = memberFigures(state, group).find((row) => row.memberId === member.id)
    return [{ group, balance: figures?.balance ?? 0 }]
  })
}

export function balancesOf(state: MockState, group: GroupRow, viewCurrency: Currency, today: string): GroupBalancesDto {
  const rate = rateOn(state.rates, today, group.currency, viewCurrency)
  const members = memberFigures(state, group)
  const inView = (amount: number): number => convertMinor(amount, rate, group.currency, viewCurrency)
  return {
    currency: viewCurrency,
    groupCurrency: group.currency,
    total: inView(sumMinor(members.map((member) => member.paid))),
    members: members.map(({ memberId, paid, share, sent, received, balance }) => ({
      memberId,
      paid: inView(paid),
      share: inView(share),
      sent: inView(sent),
      received: inView(received),
      balance: inView(balance),
    })),
    transfers: settle(members).map((transfer) => ({ ...transfer, amount: inView(transfer.amount) })),
  }
}

export function appendEvent(
  state: MockState,
  group: GroupRow,
  kind: GroupEventRow['kind'],
  entryId: string,
  action: GroupEntryAction,
  entryState: GroupEventRow['state'],
  actor: EventActor,
): void {
  state.groupEvents.push({
    id: newId('gevt'),
    groupId: group.id,
    kind,
    entryId,
    action,
    at: new Date().toISOString(),
    ...actor,
    state: entryState,
  })
}
