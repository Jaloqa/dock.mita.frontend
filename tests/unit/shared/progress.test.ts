import { describe, expect, it } from 'bun:test'
import { toPercent } from '../../../app/shared/utils/progress'

describe('toPercent', () => {
  it.each([
    [0.5, 50],
    [1.4, 100],
    [-0.2, 0],
    [NaN, 0],
    [Infinity, 0],
    [0.004, 0],
    [0.005, 1],
  ])('maps %p to %p', (value, expected) => {
    expect(toPercent(value)).toBe(expected)
  })
})
