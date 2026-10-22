import { CURRENCIES, type Currency } from '../../app/shared/money/currencies'
import { roundRate } from '../../app/shared/money/money'
import { addDaysIso } from '../../app/shared/period/period'
import type { RateRow } from '../db'
import { RATE_LEVELS } from './rateLevels'

type Quoted = Exclude<Currency, 'PLN'>
type Daily = 'EUR' | 'USD' | 'UAH'

const quoted = CURRENCIES.filter((currency): currency is Quoted => currency !== 'PLN')

// The three daily currencies keep their original demo levels so seeded balances and end-to-end expectations stay stable.
const dailyLevel: Record<Daily, number> = { EUR: 4.27, USD: 3.93, UAH: 0.0952 }
const dailyPhase: Record<Daily, number> = { EUR: 0, USD: 1.7, UAH: 3.1 }

const GOLDEN_ANGLE = 2.399963

export const RATE_HISTORY_DAYS = 183

const isDaily = (currency: Quoted): currency is Quoted & Daily => currency in dailyLevel

const levelOf = (currency: Quoted): number => (isDaily(currency) ? dailyLevel[currency] : RATE_LEVELS[currency])

const phaseOf = (currency: Quoted): number =>
  isDaily(currency) ? dailyPhase[currency] : (CURRENCIES.indexOf(currency) * GOLDEN_ANGLE) % (2 * Math.PI)

const dayNumber = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / 86_400_000

const isWednesday = (iso: string): boolean => (dayNumber(iso) + 4) % 7 === 3

export function plnRate(currency: Quoted, date: string): number {
  const day = dayNumber(date)
  const phase = phaseOf(currency)
  const drift =
    0.018 * Math.sin(day / 31 + phase) + 0.006 * Math.sin(day / 8.3 + 2 * phase) + 0.001 * Math.sin(day * 1.37 + phase)
  return roundRate(levelOf(currency) * (1 + drift))
}

export function seedRates(today: string): RateRow[] {
  const days = Array.from({ length: RATE_HISTORY_DAYS + 1 }, (_, index) => addDaysIso(today, index - RATE_HISTORY_DAYS))
  const wednesdays = days.filter(isWednesday)
  return quoted.flatMap((currency) =>
    (isDaily(currency) ? days : wednesdays).map(
      (date): RateRow => ({ date, from: currency, to: 'PLN', value: plnRate(currency, date) }),
    ),
  )
}
