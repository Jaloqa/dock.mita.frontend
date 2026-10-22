import { type Currency, isCurrency } from './currencies'

const STORAGE_KEY = 'mita.recentCurrencies'

export const RECENT_CURRENCIES_MAX = 5

const latest = (currencies: readonly Currency[]): Currency[] => [...new Set(currencies)].slice(0, RECENT_CURRENCIES_MAX)

export function readRecentCurrencies(): Currency[] {
  try {
    const stored: unknown = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(stored) ? latest(stored.filter(isCurrency)) : []
  } catch {
    return []
  }
}

export function rememberCurrency(currency: Currency): void {
  const recent = latest([currency, ...readRecentCurrencies()])
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
  } catch {
    return
  }
}
