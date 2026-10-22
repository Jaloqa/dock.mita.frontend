import { describe, expect, it } from 'bun:test'
import type { Currency } from '../../../app/shared/money/currencies'
import { currencyFormat } from '../../../app/shared/money/format'
import {
  convertMinor,
  fromMinor,
  roundRate,
  sumMinor,
  toMinor,
  withinAmountLimit,
  withinRateLimit,
} from '../../../app/shared/money/money'

describe('money', () => {
  it.each([
    [12.34, 1234],
    [1.005, 101],
    [0.1 + 0.2, 30],
    [-2.5, -250],
    [0, 0],
  ])('toMinor(%d, PLN) = %d', (major, minor) => {
    expect(toMinor(major, 'PLN')).toBe(minor)
  })

  it.each([
    [1500, 'JPY', 1500],
    [1.25, 'KWD', 1250],
    [12.5, 'PLN', 1250],
    [1.0005, 'KWD', 1001],
    [-1.0005, 'KWD', -1001],
    [0.5, 'JPY', 1],
  ] as [number, Currency, number][])('toMinor(%d, %s) = %d', (major, currency, minor) => {
    expect(toMinor(major, currency)).toBe(minor)
  })

  it('converts minor units back to major units of the currency', () => {
    expect(fromMinor(123456, 'PLN')).toBe(1234.56)
    expect(fromMinor(1250, 'KWD')).toBe(1.25)
    expect(fromMinor(1500, 'JPY')).toBe(1500)
  })

  it.each([
    [1500, 0.024764, 'JPY', 'PLN', 3715],
    [1250, 12.6221, 'KWD', 'PLN', 1578],
    [3715, 40.38, 'PLN', 'JPY', 1500],
    [100, 0.0001503, 'VND', 'PLN', 2],
    [1000, 4.2563, 'EUR', 'PLN', 4256],
    [1, 0.5, 'PLN', 'PLN', 1],
    [-1, 0.5, 'PLN', 'PLN', -1],
    [10000, 4.2717, 'PLN', 'PLN', 42717],
    [3, 0.333333, 'PLN', 'PLN', 1],
    [5, 0.5, 'PLN', 'PLN', 3],
    [-5, 0.5, 'PLN', 'PLN', -3],
    [1, 0.4, 'PLN', 'PLN', 0],
  ] as [number, number, Currency, Currency, number][])(
    'convertMinor(%d, %d, %s, %s) = %d',
    (minor, rate, from, to, expected) => {
      expect(convertMinor(minor, rate, from, to)).toBe(expected)
    },
  )

  it('rounds the exact decimal product, not its binary approximation', () => {
    expect(convertMinor(100, 1.005, 'PLN', 'PLN')).toBe(101)
    expect(convertMinor(8_529_407, 0.0123457, 'PLN', 'PLN')).toBe(105_301)
    expect(convertMinor(100_000_000_000, 1.0000005, 'PLN', 'PLN')).toBe(100_000_050_000)
  })

  it('never returns negative zero', () => {
    expect(Object.is(convertMinor(-1, 0.4, 'PLN', 'PLN'), 0)).toBe(true)
    expect(Object.is(toMinor(-0.001, 'PLN'), 0)).toBe(true)
    expect(Object.is(roundRate(-0.0000000000004), 0)).toBe(true)
  })

  it.each([
    [4.256349, 4.256349],
    [1.0913589744, 1.091359],
    [0.1, 0.1],
    [0.0247644, 0.0247644],
    [0.02476449, 0.0247645],
    [0.00000212, 0.00000212],
    [0.00000016795, 0.00000016795],
    [0.0000000000004, 0],
    [-0.02476449, -0.0247645],
    [-0.0247645, -0.0247645],
    [0.0000004, 0.0000004],
    [1.0000005, 1.000001],
    [0.01000005, 0.0100001],
  ])('roundRate(%d) = %d', (rate, expected) => {
    expect(roundRate(rate)).toBe(expected)
  })

  it('crosses rates through PLN like the backend', () => {
    expect(roundRate(4.27 / 3.93)).toBe(1.086514)
  })

  it('sums minor units', () => {
    expect(sumMinor([100, -50, 25])).toBe(75)
    expect(sumMinor([])).toBe(0)
  })

  it('holds an amount to the minor unit limit of its currency', () => {
    const jpy = withinAmountLimit(() => 'JPY')
    const kwd = withinAmountLimit(() => 'KWD')
    const pln = withinAmountLimit(() => 'PLN')
    expect(jpy(100_000_000_000)).toBe(true)
    expect(jpy(100_000_000_001)).toBe(false)
    expect(kwd(100_000_000)).toBe(true)
    expect(kwd(100_000_000.001)).toBe(false)
    expect(pln(1_000_000_000)).toBe(true)
    expect(pln(-1_000_000_000.01)).toBe(false)
    expect(pln(null)).toBe(true)
  })

  it('holds a manual rate to the backend maximum', () => {
    expect(withinRateLimit(1_000_000_000)).toBe(true)
    expect(withinRateLimit(1_000_000_000.5)).toBe(false)
    expect(withinRateLimit(null)).toBe(true)
  })
})

describe('currency format', () => {
  it('uses the narrow symbol and exactly the minor unit digits of the currency', () => {
    expect(new Intl.NumberFormat('en', currencyFormat('JPY')).format(1500)).toBe('¥1,500')
    expect(new Intl.NumberFormat('en', currencyFormat('KWD')).format(1.25)).toContain('1.250')
    expect(new Intl.NumberFormat('en', currencyFormat('IQD')).format(1.25)).toContain('1.250')
    expect(new Intl.NumberFormat('en', currencyFormat('PLN')).format(12.5)).toContain('12.50')
    expect(currencyFormat('IQD')).toEqual({
      style: 'currency',
      currency: 'IQD',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })
  })
})
