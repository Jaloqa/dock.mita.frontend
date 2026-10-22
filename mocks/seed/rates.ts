import type { BaseCurrency } from '../../app/shared/money/currencies'
import { roundRate } from '../../app/shared/money/money'
import { addDaysIso } from '../../app/shared/period/period'
import type { RateRow } from '../db'

type Quoted = Exclude<BaseCurrency, 'PLN'>

const quoted: readonly Quoted[] = ['EUR', 'USD', 'UAH']
const level: Record<Quoted, number> = { EUR: 4.27, USD: 3.93, UAH: 0.0952 }
const phase: Record<Quoted, number> = { EUR: 0, USD: 1.7, UAH: 3.1 }

export const RATE_HISTORY_DAYS = 183

const dayNumber = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / 86_400_000

export function plnRate(currency: Quoted, date: string): number {
  const day = dayNumber(date)
  const drift =
    0.018 * Math.sin(day / 31 + phase[currency]) +
    0.006 * Math.sin(day / 8.3 + 2 * phase[currency]) +
    0.001 * Math.sin(day * 1.37 + phase[currency])
  return roundRate(level[currency] * (1 + drift))
}

export const seedRates = (today: string): RateRow[] =>
  quoted.flatMap((currency) =>
    Array.from({ length: RATE_HISTORY_DAYS + 1 }, (_, index): RateRow => {
      const date = addDaysIso(today, index - RATE_HISTORY_DAYS)
      return { date, from: currency, to: 'PLN', value: plnRate(currency, date) }
    }),
  )
