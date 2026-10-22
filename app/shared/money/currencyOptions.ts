import type { Currency } from './currencies'

export type CurrencyOption = { value: Currency; code: Currency; name: string; label: string }

export type CurrencyGroup = { label: string; items: CurrencyOption[] }

export const PINNED_CURRENCIES_MAX = 8

const displayNames = new Map<string, Intl.DisplayNames>()

function namesIn(locale: string): Intl.DisplayNames {
  const cached = displayNames.get(locale)
  if (cached) return cached
  const names = new Intl.DisplayNames(locale, { type: 'currency', fallback: 'none' })
  displayNames.set(locale, names)
  return names
}

export function currencyName(currency: Currency, locale: string): string {
  try {
    return namesIn(locale).of(currency) ?? currency
  } catch {
    return currency
  }
}

export function currencyOption(currency: Currency, locale: string): CurrencyOption {
  const name = currencyName(currency, locale)
  return { value: currency, code: currency, name, label: name === currency ? currency : `${currency} — ${name}` }
}

const offeredOnly = (currencies: readonly Currency[], offered: readonly Currency[]): Currency[] => {
  const available = new Set(offered)
  return [...new Set(currencies)].filter((currency) => available.has(currency))
}

export const pinnedCurrencies = (
  recent: readonly Currency[],
  pinned: readonly Currency[],
  offered: readonly Currency[],
): Currency[] => offeredOnly([...recent, ...pinned], offered).slice(0, PINNED_CURRENCIES_MAX)

export function currencyGroups(
  locale: string,
  offered: readonly Currency[],
  pinned: readonly Currency[],
  labels: { pinned: string; all: string },
): CurrencyGroup[] {
  const top = offeredOnly(pinned, offered)
  const shown = new Set(top)
  const rest = offered.filter((currency) => !shown.has(currency)).sort()
  const all: CurrencyGroup = { label: labels.all, items: rest.map((currency) => currencyOption(currency, locale)) }
  if (top.length === 0) return [all]
  return [{ label: labels.pinned, items: top.map((currency) => currencyOption(currency, locale)) }, all]
}
