import { describe, expect, it } from 'bun:test'
import { isPositiveOrEmpty, notAfter, requiredWhen } from '../../../app/shared/utils/validation'

describe('isPositiveOrEmpty', () => {
  it('lets an empty value pass for the required rule to judge', () => {
    expect(isPositiveOrEmpty(null)).toBe(true)
    expect(isPositiveOrEmpty(undefined)).toBe(true)
  })

  it('accepts a number above zero, however small', () => {
    expect(isPositiveOrEmpty(1)).toBe(true)
    expect(isPositiveOrEmpty(0.001)).toBe(true)
    expect(isPositiveOrEmpty(0.2342)).toBe(true)
  })

  it('rejects zero, a negative number and anything that is not a number', () => {
    expect(isPositiveOrEmpty(0)).toBe(false)
    expect(isPositiveOrEmpty(-1)).toBe(false)
    expect(isPositiveOrEmpty(Number.NaN)).toBe(false)
    expect(isPositiveOrEmpty('5')).toBe(false)
  })
})

describe('requiredWhen', () => {
  it('accepts every value while the condition does not hold', () => {
    const rule = requiredWhen(() => false)
    expect(rule(null)).toBe(true)
    expect(rule(undefined)).toBe(true)
    expect(rule('')).toBe(true)
    expect(rule(0.25)).toBe(true)
  })

  it('rejects a missing value while the condition holds', () => {
    const rule = requiredWhen(() => true)
    expect(rule(null)).toBe(false)
    expect(rule(undefined)).toBe(false)
    expect(rule('')).toBe(false)
  })

  it('accepts a filled value while the condition holds, zero included', () => {
    const rule = requiredWhen(() => true)
    expect(rule(0.25)).toBe(true)
    expect(rule(0)).toBe(true)
    expect(rule('acc_a')).toBe(true)
  })

  it('reads the condition again on every check', () => {
    let condition = false
    const rule = requiredWhen(() => condition)
    expect(rule(null)).toBe(true)
    condition = true
    expect(rule(null)).toBe(false)
  })
})

describe('notAfter', () => {
  const limit = new Date(2027, 9, 16)
  const rule = notAfter(() => limit)

  it('accepts a day up to and including the limit day', () => {
    expect(rule(new Date(2027, 9, 15))).toBe(true)
    expect(rule(new Date(2027, 9, 16))).toBe(true)
  })

  it('rejects a day after the limit day', () => {
    expect(rule(new Date(2027, 9, 17))).toBe(false)
    expect(rule(new Date(2028, 0, 1))).toBe(false)
  })

  it('compares calendar days and ignores the time of day', () => {
    expect(rule(new Date(2027, 9, 16, 23, 59, 59))).toBe(true)
    expect(rule(new Date(2027, 9, 17, 0, 0, 0))).toBe(false)
    expect(notAfter(() => new Date(2027, 9, 16, 8, 30))(new Date(2027, 9, 16, 20, 0))).toBe(true)
  })

  it('lets an empty value or anything that is not a date pass for the required rule to judge', () => {
    expect(rule(null)).toBe(true)
    expect(rule(undefined)).toBe(true)
    expect(rule('2030-01-01')).toBe(true)
  })

  it('reads the limit again on every check', () => {
    let current = new Date(2027, 9, 16)
    const moving = notAfter(() => current)
    expect(moving(new Date(2027, 9, 20))).toBe(false)
    current = new Date(2027, 9, 21)
    expect(moving(new Date(2027, 9, 20))).toBe(true)
  })
})
