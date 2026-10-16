import { type Currency, convertMinor } from '../app/shared/money/money'
import type { Period } from '../app/shared/period/period'
import type { MockState, RateRow, TransactionRow } from './db'
import { rateOn, roundRate } from './rates'

export type PriceInput = {
  date: string
  amount: number
  currency: Currency
  accountCurrency: Currency
  baseCurrency: Currency
  rate?: number
}

export type Price = Pick<TransactionRow, 'rate' | 'accountAmount' | 'baseAmount' | 'accountCurrency' | 'baseCurrency'>

export function priceTransaction(rates: readonly RateRow[], input: PriceInput): Price {
  const rate =
    input.currency === input.accountCurrency
      ? 1
      : input.rate !== undefined
        ? roundRate(input.rate)
        : rateOn(rates, input.date, input.currency, input.accountCurrency)
  const accountAmount = convertMinor(input.amount, rate)
  const baseAmount =
    input.currency === input.baseCurrency
      ? input.amount
      : convertMinor(accountAmount, rateOn(rates, input.date, input.accountCurrency, input.baseCurrency))
  return {
    rate,
    accountAmount,
    baseAmount,
    accountCurrency: input.accountCurrency,
    baseCurrency: input.baseCurrency,
  }
}

export const baseCurrencyOf = (state: MockState, userId: string): Currency =>
  state.settings.find((row) => row.userId === userId)?.baseCurrency ?? 'PLN'

export function baseAmountOf(state: MockState, row: TransactionRow, base: Currency): number {
  if (row.baseCurrency === base) return row.baseAmount
  if (row.currency === base) return row.amount
  return convertMinor(row.accountAmount, rateOn(state.rates, row.date, row.accountCurrency, base))
}

export const signed = (row: Pick<TransactionRow, 'kind'>, amount: number): number =>
  row.kind === 'income' ? amount : -amount

export const transactionsIn = (
  state: MockState,
  userId: string,
  range: Pick<Period, 'from' | 'to'>,
): TransactionRow[] =>
  state.transactions.filter((row) => row.userId === userId && row.date >= range.from && row.date <= range.to)
