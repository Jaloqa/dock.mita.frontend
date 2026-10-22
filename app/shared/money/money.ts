import { AMOUNT_MINOR_MAX, type Currency, currencyDigits, MANUAL_RATE_MAX } from './currencies'

export type { Currency } from './currencies'

type Decimal = { digits: bigint; exponent: number }

const RATE_DECIMALS = 6
const SMALL_RATE_THRESHOLDS = [1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6]

// Doubles are read through their shortest decimal form and rounded with integer arithmetic,
// so midpoints such as 1.005 round exactly like the backend decimal type instead of drifting in binary.
function decimalOf(value: number): Decimal {
  const [mantissa = '0', exponent = '0'] = Math.abs(value).toExponential().split('e')
  const [whole = '0', fraction = ''] = mantissa.split('.')
  return { digits: BigInt(whole + fraction), exponent: Number(exponent) - fraction.length }
}

function roundToInteger({ digits, exponent }: Decimal): bigint {
  if (exponent >= 0) return digits * 10n ** BigInt(exponent)
  const divisor = 10n ** BigInt(-exponent)
  return (digits * 2n + divisor) / (divisor * 2n)
}

const withSign = (sign: number, magnitude: bigint): number => (magnitude === 0n ? 0 : sign * Number(magnitude))

export function roundHalfAwayFromZero(value: number): number {
  const stabilized = Math.round(Math.abs(value) * 1e6) / 1e6
  const rounded = Math.round(stabilized)
  if (rounded === 0) return 0
  return value < 0 ? -rounded : rounded
}

export function toMinor(major: number, currency: Currency): number {
  if (!Number.isFinite(major)) return major
  const { digits, exponent } = decimalOf(major)
  return withSign(Math.sign(major), roundToInteger({ digits, exponent: exponent + currencyDigits(currency) }))
}

export const fromMinor = (minor: number, currency: Currency): number => minor / 10 ** currencyDigits(currency)

export function fitMajor(major: number, currency: Currency): number {
  if (!Number.isFinite(major)) return major
  const { digits, exponent } = decimalOf(major)
  const shift = exponent + currencyDigits(currency)
  const minor = shift >= 0 ? digits * 10n ** BigInt(shift) : digits / 10n ** BigInt(-shift)
  return fromMinor(withSign(Math.sign(major), minor), currency)
}

export function convertMinor(minor: number, rate: number, from: Currency, to: Currency): number {
  if (!Number.isFinite(minor) || !Number.isFinite(rate)) return Number.NaN
  const amount = decimalOf(minor)
  const factor = decimalOf(rate)
  const product = roundToInteger({
    digits: amount.digits * factor.digits,
    exponent: amount.exponent + factor.exponent + currencyDigits(to) - currencyDigits(from),
  })
  return withSign(Math.sign(minor) * Math.sign(rate), product)
}

export function roundRate(rate: number): number {
  if (!Number.isFinite(rate)) return rate
  const magnitude = Math.abs(rate)
  const decimals =
    RATE_DECIMALS + (magnitude === 0 ? 0 : SMALL_RATE_THRESHOLDS.filter((threshold) => magnitude < threshold).length)
  const { digits, exponent } = decimalOf(rate)
  const rounded = roundToInteger({ digits, exponent: exponent + decimals })
  return rounded === 0n ? 0 : Math.sign(rate) * Number(`${rounded}e-${decimals}`)
}

export const sumMinor = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)

export const withinAmountLimit =
  (currency: () => Currency) =>
  (value: unknown): boolean =>
    typeof value !== 'number' || Math.abs(toMinor(value, currency())) <= AMOUNT_MINOR_MAX

export const withinRateLimit = (value: unknown): boolean => typeof value !== 'number' || value <= MANUAL_RATE_MAX
