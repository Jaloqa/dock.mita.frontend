import { describe, expect, it } from 'bun:test'
import { convertMinor, currencies, fromMinor, sumMinor, toMinor } from '../../../app/shared/money/money'

describe('money', () => {
  it('lists the supported currencies', () => {
    expect(currencies).toEqual(['PLN', 'EUR', 'USD', 'UAH'])
  })

  it.each([
    [12.34, 1234],
    [1.005, 101],
    [0.1 + 0.2, 30],
    [-2.5, -250],
    [0, 0],
  ])('toMinor(%d) = %d', (major, minor) => {
    expect(toMinor(major)).toBe(minor)
  })

  it('converts minor units back to major units', () => {
    expect(fromMinor(123456)).toBe(1234.56)
  })

  it.each([
    [1000, 4.2537, 4254],
    [5, 0.5, 3],
    [-5, 0.5, -3],
    [1, 0.4, 0],
    [-1, 0.4, 0],
  ])('convertMinor(%d, %d) = %d', (minor, rate, expected) => {
    expect(convertMinor(minor, rate)).toBe(expected)
  })

  it('never returns negative zero', () => {
    expect(Object.is(convertMinor(-1, 0.4), 0)).toBe(true)
  })

  it('sums minor units', () => {
    expect(sumMinor([100, -50, 25])).toBe(75)
    expect(sumMinor([])).toBe(0)
  })
})
