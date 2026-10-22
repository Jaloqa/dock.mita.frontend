import { type Currency, currencyDigits } from './currencies'

export function currencyFormat(currency: Currency): Intl.NumberFormatOptions {
  const digits = currencyDigits(currency)
  return {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }
}
