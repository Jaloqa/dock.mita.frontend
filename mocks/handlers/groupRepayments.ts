import {
  GROUP_NOTE_MAX,
  GROUP_SETTLES_MAX,
  type GroupCoverDto,
  type GroupEntryAction,
  type GroupRepaymentState,
  type OpenShareDto,
} from '../../app/shared/api/contract'
import { type Currency, isCurrency } from '../../app/shared/money/currencies'
import { todayIso } from '../../app/shared/period/period'
import { allocateCovers, coversOf, openShares, reallocateCovers, replaceCovers } from '../covers'
import type { GroupRepaymentRow, GroupRow, MockDb, MockState } from '../db'
import { checkConverted } from '../debts'
import { badRequest, notFound } from '../errors'
import {
  appendEvent,
  balancesOf,
  type EventActor,
  findScopedGroup,
  GROUP_PAGE,
  type GroupScope,
  historyOf,
  linkedMemberOf,
  membersOf,
  onGroup,
  openGroup,
  openGroupForWrite,
  priceEntry,
  readDeleted,
  repaymentsOf,
  repaymentView,
} from '../groups'
import { newId } from '../ids'
import { paginate } from '../paginate'
import type { MockContext, MockRouter } from '../router'
import { CONTROL } from '../tags'
import { collectErrors, type ErrorCollector, isMissing, objectBody } from '../validation'
import { checkAmount, checkCurrency, checkDate, checkRate } from './debts'

const INVALID = 'validation.invalidValue'
const UNKNOWN_MEMBER = 'validation.unknownMember'
const UNKNOWN_SHARE = 'validation.unknownShare'

type RepaymentInput = {
  fromMemberId: string
  toMemberId: string
  amount: number
  currency: Currency
  date: string
  rate: number | undefined
  note: string | null
  settles: string[]
}

type RepaymentFields = Omit<GroupRepaymentRow, 'id' | 'deleted' | 'groupId' | 'createdAt'>

const memberIdOf = (value: unknown): string | undefined =>
  typeof value === 'string' && !isMissing(value) ? value.trim() : undefined

function checkMember(value: unknown, field: string, errors: ErrorCollector): void {
  if (isMissing(value)) errors.add(field, 'validation.required')
  else if (typeof value !== 'string') errors.add(field, UNKNOWN_MEMBER)
}

function checkNote(value: unknown, errors: ErrorCollector): void {
  if (isMissing(value)) return
  if (typeof value !== 'string' || CONTROL.test(value.trim())) errors.add('note', INVALID)
  else if (value.trim().length > GROUP_NOTE_MAX) errors.add('note', 'validation.noteTooLong')
}

function readSettles(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > GROUP_SETTLES_MAX) return undefined
  const expenseIds: string[] = []
  for (const item of value) {
    const expenseId = memberIdOf(item)
    if (expenseId === undefined || expenseIds.includes(expenseId)) return undefined
    expenseIds.push(expenseId)
  }
  return expenseIds
}

function validateRepayment(body: unknown, today: string): RepaymentInput {
  const { fromMemberId, toMemberId, amount, currency, date, rate, note, settles } = objectBody(body)
  const errors = collectErrors()
  checkMember(fromMemberId, 'fromMemberId', errors)
  checkMember(toMemberId, 'toMemberId', errors)
  const from = memberIdOf(fromMemberId)
  const to = memberIdOf(toMemberId)
  if (from !== undefined && from === to) errors.add('toMemberId', 'validation.sameMember')
  checkAmount(amount, errors)
  checkCurrency(currency, errors)
  checkDate(date, today, errors)
  checkRate(rate, errors)
  checkNote(note, errors)
  const settled = readSettles(settles)
  if (settled === undefined) errors.add('settles', INVALID)
  errors.throwIfAny()
  return {
    fromMemberId: from as string,
    toMemberId: to as string,
    amount: amount as number,
    currency: currency as Currency,
    date: date as string,
    rate: typeof rate === 'number' ? rate : undefined,
    note: isMissing(note) ? null : (note as string).trim(),
    settles: settled ?? [],
  }
}

function prepareRepayment(
  state: MockState,
  group: GroupRow,
  input: RepaymentInput,
  today: string,
  repaymentId?: string,
): { fields: RepaymentFields; covers: GroupCoverDto[] } {
  const memberIds = membersOf(state, group.id).map((member) => member.id)
  const open = openShares(state, group.id, input.fromMemberId, input.toMemberId, repaymentId)
  const errors = collectErrors()
  if (!memberIds.includes(input.fromMemberId)) errors.add('fromMemberId', UNKNOWN_MEMBER)
  if (!memberIds.includes(input.toMemberId)) errors.add('toMemberId', UNKNOWN_MEMBER)
  const ownCovers = repaymentId === undefined ? [] : coversOf(state, repaymentId).map((cover) => cover.expenseId)
  const settles = input.settles.filter(
    (expenseId) => open.some((share) => share.expenseId === expenseId) || !ownCovers.includes(expenseId),
  )
  if (settles.some((expenseId) => !open.some((share) => share.expenseId === expenseId))) {
    errors.add('settles', UNKNOWN_SHARE)
  }
  errors.throwIfAny()
  const price = priceEntry(state.rates, {
    date: input.date,
    today,
    amount: input.amount,
    currency: input.currency,
    groupCurrency: group.currency,
    rate: input.rate,
  })
  checkConverted([price.groupAmount])
  return {
    fields: {
      fromMemberId: input.fromMemberId,
      toMemberId: input.toMemberId,
      amount: input.amount,
      currency: input.currency,
      date: input.date,
      ...price,
      note: input.note,
    },
    covers: allocateCovers(price.groupAmount, open, settles),
  }
}

const repaymentState = (state: MockState, row: GroupRepaymentRow): GroupRepaymentState => ({
  fromMemberId: row.fromMemberId,
  toMemberId: row.toMemberId,
  amount: row.amount,
  currency: row.currency,
  date: row.date,
  rate: row.rate,
  rateManual: row.rateManual,
  groupAmount: row.groupAmount,
  note: row.note,
  covers: coversOf(state, row.id),
})

const groupRepayment = (
  state: MockState,
  group: GroupRow,
  id: string | undefined,
  deleted: boolean,
): GroupRepaymentRow =>
  state.groupRepayments.find((row) => row.id === id && row.groupId === group.id && row.deleted === deleted) ??
  notFound()

function record(
  db: MockDb,
  group: GroupRow,
  row: GroupRepaymentRow,
  action: GroupEntryAction,
  actor: EventActor,
): void {
  appendEvent(db.state, group, 'repayment', row.id, action, repaymentState(db.state, row), actor)
  db.save()
}

function listRepayments({ db, query }: MockContext, scope: GroupScope) {
  const errors = collectErrors()
  const deleted = readDeleted(query.deleted, errors)
  const group = findScopedGroup(db.state, scope)
  const page = paginate(group ? repaymentsOf(db.state, group.id, deleted) : [], query, GROUP_PAGE, errors)
  if (!group) notFound()
  return page
}

function createRepayment({ db, body }: MockContext, scope: GroupScope) {
  const today = todayIso()
  const input = validateRepayment(body, today)
  const { group, actor } = openGroupForWrite(db.state, scope)
  const { fields, covers } = prepareRepayment(db.state, group, input, today)
  const row: GroupRepaymentRow = {
    id: newId('gpay'),
    ...fields,
    deleted: false,
    groupId: group.id,
    createdAt: new Date().toISOString(),
  }
  db.state.groupRepayments.push(row)
  replaceCovers(db.state, row, covers)
  record(db, group, row, 'created', actor)
  return repaymentView(db.state, row)
}

function updateRepayment({ db, params, body }: MockContext, scope: GroupScope) {
  const today = todayIso()
  const input = validateRepayment(body, today)
  const { group, actor } = openGroupForWrite(db.state, scope)
  const row = groupRepayment(db.state, group, params.repaymentId, false)
  const { fields, covers } = prepareRepayment(db.state, group, input, today, row.id)
  Object.assign(row, fields)
  replaceCovers(db.state, row, covers)
  record(db, group, row, 'updated', actor)
  return repaymentView(db.state, row)
}

function deleteRepayment({ db, params }: MockContext, scope: GroupScope) {
  const { group, actor } = openGroupForWrite(db.state, scope)
  const row = groupRepayment(db.state, group, params.repaymentId, false)
  row.deleted = true
  record(db, group, row, 'deleted', actor)
}

function restoreRepayment({ db, params }: MockContext, scope: GroupScope) {
  const { group, actor } = openGroupForWrite(db.state, scope)
  const row = groupRepayment(db.state, group, params.repaymentId, true)
  const covers = reallocateCovers(
    row.groupAmount,
    openShares(db.state, group.id, row.fromMemberId, row.toMemberId, row.id),
    coversOf(db.state, row.id).map((cover) => cover.expenseId),
  )
  row.deleted = false
  replaceCovers(db.state, row, covers)
  record(db, group, row, 'restored', actor)
  return repaymentView(db.state, row)
}

function repaymentHistory({ db, params, query }: MockContext, scope: GroupScope) {
  const group = findScopedGroup(db.state, scope)
  const repayment =
    group && db.state.groupRepayments.find((row) => row.id === params.repaymentId && row.groupId === group.id)
  const page = paginate(
    group && repayment ? historyOf<GroupRepaymentState>(db.state, group, 'repayment', repayment.id) : [],
    query,
    GROUP_PAGE,
  )
  if (!repayment) notFound()
  return page
}

function groupBalances({ db, query }: MockContext, scope: GroupScope) {
  const { currency } = query
  if (currency !== undefined && !isCurrency(currency)) badRequest({ currency: [INVALID] })
  const group = openGroup(db.state, scope)
  return balancesOf(db.state, group, isCurrency(currency) ? currency : group.currency, todayIso())
}

function ownOpenShares({ db, userId, params }: MockContext): OpenShareDto[] {
  const group = openGroup(db.state, { kind: 'user', userId, groupId: params.id })
  const member = linkedMemberOf(db.state, group.id, userId)
  return member ? openShares(db.state, group.id, member.id) : []
}

export function registerGroupRepaymentHandlers(router: MockRouter) {
  onGroup(router, 'GET', '/repayments', listRepayments)
  onGroup(router, 'POST', '/repayments', createRepayment)
  onGroup(router, 'PUT', '/repayments/:repaymentId', updateRepayment)
  onGroup(router, 'DELETE', '/repayments/:repaymentId', deleteRepayment)
  onGroup(router, 'POST', '/repayments/:repaymentId/restore', restoreRepayment)
  onGroup(router, 'GET', '/repayments/:repaymentId/history', repaymentHistory)
  onGroup(router, 'GET', '/balances', groupBalances)
  router.on('GET', '/v1/groups/:id/open-shares', ownOpenShares)
}
