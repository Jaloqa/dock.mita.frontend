import type { TransferDto } from '../../app/shared/api/contract'
import { convertMinor } from '../../app/shared/money/money'
import { isIsoDate, todayIso } from '../../app/shared/period/period'
import type { AccountRow, MockDb, TransferRow } from '../db'
import { badRequest } from '../errors'
import { newId } from '../ids'
import { paginate } from '../paginate'
import { rateOn, roundRate } from '../rates'
import type { MockRouter } from '../router'
import { collectErrors, isMissing, objectBody } from '../validation'

export const TRANSFER_NOTE_MAX = 200
const MAX_AMOUNT = 100_000_000_000

type Errors = ReturnType<typeof collectErrors>

export const oneYearAhead = (today: string): string => `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`

function checkAccount(db: MockDb, userId: string, value: unknown, field: string, errors: Errors) {
  if (isMissing(value)) {
    errors.add(field, 'validation.required')
    return undefined
  }
  const account = db.state.accounts.find((row) => row.id === value && row.userId === userId)
  if (!account) errors.add(field, 'validation.unknownAccount')
  else if (account.archived) errors.add(field, 'validation.archivedAccount')
  return account
}

function createTransfer(db: MockDb, userId: string, body: unknown): TransferRow {
  const { date, fromAccountId, toAccountId, fromAmount, rate, note } = objectBody(body)
  const errors = collectErrors()
  if (isMissing(date)) errors.add('date', 'validation.required')
  else if (!isIsoDate(date)) errors.add('date', 'validation.invalidValue')
  else if (date > oneYearAhead(todayIso())) errors.add('date', 'validation.dateTooFar')
  const from = checkAccount(db, userId, fromAccountId, 'fromAccountId', errors)
  const to = checkAccount(db, userId, toAccountId, 'toAccountId', errors)
  if (from && to && from.id === to.id) errors.add('toAccountId', 'validation.sameAccount')
  if (isMissing(fromAmount)) errors.add('fromAmount', 'validation.required')
  else if (!Number.isSafeInteger(fromAmount) || (fromAmount as number) > MAX_AMOUNT) {
    errors.add('fromAmount', 'validation.invalidValue')
  } else if ((fromAmount as number) <= 0) errors.add('fromAmount', 'validation.positiveAmount')
  if (!isMissing(rate) && (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0)) {
    errors.add('rate', 'validation.invalidValue')
  }
  if (!isMissing(note) && (typeof note !== 'string' || note.trim().length > TRANSFER_NOTE_MAX)) {
    errors.add('note', 'validation.invalidValue')
  }
  errors.throwIfAny()
  const source = from as AccountRow
  const target = to as AccountRow
  const day = date as string
  const appliedRate =
    source.currency === target.currency
      ? 1
      : typeof rate === 'number'
        ? roundRate(rate)
        : rateOn(db.state.rates, day, source.currency, target.currency)
  const toAmount = convertMinor(fromAmount as number, appliedRate)
  if (toAmount <= 0) badRequest({ rate: ['validation.positiveAmount'] })
  return {
    id: newId('trf'),
    userId,
    date: day,
    fromAccountId: source.id,
    toAccountId: target.id,
    fromAmount: fromAmount as number,
    toAmount,
    rate: appliedRate,
    note: typeof note === 'string' && note.trim() !== '' ? note.trim() : null,
  }
}

const newestFirst = (rows: readonly TransferRow[]): TransferRow[] =>
  rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => b.row.date.localeCompare(a.row.date) || b.index - a.index)
    .map(({ row }) => row)

const toDto = ({ userId: _userId, ...row }: TransferRow): TransferDto => row

export function registerTransferHandlers(router: MockRouter) {
  router.on('GET', '/v1/transfers', ({ db, userId, query }) => {
    const own = db.state.transfers.filter(
      (row) =>
        row.userId === userId &&
        (query.accountId === undefined || row.fromAccountId === query.accountId || row.toAccountId === query.accountId),
    )
    return paginate(newestFirst(own).map(toDto), query, { defaultPageSize: 20, maxPageSize: 100 })
  })

  router.on('POST', '/v1/transfers', ({ db, userId, body }) => {
    const row = createTransfer(db, userId, body)
    db.state.transfers.push(row)
    db.save()
    return toDto(row)
  })
}
