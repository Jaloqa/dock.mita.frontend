export type Currency = 'PLN' | 'EUR' | 'USD' | 'UAH'

export const currencies: readonly Currency[] = ['PLN', 'EUR', 'USD', 'UAH']

export function roundHalfAwayFromZero(value: number): number {
  const stabilized = Math.round(Math.abs(value) * 1e6) / 1e6
  const rounded = Math.round(stabilized)
  if (rounded === 0) return 0
  return value < 0 ? -rounded : rounded
}

export const toMinor = (major: number): number => roundHalfAwayFromZero(major * 100)

export const fromMinor = (minor: number): number => minor / 100

export const convertMinor = (minor: number, rate: number): number => roundHalfAwayFromZero(minor * rate)

export const sumMinor = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)
