import type { TransferDto } from '../../app/shared/api/contract'
import { isIsoDate, todayIso } from '../../app/shared/period/period'
import type { AccountRow, MockDb, TransferRow } from '../db'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'
import { AMOUNT_MAX, checkAccount, transferRow } from '../transfers'
import { collectErrors, isManualRate, isMissing, objectBody } from '../validation'

export const TRANSFER_NOTE_MAX = 200

export const oneYearAhead = (today: string): string => `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`

function createTransfer(db: MockDb, userId: string, body: unknown): TransferRow {
  const { date, fromAccountId, toAccountId, fromAmount, rate, note } = objectBody(body)
  const errors = collectErrors()
  if (isMissing(date)) errors.add('date', 'validation.required')
  else if (!isIsoDate(date)) errors.add('date', 'validation.invalidValue')
  else if (date > oneYearAhead(todayIso())) errors.add('date', 'validation.dateTooFar')
  const from = checkAccount(db.state, userId, fromAccountId, 'fromAccountId', errors)
  const to = checkAccount(db.state, userId, toAccountId, 'toAccountId', errors)
  if (from && to && from.id === to.id) errors.add('toAccountId', 'validation.sameAccount')
  if (isMissing(fromAmount)) errors.add('fromAmount', 'validation.required')
  else if (!Number.isSafeInteger(fromAmount) || (fromAmount as number) > AMOUNT_MAX) {
    errors.add('fromAmount', 'validation.invalidValue')
  } else if ((fromAmount as number) <= 0) errors.add('fromAmount', 'validation.positiveAmount')
  if (!isMissing(rate) && !isManualRate(rate)) errors.add('rate', 'validation.invalidValue')
  if (!isMissing(note) && (typeof note !== 'string' || note.trim().length > TRANSFER_NOTE_MAX)) {
    errors.add('note', 'validation.invalidValue')
  }
  errors.throwIfAny()
  return transferRow(db.state, userId, {
    date: date as string,
    from: from as AccountRow,
    to: to as AccountRow,
    fromAmount: fromAmount as number,
    rate: typeof rate === 'number' ? rate : undefined,
    note: typeof note === 'string' && note.trim() !== '' ? note.trim() : null,
  })
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
