import { BASE_CURRENCIES, type BaseCurrency, type Currency } from '../../../shared/money/currencies'
import type { MonthStart } from '../../../shared/period/period'

export type Option<T> = { value: T; label: string }

export const MONTH_START_DAYS = 28

export const currencySymbol = (currency: Currency, locale: string): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value ?? currency

export const currencyLabel = (currency: Currency, locale: string): string =>
  `${currency} — ${currencySymbol(currency, locale)}`

export const currencyOptions = (locale: string): Option<BaseCurrency>[] =>
  BASE_CURRENCIES.map((currency) => ({ value: currency, label: currencyLabel(currency, locale) }))

export const monthStartOptions = (dayLabel: (day: number) => string, lastWorkingDay: string): Option<MonthStart>[] => [
  ...Array.from({ length: MONTH_START_DAYS }, (_, index) => ({ value: index + 1, label: dayLabel(index + 1) })),
  { value: 'lastWorkingDay', label: lastWorkingDay },
]
