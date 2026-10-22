import { type Currency, roundRate } from '../app/shared/money/money'
import { addDaysIso } from '../app/shared/period/period'
import type { RateRow } from './db'
import { ratesUnavailable } from './errors'

const RATE_MAX_AGE_DAYS = 30

function plnValue(
  rows: readonly RateRow[],
  date: string,
  currency: Currency,
  oldestAllowed?: string,
): number | undefined {
  if (currency === 'PLN') return 1
  let earliest: RateRow | undefined
  let latestBefore: RateRow | undefined
  for (const row of rows) {
    if (row.from !== currency || row.to !== 'PLN') continue
    if (!earliest || row.date < earliest.date) earliest = row
    if (row.date <= date && (!latestBefore || row.date > latestBefore.date)) latestBefore = row
  }
  if (!latestBefore) return earliest?.value
  return oldestAllowed !== undefined && latestBefore.date < oldestAllowed ? undefined : latestBefore.value
}

export function rateOn(rows: readonly RateRow[], date: string, from: Currency, to: Currency): number {
  if (from === to) return 1
  const fromValue = plnValue(rows, date, from)
  const toValue = plnValue(rows, date, to)
  if (fromValue === undefined || toValue === undefined) return ratesUnavailable()
  return roundRate(fromValue / toValue)
}

export function freshRateOn(
  rows: readonly RateRow[],
  date: string,
  today: string,
  from: Currency,
  to: Currency,
): number | undefined {
  if (from === to) return 1
  const oldestAllowed = addDaysIso(date < today ? date : today, -RATE_MAX_AGE_DAYS)
  const fromValue = plnValue(rows, date, from, oldestAllowed)
  const toValue = plnValue(rows, date, to, oldestAllowed)
  return fromValue === undefined || toValue === undefined ? undefined : roundRate(fromValue / toValue)
}
