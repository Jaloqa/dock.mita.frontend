import type { RateDto } from '../api/contract'
import { type Currency, convertMinor } from '../money/money'

export function rateFrom(rates: readonly RateDto[], from: Currency, to: Currency): number | undefined {
  if (from === to) return 1
  return rates.find((rate) => rate.from === from && rate.to === to)?.value
}

export function toBaseAmount(
  minor: number,
  from: Currency,
  base: Currency,
  rates: readonly RateDto[],
): number | undefined {
  const rate = rateFrom(rates, from, base)
  return rate === undefined ? undefined : convertMinor(minor, rate)
}
