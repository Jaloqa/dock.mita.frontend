import { describe, expect, it } from 'bun:test'
import { contributionRules, requiredWhen } from '../../../../app/features/goals/schemas/contributionSchema'
import {
  GOAL_NAME_MAX,
  GOAL_TARGET_MAX,
  goalRules,
  isDeadlineAllowed,
} from '../../../../app/features/goals/schemas/goalSchema'
import { type Currency, MANUAL_RATE_MAX } from '../../../../app/shared/money/currencies'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

describe('goal form rules', () => {
  const rules = goalRules((key) => key, { minMonth: () => '2026-10', originalDeadline: () => '2026-08' })

  it('requires a name of at most 40 characters after trimming', () => {
    expect(validate(rules.name.required, '   ')).toBe(false)
    expect(validate(rules.name.required, 'Rower')).toBe(true)
    expect(message(rules.name.required)).toBe('validation.required')
    expect(validate(rules.name.maxLength, ` ${'x'.repeat(GOAL_NAME_MAX)} `)).toBe(true)
    expect(validate(rules.name.maxLength, 'x'.repeat(GOAL_NAME_MAX + 1))).toBe(false)
    expect(message(rules.name.maxLength)).toBe('validation.nameTooLong')
  })

  it('accepts positive targets up to the maximum', () => {
    expect(validate(rules.target.required, null)).toBe(false)
    expect(validate(rules.target.positive, 0)).toBe(false)
    expect(validate(rules.target.positive, 0.01)).toBe(true)
    expect(message(rules.target.positive)).toBe('validation.positiveAmount')
    expect(validate(rules.target.max, GOAL_TARGET_MAX)).toBe(true)
    expect(validate(rules.target.max, GOAL_TARGET_MAX + 1)).toBe(false)
    expect(message(rules.target.max)).toBe('validation.invalidValue')
  })

  it('accepts no deadline, this month or later, and an unchanged past deadline', () => {
    const allowed = isDeadlineAllowed(
      () => '2026-10',
      () => '2026-08',
    )
    expect(allowed(null)).toBe(true)
    expect(allowed(new Date(2026, 9, 1))).toBe(true)
    expect(allowed(new Date(2027, 5, 1))).toBe(true)
    expect(allowed(new Date(2026, 7, 1))).toBe(true)
    expect(allowed(new Date(2026, 8, 1))).toBe(false)
    expect(validate(rules.deadline.notPast, new Date(2026, 8, 1))).toBe(false)
    expect(message(rules.deadline.notPast)).toBe('validation.deadlinePast')
  })
})

describe('contribution form rules', () => {
  it('requires the source account only for a linked goal and a rate only across currencies', () => {
    let linked = false
    let crossCurrency = false
    const rules = contributionRules((key) => key, {
      linked: () => linked,
      crossCurrency: () => crossCurrency,
      currency: () => 'PLN',
    })
    expect(validate(rules.fromAccountId.required, null)).toBe(true)
    linked = true
    expect(validate(rules.fromAccountId.required, null)).toBe(false)
    expect(validate(rules.fromAccountId.required, 'acc_1')).toBe(true)
    expect(validate(rules.rate.required, null)).toBe(true)
    crossCurrency = true
    expect(validate(rules.rate.required, null)).toBe(false)
    expect(validate(rules.rate.positive, 0)).toBe(false)
    expect(validate(rules.rate.positive, 4.27)).toBe(true)
    expect(validate(rules.rate.max, MANUAL_RATE_MAX)).toBe(true)
    expect(validate(rules.rate.max, MANUAL_RATE_MAX + 1)).toBe(false)
    expect(message(rules.rate.max)).toBe('validation.invalidValue')
  })

  it('requires a positive amount up to the minor unit limit of its currency and a date', () => {
    let currency: Currency = 'PLN'
    const rules = contributionRules((key) => key, {
      linked: () => false,
      crossCurrency: () => false,
      currency: () => currency,
    })
    expect(validate(rules.amount.required, null)).toBe(false)
    expect(validate(rules.amount.positive, 0)).toBe(false)
    expect(validate(rules.amount.max, 1_000_000_000)).toBe(true)
    expect(validate(rules.amount.max, 1_000_000_000.01)).toBe(false)
    currency = 'JPY'
    expect(validate(rules.amount.max, 100_000_000_000)).toBe(true)
    currency = 'KWD'
    expect(validate(rules.amount.max, 100_000_000.001)).toBe(false)
    expect(message(rules.amount.max)).toBe('validation.invalidValue')
    expect(validate(rules.date.required, null)).toBe(false)
    expect(validate(rules.date.required, new Date(2026, 9, 16))).toBe(true)
    expect(message(rules.fromAccountId.required)).toBe('validation.required')
  })

  it('treats an empty string as missing when the condition holds', () => {
    expect(requiredWhen(() => true)('')).toBe(false)
    expect(requiredWhen(() => false)('')).toBe(true)
  })
})
