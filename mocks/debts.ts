import type { DebtDirection, DebtDto, DebtRepaymentDto, DebtStatus, DebtSummary } from '../app/shared/api/contract'
import { AMOUNT_MINOR_MAX, type Currency } from '../app/shared/money/currencies'
import { convertMinor, roundRate } from '../app/shared/money/money'
import type { DebtRepaymentRow, DebtRow, MockState, RateRow } from './db'
import { badRequest, ratesUnavailable } from './errors'
import { amountIn } from './goals'
import { freshRateOn } from './rates'

export type DebtPriceInput = {
  date: string
  today: string
  amount: number
  currency: Currency
  accountCurrency: Currency | null
  rate?: number
}

export type RepaymentPriceInput = {
  date: string
  today: string
  amount: number
  currency: Currency
  debtCurrency: Currency
  accountCurrency: Currency | null
  rate?: number
}

export function priceDebt(
  rates: readonly RateRow[],
  input: DebtPriceInput,
): { rate: number | null; accountAmount: number | null } {
  const { accountCurrency } = input
  if (accountCurrency === null) return { rate: null, accountAmount: null }
  const rate =
    input.currency === accountCurrency
      ? 1
      : input.rate !== undefined
        ? roundRate(input.rate)
        : (freshRateOn(rates, input.date, input.today, input.currency, accountCurrency) ?? ratesUnavailable())
  return { rate, accountAmount: convertMinor(input.amount, rate, input.currency, accountCurrency) }
}

export function priceRepayment(
  rates: readonly RateRow[],
  input: RepaymentPriceInput,
): { rate: number; debtAmount: number; accountAmount: number | null } {
  const { amount, currency, debtCurrency, accountCurrency } = input
  const fresh = (from: Currency, to: Currency): number =>
    freshRateOn(rates, input.date, input.today, from, to) ?? ratesUnavailable()
  const rate =
    currency === debtCurrency ? 1 : input.rate !== undefined ? roundRate(input.rate) : fresh(currency, debtCurrency)
  const debtAmount = convertMinor(amount, rate, currency, debtCurrency)
  if (accountCurrency === null) return { rate, debtAmount, accountAmount: null }
  const accountAmount =
    accountCurrency === currency
      ? amount
      : accountCurrency === debtCurrency
        ? debtAmount
        : convertMinor(amount, fresh(currency, accountCurrency), currency, accountCurrency)
  return { rate, debtAmount, accountAmount }
}

export function checkConverted(amounts: readonly (number | null)[]): void {
  const converted = amounts.filter((amount): amount is number => amount !== null)
  if (converted.some((amount) => amount <= 0)) badRequest({ rate: ['validation.positiveAmount'] })
  if (converted.some((amount) => amount > AMOUNT_MINOR_MAX)) badRequest({ rate: ['validation.invalidValue'] })
}

const isOpen = (row: Pick<DebtRow, 'amount' | 'repaid'>): boolean => row.repaid < row.amount

export function debtView(state: MockState, row: DebtRow, today: string): DebtDto {
  const remaining = row.amount - row.repaid
  return {
    id: row.id,
    direction: row.direction,
    counterparty: row.counterparty,
    amount: row.amount,
    currency: row.currency,
    repaid: row.repaid,
    remaining,
    status: remaining > 0 ? 'open' : 'settled',
    overdue: remaining > 0 && row.dueDate !== null && row.dueDate < today,
    date: row.date,
    dueDate: row.dueDate,
    accountId: row.accountId,
    accountAmount: row.accountAmount,
    rate: row.rate,
    note: row.note,
    repayments: state.debtRepayments.filter((repayment) => repayment.debtId === row.id).length,
  }
}

type Ranked = { row: DebtRow; index: number }

const newestFirst = (a: Ranked, b: Ranked): number => b.row.date.localeCompare(a.row.date) || b.index - a.index

const dueFirst = (a: Ranked, b: Ranked): number => {
  if (a.row.dueDate === b.row.dueDate) return 0
  if (a.row.dueDate === null) return 1
  if (b.row.dueDate === null) return -1
  return a.row.dueDate.localeCompare(b.row.dueDate)
}

export function debtsOf(state: MockState, userId: string, status: DebtStatus, today: string): DebtDto[] {
  const ranked: Ranked[] = []
  for (const [index, row] of state.debts.entries()) {
    if (row.userId === userId && isOpen(row) === (status === 'open')) ranked.push({ row, index })
  }
  ranked.sort(status === 'open' ? (a, b) => dueFirst(a, b) || newestFirst(a, b) : newestFirst)
  return ranked.map(({ row }) => debtView(state, row, today))
}

export function repaymentsOf(state: MockState, userId: string, debtId: string): DebtRepaymentDto[] {
  const ranked: { row: DebtRepaymentRow; index: number }[] = []
  for (const [index, row] of state.debtRepayments.entries()) {
    if (row.userId === userId && row.debtId === debtId) ranked.push({ row, index })
  }
  ranked.sort((a, b) => b.row.date.localeCompare(a.row.date) || b.index - a.index)
  return ranked.map(({ row: { userId: _userId, debtId: _debtId, createdAt: _createdAt, ...repayment } }) => repayment)
}

export function summarizeDebts(state: MockState, userId: string, base: Currency, today: string): DebtSummary {
  const open = state.debts.filter((row) => row.userId === userId && isOpen(row))
  const groups = new Map<string, { direction: DebtDirection; currency: Currency; remaining: number }>()
  for (const row of open) {
    const key = `${row.direction}:${row.currency}`
    const group = groups.get(key) ?? { direction: row.direction, currency: row.currency, remaining: 0 }
    group.remaining += row.amount - row.repaid
    groups.set(key, group)
  }
  let owedToMe = 0
  let owedByMe = 0
  for (const group of groups.values()) {
    const converted = amountIn(state, group.remaining, group.currency, base, today)
    if (group.direction === 'lent') owedToMe += converted
    else owedByMe += converted
  }
  return {
    owedToMe,
    owedByMe,
    open: open.length,
    overdue: open.filter((row) => row.dueDate !== null && row.dueDate < today).length,
  }
}
