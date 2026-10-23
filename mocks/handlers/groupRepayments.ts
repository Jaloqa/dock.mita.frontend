import { GROUP_NOTE_MAX, type GroupEntryAction, type GroupRepaymentState } from '../../app/shared/api/contract'
import { type Currency, isCurrency } from '../../app/shared/money/currencies'
import { todayIso } from '../../app/shared/period/period'
import type { GroupRepaymentRow, GroupRow, MockDb, MockState } from '../db'
import { checkConverted } from '../debts'
import { badRequest, notFound } from '../errors'
import {
  appendEvent,
  balancesOf,
  findGroup,
  GROUP_PAGE,
  historyOf,
  membersOf,
  ownGroup,
  priceEntry,
  readDeleted,
  repaymentsOf,
  repaymentView,
} from '../groups'
import { newId } from '../ids'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'
import { CONTROL } from '../tags'
import { collectErrors, type ErrorCollector, isMissing, objectBody } from '../validation'
import { checkAmount, checkCurrency, checkDate, checkRate } from './debts'

const INVALID = 'validation.invalidValue'
const UNKNOWN_MEMBER = 'validation.unknownMember'

type RepaymentInput = {
  fromMemberId: string
  toMemberId: string
  amount: number
  currency: Currency
  date: string
  rate: number | undefined
  note: string | null
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

function validateRepayment(body: unknown, today: string): RepaymentInput {
  const { fromMemberId, toMemberId, amount, currency, date, rate, note } = objectBody(body)
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
  errors.throwIfAny()
  return {
    fromMemberId: from as string,
    toMemberId: to as string,
    amount: amount as number,
    currency: currency as Currency,
    date: date as string,
    rate: typeof rate === 'number' ? rate : undefined,
    note: isMissing(note) ? null : (note as string).trim(),
  }
}

function prepareRepayment(state: MockState, group: GroupRow, input: RepaymentInput, today: string): RepaymentFields {
  const memberIds = membersOf(state, group.id).map((member) => member.id)
  const errors = collectErrors()
  if (!memberIds.includes(input.fromMemberId)) errors.add('fromMemberId', UNKNOWN_MEMBER)
  if (!memberIds.includes(input.toMemberId)) errors.add('toMemberId', UNKNOWN_MEMBER)
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
    fromMemberId: input.fromMemberId,
    toMemberId: input.toMemberId,
    amount: input.amount,
    currency: input.currency,
    date: input.date,
    ...price,
    note: input.note,
  }
}

const repaymentState = (row: GroupRepaymentRow): GroupRepaymentState => ({
  fromMemberId: row.fromMemberId,
  toMemberId: row.toMemberId,
  amount: row.amount,
  currency: row.currency,
  date: row.date,
  rate: row.rate,
  rateManual: row.rateManual,
  groupAmount: row.groupAmount,
  note: row.note,
})

const groupRepayment = (
  state: MockState,
  group: GroupRow,
  id: string | undefined,
  deleted: boolean,
): GroupRepaymentRow =>
  state.groupRepayments.find((row) => row.id === id && row.groupId === group.id && row.deleted === deleted) ??
  notFound()

function record(db: MockDb, group: GroupRow, row: GroupRepaymentRow, action: GroupEntryAction, userId: string): void {
  appendEvent(db.state, group, 'repayment', row.id, action, repaymentState(row), userId)
  db.save()
}

export function registerGroupRepaymentHandlers(router: MockRouter) {
  router.on('GET', '/v1/groups/:id/repayments', ({ db, userId, params, query }) => {
    const errors = collectErrors()
    const deleted = readDeleted(query.deleted, errors)
    const group = findGroup(db.state, userId, params.id)
    const page = paginate(group ? repaymentsOf(db.state, group.id, deleted) : [], query, GROUP_PAGE, errors)
    if (!group) notFound()
    return page
  })

  router.on('POST', '/v1/groups/:id/repayments', ({ db, userId, params, body }) => {
    const today = todayIso()
    const input = validateRepayment(body, today)
    const group = ownGroup(db.state, userId, params.id)
    const row: GroupRepaymentRow = {
      id: newId('gpay'),
      ...prepareRepayment(db.state, group, input, today),
      deleted: false,
      groupId: group.id,
      createdAt: new Date().toISOString(),
    }
    db.state.groupRepayments.push(row)
    record(db, group, row, 'created', userId)
    return repaymentView(db.state, row)
  })

  router.on('PUT', '/v1/groups/:id/repayments/:repaymentId', ({ db, userId, params, body }) => {
    const today = todayIso()
    const input = validateRepayment(body, today)
    const group = ownGroup(db.state, userId, params.id)
    const row = groupRepayment(db.state, group, params.repaymentId, false)
    Object.assign(row, prepareRepayment(db.state, group, input, today))
    record(db, group, row, 'updated', userId)
    return repaymentView(db.state, row)
  })

  router.on('DELETE', '/v1/groups/:id/repayments/:repaymentId', ({ db, userId, params }) => {
    const group = ownGroup(db.state, userId, params.id)
    const row = groupRepayment(db.state, group, params.repaymentId, false)
    row.deleted = true
    record(db, group, row, 'deleted', userId)
  })

  router.on('POST', '/v1/groups/:id/repayments/:repaymentId/restore', ({ db, userId, params }) => {
    const group = ownGroup(db.state, userId, params.id)
    const row = groupRepayment(db.state, group, params.repaymentId, true)
    row.deleted = false
    record(db, group, row, 'restored', userId)
    return repaymentView(db.state, row)
  })

  router.on('GET', '/v1/groups/:id/repayments/:repaymentId/history', ({ db, userId, params, query }) => {
    const group = findGroup(db.state, userId, params.id)
    const repayment =
      group && db.state.groupRepayments.find((row) => row.id === params.repaymentId && row.groupId === group.id)
    const page = paginate(
      group && repayment ? historyOf<GroupRepaymentState>(db.state, group, 'repayment', repayment.id) : [],
      query,
      GROUP_PAGE,
    )
    if (!repayment) notFound()
    return page
  })

  router.on('GET', '/v1/groups/:id/balances', ({ db, userId, params, query }) => {
    const { currency } = query
    if (currency !== undefined && !isCurrency(currency)) badRequest({ currency: [INVALID] })
    const group = ownGroup(db.state, userId, params.id)
    return balancesOf(db.state, group, isCurrency(currency) ? currency : group.currency, todayIso())
  })
}
