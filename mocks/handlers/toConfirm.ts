import type { GroupTerms } from '../../app/shared/api/contract'
import { convertMinor } from '../../app/shared/money/money'
import { todayIso } from '../../app/shared/period/period'
import { ownCategories } from '../categories'
import type { AccountRow, GroupEntryKind, MockDb, MockState } from '../db'
import { checkConverted } from '../debts'
import { conflict, notFound, ratesUnavailable } from '../errors'
import { GROUP_PAGE } from '../groups'
import { paginate } from '../paginate'
import { freshRateOn } from '../rates'
import type { MockContext, MockRouter } from '../router'
import { CONTROL, parseTags, tagsError } from '../tags'
import {
  bookItem,
  type ConfirmedLine,
  decide,
  entryOf,
  expenseCategoryNamed,
  findPendingItem,
  itemView,
  pendingItems,
  removeRecords,
  type ToConfirmItem,
} from '../toConfirm'
import { baseCurrencyOf, priceTransaction } from '../transactions'
import { collectErrors, type ErrorCollector, isManualRate, isMissing, objectBody } from '../validation'
import { CATEGORY_NAME_MAX } from './categories'
import { TRANSACTION_TITLE_MAX } from './transactions'

const INVALID = 'validation.invalidValue'
const ITEM_CHANGED = 'group.itemChanged'

type ConfirmInput = {
  version: string
  accountId: string | null
  rate: number | undefined
  lines: ConfirmedLine[] | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const kindOfPath = (value: string | undefined): GroupEntryKind | undefined =>
  value === 'expenses' ? 'expense' : value === 'repayments' ? 'repayment' : undefined

function checkVersion(value: unknown, errors: ErrorCollector): void {
  if (isMissing(value)) errors.add('version', 'validation.required')
  else if (typeof value !== 'string') errors.add('version', INVALID)
}

function checkText(value: unknown, field: string, max: number, tooLong: string, errors: ErrorCollector): void {
  if (typeof value !== 'string') errors.add(field, INVALID)
  else if (value.trim().length > max) errors.add(field, tooLong)
  else if (CONTROL.test(value.trim())) errors.add(field, INVALID)
}

function checkLine(line: Record<string, unknown>, index: number, errors: ErrorCollector): void {
  const field = (name: string) => `lines.${index}.${name}`
  const { categoryId, newCategory, title, tags } = line
  const hasCategory = !isMissing(categoryId)
  const hasNewCategory = !isMissing(newCategory)
  if (hasCategory === hasNewCategory) errors.add(field('categoryId'), hasCategory ? INVALID : 'validation.required')
  else if (hasCategory && typeof categoryId !== 'string') errors.add(field('categoryId'), 'validation.unknownCategory')
  if (hasNewCategory) checkText(newCategory, field('newCategory'), CATEGORY_NAME_MAX, 'validation.nameTooLong', errors)
  if (!isMissing(title)) checkText(title, field('title'), TRANSACTION_TITLE_MAX, 'validation.titleTooLong', errors)
  const tagsProblem = tagsError(tags)
  if (tagsProblem !== undefined) errors.add(field('tags'), tagsProblem)
}

function readLine({ categoryId, newCategory, title, tags }: Record<string, unknown>): ConfirmedLine {
  const chosen = typeof categoryId === 'string' && !isMissing(categoryId) ? categoryId.trim() : null
  return {
    categoryId: chosen,
    newCategory: chosen === null && typeof newCategory === 'string' ? newCategory.trim() : null,
    title: typeof title === 'string' ? title.trim() : '',
    tags: parseTags(tags),
  }
}

function validateConfirm(body: unknown): ConfirmInput {
  const { version, accountId, rate, lines } = objectBody(body)
  const errors = collectErrors()
  checkVersion(version, errors)
  if (!isMissing(accountId) && typeof accountId !== 'string') errors.add('accountId', 'validation.unknownAccount')
  if (!isMissing(rate) && !isManualRate(rate)) errors.add('rate', INVALID)
  const elements = isMissing(lines) ? undefined : Array.isArray(lines) && lines.every(isRecord) ? lines : null
  if (elements === null) errors.add('lines', INVALID)
  for (const [index, line] of (elements ?? []).entries()) checkLine(line, index, errors)
  errors.throwIfAny()
  return {
    version: version as string,
    accountId: typeof accountId === 'string' && !isMissing(accountId) ? accountId.trim() : null,
    rate: typeof rate === 'number' ? rate : undefined,
    lines: elements ? elements.map(readLine) : null,
  }
}

function validateReject(body: unknown): string {
  const { version } = objectBody(body)
  const errors = collectErrors()
  checkVersion(version, errors)
  errors.throwIfAny()
  return version as string
}

function pendingItem(db: MockDb, userId: string, params: Record<string, string>): ToConfirmItem {
  const kind = kindOfPath(params.kind) ?? notFound()
  ownCategories(db, userId)
  return findPendingItem(db.state, userId, kind, params.entryId) ?? notFound()
}

function checkReferences(
  state: MockState,
  userId: string,
  item: ToConfirmItem,
  input: ConfirmInput,
): { account: AccountRow; lines: ConfirmedLine[] } {
  const errors = collectErrors()
  if (input.accountId === null) errors.add('accountId', 'validation.required')
  const lines = input.lines !== null && input.lines.length === item.lines.length ? input.lines : null
  if (lines === null) errors.add('lines', INVALID)
  const account = state.accounts.find((row) => row.id === input.accountId && row.userId === userId)
  const keepsAccount =
    (item.confirmation?.confirmedTerms ?? null) !== null && item.confirmation?.accountId === account?.id
  if (input.accountId !== null && !account) errors.add('accountId', 'validation.unknownAccount')
  else if (account?.archived && !keepsAccount) errors.add('accountId', 'validation.archivedAccount')
  const own = state.categories.filter((row) => row.userId === userId)
  for (const [index, line] of (lines ?? []).entries()) {
    if (line.categoryId !== null) {
      const category = own.find((row) => row.id === line.categoryId)
      if (category?.kind !== 'expense' || category.system === 'transfer') {
        errors.add(`lines.${index}.categoryId`, 'validation.unknownCategory')
      }
    } else if (line.newCategory !== null) {
      if (expenseCategoryNamed(state, userId, line.newCategory)?.system === 'transfer') {
        errors.add(`lines.${index}.newCategory`, 'validation.categoryNameTaken')
      }
    }
  }
  errors.throwIfAny()
  return { account: account as AccountRow, lines: lines as ConfirmedLine[] }
}

function book(state: MockState, userId: string, item: ToConfirmItem, current: GroupTerms, input: ConfirmInput): void {
  const { account, lines } = checkReferences(state, userId, item, input)
  const entry = entryOf(current)
  const today = todayIso()
  const baseCurrency = baseCurrencyOf(state, userId)
  const price = priceTransaction(state.rates, {
    date: entry.date,
    today,
    amount: entry.amount,
    currency: entry.currency,
    accountCurrency: account.currency,
    baseCurrency,
    ...(input.rate === undefined ? {} : { rate: input.rate }),
  })
  checkConverted([price.accountAmount])
  const toBase =
    entry.currency === baseCurrency
      ? 1
      : (freshRateOn(state.rates, entry.date, today, account.currency, baseCurrency) ?? ratesUnavailable())
  bookItem(state, userId, item, account, lines, {
    rate: price.rate,
    accountAmount: price.accountAmount,
    baseCurrency,
    baseOf: (lineAmount, part) =>
      entry.currency === baseCurrency ? lineAmount : convertMinor(part, toBase, account.currency, baseCurrency),
  })
}

function confirmItem({ db, userId, params, body }: MockContext): void {
  const input = validateConfirm(body)
  const item = pendingItem(db, userId, params)
  if (item.version !== input.version) conflict(ITEM_CHANGED)
  if (item.current === null) {
    removeRecords(db.state, userId, item.confirmation)
    decide(db.state, userId, item, { handledTerms: null, confirmedTerms: null })
  } else {
    book(db.state, userId, item, item.current, input)
  }
  db.save()
}

function rejectItem({ db, userId, params, body }: MockContext): void {
  const version = validateReject(body)
  const item = pendingItem(db, userId, params)
  if (item.version !== version) conflict(ITEM_CHANGED)
  decide(db.state, userId, item, { handledTerms: item.current })
  db.save()
}

export function registerToConfirmHandlers(router: MockRouter) {
  router.on('GET', '/v1/to-confirm', ({ db, userId, query }) => {
    ownCategories(db, userId)
    return paginate(pendingItems(db.state, userId).map(itemView), query, GROUP_PAGE)
  })
  router.on('POST', '/v1/to-confirm/:kind/:entryId/confirm', confirmItem)
  router.on('POST', '/v1/to-confirm/:kind/:entryId/reject', rejectItem)
}
