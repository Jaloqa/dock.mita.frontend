import {
  EXPENSE_DESCRIPTION_MAX,
  GROUP_MEMBERS_MAX,
  type GroupEntryAction,
  type GroupExpenseState,
  type GroupShareDto,
  type GroupSplitMode,
  groupSplitModes,
} from '../../app/shared/api/contract'
import { AMOUNT_MINOR_MAX, type Currency } from '../../app/shared/money/currencies'
import { sumMinor } from '../../app/shared/money/money'
import { todayIso } from '../../app/shared/period/period'
import type { GroupExpenseRow, GroupRow, MockDb, MockState } from '../db'
import { checkConverted } from '../debts'
import { notFound } from '../errors'
import {
  appendEvent,
  equalShares,
  exactShares,
  expensesOf,
  expenseView,
  findGroup,
  GROUP_PAGE,
  historyOf,
  isStandardCategory,
  membersOf,
  ownGroup,
  priceEntry,
  readDeleted,
} from '../groups'
import { newId } from '../ids'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'
import { CONTROL, parseTags, tagsError } from '../tags'
import { collectErrors, type ErrorCollector, isMissing, objectBody } from '../validation'
import { checkAmount, checkCurrency, checkDate, checkRate } from './debts'

const INVALID = 'validation.invalidValue'
const UNKNOWN_MEMBER = 'validation.unknownMember'
const UNKNOWN_CATEGORY = 'validation.unknownCategory'

type SplitInput = { mode: GroupSplitMode; memberIds: string[]; amounts: number[] }

type ExpenseInput = {
  payerId: string
  amount: number
  currency: Currency
  date: string
  categoryId: string
  tags: string[]
  description: string | null
  rate: number | undefined
  split: SplitInput | undefined
}

type ExpenseFields = Omit<GroupExpenseRow, 'id' | 'deleted' | 'groupId' | 'createdAt'>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPositiveMinor = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= AMOUNT_MINOR_MAX

const itemsOf = (split: Record<string, unknown>, field: string): unknown[] | undefined => {
  const items = split[field]
  return Array.isArray(items) && items.length > 0 && items.length <= GROUP_MEMBERS_MAX ? items : undefined
}

function memberIdsError(values: readonly unknown[]): string | undefined {
  const seen = new Set<string>()
  let repeated = false
  let unknown = false
  for (const value of values) {
    if (typeof value !== 'string') unknown = true
    if (value === undefined || value === null) continue
    const key = typeof value === 'string' ? `string:${value.trim()}` : `${typeof value}:${JSON.stringify(value)}`
    repeated ||= seen.has(key)
    seen.add(key)
  }
  return repeated ? INVALID : unknown ? UNKNOWN_MEMBER : undefined
}

const trimmedIds = (values: readonly unknown[]): string[] => (values as string[]).map((value) => value.trim())

function readSplit(value: unknown): SplitInput | string | undefined {
  if (value === undefined || value === null) return undefined
  if (!isRecord(value) || !groupSplitModes.includes(value.mode as GroupSplitMode)) return INVALID
  if (value.mode === 'equal') {
    const memberIds = itemsOf(value, 'memberIds')
    if (!memberIds) return INVALID
    return memberIdsError(memberIds) ?? { mode: 'equal', memberIds: trimmedIds(memberIds), amounts: [] }
  }
  const shares = itemsOf(value, 'shares')
  if (!shares?.every((share) => isRecord(share) && isPositiveMinor(share.amount))) return INVALID
  const records = shares as Record<string, unknown>[]
  const memberIds = records.map((share) => share.memberId)
  return (
    memberIdsError(memberIds) ?? {
      mode: 'exact',
      memberIds: trimmedIds(memberIds),
      amounts: records.map((share) => share.amount as number),
    }
  )
}

function checkDescription(value: unknown, errors: ErrorCollector): void {
  if (isMissing(value)) return
  if (typeof value !== 'string' || CONTROL.test(value.trim())) errors.add('description', INVALID)
  else if (value.trim().length > EXPENSE_DESCRIPTION_MAX) errors.add('description', 'validation.titleTooLong')
}

function validateExpense(body: unknown, today: string): ExpenseInput {
  const { payerId, amount, currency, date, categoryId, tags, description, rate, split } = objectBody(body)
  const errors = collectErrors()
  if (isMissing(payerId)) errors.add('payerId', 'validation.required')
  else if (typeof payerId !== 'string') errors.add('payerId', UNKNOWN_MEMBER)
  checkAmount(amount, errors)
  checkCurrency(currency, errors)
  checkDate(date, today, errors)
  if (!isMissing(categoryId) && typeof categoryId !== 'string') errors.add('categoryId', UNKNOWN_CATEGORY)
  const tagsProblem = tagsError(tags)
  if (tagsProblem !== undefined) errors.add('tags', tagsProblem)
  checkDescription(description, errors)
  checkRate(rate, errors)
  const reading = readSplit(split)
  if (typeof reading === 'string') errors.add('split', reading)
  else if (reading?.mode === 'exact' && isPositiveMinor(amount) && sumMinor(reading.amounts) !== amount) {
    errors.add('split', 'validation.splitMismatch')
  }
  errors.throwIfAny()
  return {
    payerId: (payerId as string).trim(),
    amount: amount as number,
    currency: currency as Currency,
    date: date as string,
    categoryId: isMissing(categoryId) ? 'other' : (categoryId as string),
    tags: parseTags(tags),
    description: isMissing(description) ? null : (description as string).trim(),
    rate: typeof rate === 'number' ? rate : undefined,
    split: typeof reading === 'string' ? undefined : reading,
  }
}

function sharesFor(memberIds: readonly string[], input: ExpenseInput, groupAmount: number): GroupShareDto[] {
  const { split, amount, payerId } = input
  if (split?.mode === 'exact') {
    const shares = memberIds.flatMap((memberId) => {
      const index = split.memberIds.indexOf(memberId)
      return index < 0 ? [] : [{ memberId, amount: split.amounts[index] ?? 0 }]
    })
    return exactShares(groupAmount, shares, payerId)
  }
  const sharing = split ? memberIds.filter((memberId) => split.memberIds.includes(memberId)) : memberIds
  return equalShares(amount, groupAmount, sharing, payerId)
}

function prepareExpense(state: MockState, group: GroupRow, input: ExpenseInput, today: string): ExpenseFields {
  const memberIds = membersOf(state, group.id).map((member) => member.id)
  const categoryId = isStandardCategory(input.categoryId)
    ? input.categoryId
    : state.groupCategories.find((row) => row.groupId === group.id && row.id === input.categoryId.trim())?.id
  const errors = collectErrors()
  if (!memberIds.includes(input.payerId)) errors.add('payerId', UNKNOWN_MEMBER)
  if (categoryId === undefined) errors.add('categoryId', UNKNOWN_CATEGORY)
  if (input.split && !input.split.memberIds.every((memberId) => memberIds.includes(memberId))) {
    errors.add('split', UNKNOWN_MEMBER)
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
    payerId: input.payerId,
    amount: input.amount,
    currency: input.currency,
    date: input.date,
    categoryId: categoryId as string,
    tags: input.tags,
    description: input.description,
    ...price,
    split: input.split?.mode ?? 'equal',
    shares: sharesFor(memberIds, input, price.groupAmount),
  }
}

const expenseState = (row: GroupExpenseRow): GroupExpenseState => ({
  payerId: row.payerId,
  amount: row.amount,
  currency: row.currency,
  date: row.date,
  categoryId: row.categoryId,
  tags: [...row.tags],
  description: row.description,
  rate: row.rate,
  rateManual: row.rateManual,
  groupAmount: row.groupAmount,
  split: row.split,
  shares: row.shares.map((share) => ({ ...share })),
})

const groupExpense = (state: MockState, group: GroupRow, id: string | undefined, deleted: boolean): GroupExpenseRow =>
  state.groupExpenses.find((row) => row.id === id && row.groupId === group.id && row.deleted === deleted) ?? notFound()

function record(db: MockDb, group: GroupRow, row: GroupExpenseRow, action: GroupEntryAction, userId: string): void {
  appendEvent(db.state, group, 'expense', row.id, action, expenseState(row), userId)
  db.save()
}

export function registerGroupExpenseHandlers(router: MockRouter) {
  router.on('GET', '/v1/groups/:id/expenses', ({ db, userId, params, query }) => {
    const errors = collectErrors()
    const deleted = readDeleted(query.deleted, errors)
    const group = findGroup(db.state, userId, params.id)
    const page = paginate(group ? expensesOf(db.state, group.id, deleted) : [], query, GROUP_PAGE, errors)
    if (!group) notFound()
    return page
  })

  router.on('POST', '/v1/groups/:id/expenses', ({ db, userId, params, body }) => {
    const today = todayIso()
    const input = validateExpense(body, today)
    const group = ownGroup(db.state, userId, params.id)
    const row: GroupExpenseRow = {
      id: newId('gexp'),
      ...prepareExpense(db.state, group, input, today),
      deleted: false,
      groupId: group.id,
      createdAt: new Date().toISOString(),
    }
    db.state.groupExpenses.push(row)
    record(db, group, row, 'created', userId)
    return expenseView(db.state, row)
  })

  router.on('PUT', '/v1/groups/:id/expenses/:expenseId', ({ db, userId, params, body }) => {
    const today = todayIso()
    const input = validateExpense(body, today)
    const group = ownGroup(db.state, userId, params.id)
    const row = groupExpense(db.state, group, params.expenseId, false)
    Object.assign(row, prepareExpense(db.state, group, input, today))
    record(db, group, row, 'updated', userId)
    return expenseView(db.state, row)
  })

  router.on('DELETE', '/v1/groups/:id/expenses/:expenseId', ({ db, userId, params }) => {
    const group = ownGroup(db.state, userId, params.id)
    const row = groupExpense(db.state, group, params.expenseId, false)
    row.deleted = true
    record(db, group, row, 'deleted', userId)
  })

  router.on('POST', '/v1/groups/:id/expenses/:expenseId/restore', ({ db, userId, params }) => {
    const group = ownGroup(db.state, userId, params.id)
    const row = groupExpense(db.state, group, params.expenseId, true)
    row.deleted = false
    record(db, group, row, 'restored', userId)
    return expenseView(db.state, row)
  })

  router.on('GET', '/v1/groups/:id/expenses/:expenseId/history', ({ db, userId, params, query }) => {
    const group = findGroup(db.state, userId, params.id)
    const expense =
      group && db.state.groupExpenses.find((row) => row.id === params.expenseId && row.groupId === group.id)
    const page = paginate(
      group && expense ? historyOf<GroupExpenseState>(db.state, group, 'expense', expense.id) : [],
      query,
      GROUP_PAGE,
    )
    if (!expense) notFound()
    return page
  })
}
