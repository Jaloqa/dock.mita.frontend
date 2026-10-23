import {
  COUNTERPARTY_MAX,
  DEBT_NOTE_MAX,
  type DebtDirection,
  type DebtPage,
  type DebtStatus,
  debtDirections,
  debtStatuses,
} from '../../app/shared/api/contract'
import { AMOUNT_MINOR_MAX, type Currency, isCurrency } from '../../app/shared/money/currencies'
import { isIsoDate, todayIso } from '../../app/shared/period/period'
import type { AccountRow, DebtRepaymentRow, DebtRow, MockDb } from '../db'
import { checkConverted, debtsOf, debtView, priceDebt, priceRepayment, repaymentsOf, summarizeDebts } from '../debts'
import { badRequest, notFound } from '../errors'
import { newId } from '../ids'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'
import { baseCurrencyOf } from '../transactions'
import { checkAccount } from '../transfers'
import { collectErrors, isManualRate, isMissing, objectBody } from '../validation'
import { oneYearAhead } from './transfers'

type Errors = ReturnType<typeof collectErrors>
type DebtFields = Pick<
  DebtRow,
  'direction' | 'counterparty' | 'amount' | 'currency' | 'date' | 'dueDate' | 'accountId' | 'note'
>
type DebtInput = { fields: DebtFields; account: AccountRow | undefined; rate: number | undefined }
type RepaymentInput = {
  date: string
  amount: number
  currency: Currency
  account: AccountRow | undefined
  rate: number | undefined
  note: string | null
}

const CONTROL_CHARACTER = /\p{Cc}/u

const isDirection = (value: unknown): value is DebtDirection => debtDirections.includes(value as DebtDirection)

const isStatus = (value: unknown): value is DebtStatus => debtStatuses.includes(value as DebtStatus)

const manualRate = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined)

const noteOf = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

function checkAmount(value: unknown, errors: Errors): void {
  if (isMissing(value)) errors.add('amount', 'validation.required')
  else if (!Number.isSafeInteger(value) || (value as number) > AMOUNT_MINOR_MAX) {
    errors.add('amount', 'validation.invalidValue')
  } else if ((value as number) <= 0) errors.add('amount', 'validation.positiveAmount')
}

function checkCurrency(value: unknown, errors: Errors): void {
  if (isMissing(value)) errors.add('currency', 'validation.required')
  else if (!isCurrency(value)) errors.add('currency', 'validation.invalidValue')
}

function checkDate(value: unknown, today: string, errors: Errors): void {
  if (isMissing(value)) errors.add('date', 'validation.required')
  else if (!isIsoDate(value)) errors.add('date', 'validation.invalidValue')
  else if (value > oneYearAhead(today)) errors.add('date', 'validation.dateTooFar')
}

function checkRate(value: unknown, errors: Errors): void {
  if (!isMissing(value) && !isManualRate(value)) errors.add('rate', 'validation.invalidValue')
}

function checkNote(value: unknown, errors: Errors): void {
  if (isMissing(value)) return
  if (typeof value !== 'string' || CONTROL_CHARACTER.test(value.trim())) errors.add('note', 'validation.invalidValue')
  else if (value.trim().length > DEBT_NOTE_MAX) errors.add('note', 'validation.noteTooLong')
}

function checkCounterparty(value: unknown, errors: Errors): void {
  if (isMissing(value)) errors.add('counterparty', 'validation.required')
  else if (typeof value !== 'string' || CONTROL_CHARACTER.test(value.trim())) {
    errors.add('counterparty', 'validation.invalidValue')
  } else if (value.trim().length > COUNTERPARTY_MAX) errors.add('counterparty', 'validation.nameTooLong')
}

function checkDueDate(value: unknown, date: unknown, errors: Errors): void {
  if (isMissing(value)) return
  if (!isIsoDate(value)) errors.add('dueDate', 'validation.invalidValue')
  else if (isIsoDate(date) && value < date) errors.add('dueDate', 'validation.dueBeforeDate')
}

function checkAccountField(
  db: MockDb,
  userId: string,
  value: unknown,
  errors: Errors,
  keeping?: string | null,
): AccountRow | undefined {
  if (isMissing(value)) return undefined
  if (value === keeping) {
    const kept = db.state.accounts.find((row) => row.id === value && row.userId === userId)
    if (kept) return kept
  }
  return checkAccount(db.state, userId, value, 'accountId', errors)
}

function validateDebt(db: MockDb, userId: string, body: unknown, today: string, existing?: DebtRow): DebtInput {
  const { direction, counterparty, amount, currency, date, dueDate, accountId, rate, note } = objectBody(body)
  const errors = collectErrors()
  if (isMissing(direction)) errors.add('direction', 'validation.required')
  else if (!isDirection(direction)) errors.add('direction', 'validation.invalidValue')
  checkCounterparty(counterparty, errors)
  checkAmount(amount, errors)
  checkCurrency(currency, errors)
  checkDate(date, today, errors)
  checkDueDate(dueDate, date, errors)
  const account = checkAccountField(db, userId, accountId, errors, existing?.accountId)
  checkRate(rate, errors)
  checkNote(note, errors)
  errors.throwIfAny()
  return {
    fields: {
      direction: direction as DebtDirection,
      counterparty: (counterparty as string).trim(),
      amount: amount as number,
      currency: currency as Currency,
      date: date as string,
      dueDate: isMissing(dueDate) ? null : (dueDate as string),
      accountId: account?.id ?? null,
      note: noteOf(note),
    },
    account,
    rate: manualRate(rate),
  }
}

function priceFor(db: MockDb, input: DebtInput, today: string): Pick<DebtRow, 'rate' | 'accountAmount'> {
  const { fields, account, rate } = input
  const price = priceDebt(db.state.rates, {
    date: fields.date,
    today,
    amount: fields.amount,
    currency: fields.currency,
    accountCurrency: account?.currency ?? null,
    rate,
  })
  checkConverted([price.accountAmount])
  return price
}

function validateRepayment(db: MockDb, userId: string, body: unknown, today: string): RepaymentInput {
  const { amount, currency, date, rate, accountId, note } = objectBody(body)
  const errors = collectErrors()
  checkAmount(amount, errors)
  checkCurrency(currency, errors)
  checkDate(date, today, errors)
  checkRate(rate, errors)
  const account = checkAccountField(db, userId, accountId, errors)
  checkNote(note, errors)
  errors.throwIfAny()
  return {
    date: date as string,
    amount: amount as number,
    currency: currency as Currency,
    account,
    rate: manualRate(rate),
    note: noteOf(note),
  }
}

const findDebt = (db: MockDb, userId: string, id: string | undefined): DebtRow | undefined =>
  db.state.debts.find((row) => row.id === id && row.userId === userId)

const ownDebt = (db: MockDb, userId: string, id: string | undefined): DebtRow => findDebt(db, userId, id) ?? notFound()

export function registerDebtHandlers(router: MockRouter) {
  router.on('GET', '/v1/debts', ({ db, userId, query }): DebtPage => {
    const today = todayIso()
    if (query.status !== undefined && !isStatus(query.status)) badRequest({ status: ['validation.invalidValue'] })
    const status = isStatus(query.status) ? query.status : 'open'
    const page = paginate(debtsOf(db.state, userId, status, today), query, { defaultPageSize: 100, maxPageSize: 100 })
    const base = baseCurrencyOf(db.state, userId)
    return { ...page, currency: base, summary: summarizeDebts(db.state, userId, base, today) }
  })

  router.on('POST', '/v1/debts', ({ db, userId, body }) => {
    const today = todayIso()
    const input = validateDebt(db, userId, body, today)
    const row: DebtRow = {
      id: newId('debt'),
      userId,
      repaid: 0,
      createdAt: new Date().toISOString(),
      ...input.fields,
      ...priceFor(db, input, today),
    }
    db.state.debts.push(row)
    db.save()
    return debtView(db.state, row, today)
  })

  router.on('PUT', '/v1/debts/:id', ({ db, userId, params, body }) => {
    const today = todayIso()
    const existing = findDebt(db, userId, params.id)
    const input = validateDebt(db, userId, body, today, existing)
    const row = existing ?? notFound()
    const price = priceFor(db, input, today)
    const failures = collectErrors()
    if (input.fields.amount < row.repaid) failures.add('amount', 'validation.belowRepaid')
    if (input.fields.currency !== row.currency && row.repaid > 0) {
      failures.add('currency', 'validation.debtCurrencyLocked')
    }
    failures.throwIfAny()
    Object.assign(row, input.fields, price)
    db.save()
    return debtView(db.state, row, today)
  })

  router.on('DELETE', '/v1/debts/:id', ({ db, userId, params }) => {
    const row = ownDebt(db, userId, params.id)
    db.state.debts = db.state.debts.filter((debt) => debt.id !== row.id)
    db.state.debtRepayments = db.state.debtRepayments.filter((repayment) => repayment.debtId !== row.id)
    db.save()
  })

  router.on('GET', '/v1/debts/:id/repayments', ({ db, userId, params, query }) => {
    const debt = findDebt(db, userId, params.id)
    const page = paginate(debt ? repaymentsOf(db.state, userId, debt.id) : [], query, {
      defaultPageSize: 100,
      maxPageSize: 100,
    })
    if (!debt) notFound()
    return page
  })

  router.on('POST', '/v1/debts/:id/repayments', ({ db, userId, params, body }) => {
    const today = todayIso()
    const input = validateRepayment(db, userId, body, today)
    const debt = ownDebt(db, userId, params.id)
    const price = priceRepayment(db.state.rates, {
      date: input.date,
      today,
      amount: input.amount,
      currency: input.currency,
      debtCurrency: debt.currency,
      accountCurrency: input.account?.currency ?? null,
      rate: input.rate,
    })
    checkConverted([price.debtAmount, price.accountAmount])
    if (price.debtAmount > debt.amount - debt.repaid) badRequest({ amount: ['validation.exceedsRemaining'] })
    const row: DebtRepaymentRow = {
      id: newId('rep'),
      userId,
      debtId: debt.id,
      date: input.date,
      amount: input.amount,
      currency: input.currency,
      rate: price.rate,
      debtAmount: price.debtAmount,
      accountId: input.account?.id ?? null,
      accountAmount: price.accountAmount,
      note: input.note,
      createdAt: new Date().toISOString(),
    }
    debt.repaid += price.debtAmount
    db.state.debtRepayments.push(row)
    db.save()
    return debtView(db.state, debt, today)
  })

  router.on('DELETE', '/v1/debts/:id/repayments/:repaymentId', ({ db, userId, params }) => {
    const debt = ownDebt(db, userId, params.id)
    const repayment =
      db.state.debtRepayments.find(
        (row) => row.id === params.repaymentId && row.debtId === debt.id && row.userId === userId,
      ) ?? notFound()
    debt.repaid -= repayment.debtAmount
    db.state.debtRepayments = db.state.debtRepayments.filter((row) => row.id !== repayment.id)
    db.save()
  })
}
