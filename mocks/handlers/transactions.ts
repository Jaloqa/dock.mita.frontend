import {
  type CategoryKind,
  categoryKinds,
  TAGS_PER_TRANSACTION_MAX,
  type TransactionDto,
  type TransactionPage,
  type TransactionSort,
  transactionSorts,
} from '../../app/shared/api/contract'
import type { Currency } from '../../app/shared/money/money'
import { isIsoDate, todayIso } from '../../app/shared/period/period'
import { ownCategories } from '../categories'
import type { AccountRow, CategoryRow, MockDb, MockState, TransactionRow } from '../db'
import { badRequest, notFound } from '../errors'
import { newId } from '../ids'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'
import { parseTags, tagRefs, tagsError, upsertTags } from '../tags'
import { baseAmountOf, baseCurrencyOf, priceTransaction, signed } from '../transactions'
import { collectErrors, isCurrency, isMissing, objectBody } from '../validation'
import { oneYearAhead } from './transfers'

export const TRANSACTION_TITLE_MAX = 100
export const TRANSACTION_NOTE_MAX = 200
const MAX_AMOUNT = 100_000_000_000
const AMOUNT_SEARCH = /^\d+(?:[.,]\d{0,2})?$/

type Errors = ReturnType<typeof collectErrors>
type Fields = Omit<TransactionRow, 'id' | 'userId' | 'tagIds'>
type Filters = {
  search?: string
  categoryId?: string
  accountId?: string
  tagIds?: string[]
  kind?: CategoryKind
  from?: string
  to?: string
  sort: TransactionSort
}
type Ranked = { row: TransactionRow; index: number; base: number }

const isKind = (value: unknown): value is CategoryKind => categoryKinds.includes(value as CategoryKind)

const isSort = (value: unknown): value is TransactionSort => transactionSorts.includes(value as TransactionSort)

function checkText(value: unknown, field: string, max: number, tooLong: string, errors: Errors): void {
  if (isMissing(value)) return
  if (typeof value !== 'string') errors.add(field, 'validation.invalidValue')
  else if (value.trim().length > max) errors.add(field, tooLong)
}

function checkCategory(own: readonly CategoryRow[], value: unknown, kind: unknown, errors: Errors): void {
  if (isMissing(value)) {
    errors.add('categoryId', 'validation.required')
    return
  }
  const category = own.find((row) => row.id === value)
  if (!category || category.system === 'transfer') errors.add('categoryId', 'validation.unknownCategory')
  else if (isKind(kind) && category.kind !== kind) errors.add('categoryId', 'validation.categoryKindMismatch')
}

function checkAccount(
  db: MockDb,
  userId: string,
  value: unknown,
  existing: TransactionRow | undefined,
  errors: Errors,
): AccountRow | undefined {
  if (isMissing(value)) {
    errors.add('accountId', 'validation.required')
    return undefined
  }
  const account = db.state.accounts.find((row) => row.id === value && row.userId === userId)
  if (!account) errors.add('accountId', 'validation.unknownAccount')
  else if (account.archived && account.id !== existing?.accountId) errors.add('accountId', 'validation.archivedAccount')
  return account
}

function validateTransaction(
  db: MockDb,
  userId: string,
  body: unknown,
  existing?: TransactionRow,
): { fields: Fields; tagNames: string[] } {
  const { kind, date, title, note, categoryId, accountId, amount, currency, rate, tags } = objectBody(body)
  const errors = collectErrors()
  if (isMissing(kind)) errors.add('kind', 'validation.required')
  else if (!isKind(kind)) errors.add('kind', 'validation.invalidValue')
  if (isMissing(date)) errors.add('date', 'validation.required')
  else if (!isIsoDate(date)) errors.add('date', 'validation.invalidValue')
  else if (date > oneYearAhead(todayIso())) errors.add('date', 'validation.dateTooFar')
  checkText(title, 'title', TRANSACTION_TITLE_MAX, 'validation.titleTooLong', errors)
  checkText(note, 'note', TRANSACTION_NOTE_MAX, 'validation.noteTooLong', errors)
  checkCategory(ownCategories(db, userId), categoryId, kind, errors)
  const account = checkAccount(db, userId, accountId, existing, errors)
  if (isMissing(amount)) errors.add('amount', 'validation.required')
  else if (!Number.isSafeInteger(amount) || (amount as number) > MAX_AMOUNT) {
    errors.add('amount', 'validation.invalidValue')
  } else if ((amount as number) <= 0) errors.add('amount', 'validation.positiveAmount')
  if (isMissing(currency)) errors.add('currency', 'validation.required')
  else if (!isCurrency(currency)) errors.add('currency', 'validation.invalidValue')
  if (!isMissing(rate) && (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0)) {
    errors.add('rate', 'validation.invalidValue')
  }
  const tagsProblem = tagsError(tags)
  if (tagsProblem !== undefined) errors.add('tags', tagsProblem)
  errors.throwIfAny()
  const target = account as AccountRow
  const day = date as string
  const price = priceTransaction(db.state.rates, {
    date: day,
    amount: amount as number,
    currency: currency as Currency,
    accountCurrency: target.currency,
    baseCurrency: baseCurrencyOf(db.state, userId),
    ...(typeof rate === 'number' ? { rate } : {}),
  })
  if (price.accountAmount <= 0) badRequest({ rate: ['validation.positiveAmount'] })
  const trimmedNote = typeof note === 'string' ? note.trim() : ''
  return {
    fields: {
      kind: kind as CategoryKind,
      date: day,
      title: typeof title === 'string' ? title.trim() : '',
      note: trimmedNote === '' ? null : trimmedNote,
      categoryId: categoryId as string,
      accountId: target.id,
      amount: amount as number,
      currency: currency as Currency,
      ...price,
    },
    tagNames: parseTags(tags),
  }
}

function parseTagIds(value: string | undefined): string[] | undefined {
  if (value === undefined || value.trim() === '') return []
  const ids = [...new Set(value.split(',').map((id) => id.trim()))]
  return ids.includes('') || ids.length > TAGS_PER_TRANSACTION_MAX ? undefined : ids
}

function readFilters(query: Record<string, string>): Filters {
  const errors = collectErrors()
  if (query.kind !== undefined && !isKind(query.kind)) errors.add('kind', 'validation.invalidValue')
  if (query.from !== undefined && !isIsoDate(query.from)) errors.add('from', 'validation.invalidValue')
  if (query.to !== undefined && !isIsoDate(query.to)) errors.add('to', 'validation.invalidValue')
  if (query.sort !== undefined && !isSort(query.sort)) errors.add('sort', 'validation.invalidValue')
  const tagIds = parseTagIds(query.tagIds)
  if (tagIds === undefined) errors.add('tagIds', 'validation.invalidValue')
  errors.throwIfAny()
  const search = query.search?.trim().toLocaleLowerCase()
  return {
    search: search === '' ? undefined : search,
    categoryId: query.categoryId,
    accountId: query.accountId,
    tagIds: tagIds?.length === 0 ? undefined : tagIds,
    kind: query.kind as CategoryKind | undefined,
    from: query.from,
    to: query.to,
    sort: (query.sort as TransactionSort | undefined) ?? '-date',
  }
}

function matchesSearch(
  row: TransactionRow,
  search: string,
  categoryName: string,
  tagNames: readonly string[],
): boolean {
  if ([row.title, row.note ?? '', categoryName, ...tagNames].some((text) => text.toLocaleLowerCase().includes(search)))
    return true
  return AMOUNT_SEARCH.test(search) && (row.amount / 100).toFixed(2).startsWith(search.replace(',', '.'))
}

const matches = (row: TransactionRow, filters: Filters, categoryName: string, tagNames: readonly string[]): boolean =>
  (filters.kind === undefined || row.kind === filters.kind) &&
  (filters.categoryId === undefined || row.categoryId === filters.categoryId) &&
  (filters.accountId === undefined || row.accountId === filters.accountId) &&
  (filters.tagIds === undefined || row.tagIds.some((id) => filters.tagIds?.includes(id))) &&
  (filters.from === undefined || row.date >= filters.from) &&
  (filters.to === undefined || row.date <= filters.to) &&
  (filters.search === undefined || matchesSearch(row, filters.search, categoryName, tagNames))

const newestFirst = (a: Ranked, b: Ranked): number => b.row.date.localeCompare(a.row.date) || b.index - a.index

const comparators: Record<TransactionSort, (a: Ranked, b: Ranked) => number> = {
  '-date': newestFirst,
  date: (a, b) => a.row.date.localeCompare(b.row.date) || a.index - b.index,
  '-amount': (a, b) => b.base - a.base || newestFirst(a, b),
  amount: (a, b) => a.base - b.base || newestFirst(a, b),
}

const toDto = (state: MockState, row: TransactionRow, baseAmount: number): TransactionDto => ({
  id: row.id,
  kind: row.kind,
  date: row.date,
  title: row.title,
  note: row.note,
  categoryId: row.categoryId,
  accountId: row.accountId,
  amount: row.amount,
  currency: row.currency,
  accountAmount: row.accountAmount,
  rate: row.rate,
  baseAmount,
  tags: tagRefs(state, row.tagIds),
})

const tagNames = (state: MockState, row: TransactionRow): string[] =>
  row.tagIds.length === 0 ? [] : tagRefs(state, row.tagIds).map((tag) => tag.name)

const ownTransaction = (db: MockDb, userId: string, id: string | undefined): TransactionRow =>
  db.state.transactions.find((row) => row.id === id && row.userId === userId) ?? notFound()

export function registerTransactionHandlers(router: MockRouter) {
  router.on('GET', '/v1/transactions', ({ db, userId, query }): TransactionPage => {
    const filters = readFilters(query)
    const base = baseCurrencyOf(db.state, userId)
    const names = new Map(ownCategories(db, userId).map((row) => [row.id, row.name]))
    const ranked: Ranked[] = []
    for (const [index, row] of db.state.transactions.entries()) {
      if (row.userId === userId && matches(row, filters, names.get(row.categoryId) ?? '', tagNames(db.state, row))) {
        ranked.push({ row, index, base: baseAmountOf(db.state, row, base) })
      }
    }
    ranked.sort(comparators[filters.sort])
    const sum = ranked.reduce((total, entry) => total + signed(entry.row, entry.base), 0)
    const page = paginate(
      ranked.map((entry) => toDto(db.state, entry.row, entry.base)),
      query,
      { defaultPageSize: 20, maxPageSize: 100 },
    )
    return { ...page, sum, currency: base }
  })

  router.on('GET', '/v1/transactions/:id', ({ db, userId, params }) => {
    const row = ownTransaction(db, userId, params.id)
    return toDto(db.state, row, baseAmountOf(db.state, row, baseCurrencyOf(db.state, userId)))
  })

  router.on('POST', '/v1/transactions', ({ db, userId, body }) => {
    const { fields, tagNames } = validateTransaction(db, userId, body)
    const row: TransactionRow = {
      id: newId('txn'),
      userId,
      ...fields,
      tagIds: upsertTags(db.state, userId, tagNames),
    }
    db.state.transactions.push(row)
    db.save()
    return toDto(db.state, row, row.baseAmount)
  })

  router.on('PUT', '/v1/transactions/:id', ({ db, userId, params, body }) => {
    const row = ownTransaction(db, userId, params.id)
    const { fields, tagNames } = validateTransaction(db, userId, body, row)
    Object.assign(row, fields, { tagIds: upsertTags(db.state, userId, tagNames) })
    db.save()
    return toDto(db.state, row, row.baseAmount)
  })

  router.on('DELETE', '/v1/transactions/:id', ({ db, userId, params }) => {
    const row = ownTransaction(db, userId, params.id)
    db.state.transactions = db.state.transactions.filter((transaction) => transaction.id !== row.id)
    db.save()
  })
}
