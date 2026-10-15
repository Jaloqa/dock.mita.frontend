import type { Currency } from '../app/shared/money/money'
import type { RateRow } from './db'

export const roundRate = (value: number): number => Math.round(value * 1e6) / 1e6

function plnValue(rows: readonly RateRow[], date: string, currency: Currency): number | undefined {
  if (currency === 'PLN') return 1
  let earliest: RateRow | undefined
  let latestBefore: RateRow | undefined
  for (const row of rows) {
    if (row.from !== currency || row.to !== 'PLN') continue
    if (!earliest || row.date < earliest.date) earliest = row
    if (row.date <= date && (!latestBefore || row.date > latestBefore.date)) latestBefore = row
  }
  return (latestBefore ?? earliest)?.value
}

export function rateOn(rows: readonly RateRow[], date: string, from: Currency, to: Currency): number {
  if (from === to) return 1
  const fromValue = plnValue(rows, date, from)
  const toValue = plnValue(rows, date, to)
  if (fromValue === undefined || toValue === undefined) throw new Error(`No rate for ${from}/${to}`)
  return roundRate(fromValue / toValue)
}
