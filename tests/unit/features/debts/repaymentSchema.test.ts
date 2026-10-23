import { describe, expect, it } from 'bun:test'
import { repaymentRules } from '../../../../app/features/debts/schemas/repaymentSchema'
import { DEBT_NOTE_MAX } from '../../../../app/shared/api/contract'
import { type Currency, MANUAL_RATE_MAX } from '../../../../app/shared/money/currencies'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

const build = (
  options: { crossCurrency?: () => boolean; currency?: () => Currency; remaining?: () => number | undefined } = {},
) =>
  repaymentRules((key) => key, {
    crossCurrency: options.crossCurrency ?? (() => false),
    currency: options.currency ?? (() => 'PLN'),
    maxDate: () => new Date(2027, 9, 23),
    remaining: options.remaining ?? (() => undefined),
  })

describe('repayment form rules', () => {
  it('refuses an amount above what is left in the debt currency', () => {
    const rules = build({ remaining: () => 40_000 })
    expect(validate(rules.amount.notAboveRemaining, 401)).toBe(false)
    expect(message(rules.amount.notAboveRemaining)).toBe('validation.exceedsRemaining')
    expect(validate(rules.amount.notAboveRemaining, 400)).toBe(true)
    expect(validate(rules.amount.notAboveRemaining, 399.99)).toBe(true)
    expect(validate(rules.amount.notAboveRemaining, null)).toBe(true)
  })

  it('leaves the remaining check to the server in another currency', () => {
    const rules = build({ currency: () => 'EUR', remaining: () => undefined })
    expect(validate(rules.amount.notAboveRemaining, 500)).toBe(true)
  })

  it('requires a positive amount within the minor unit limit of its currency', () => {
    let currency: Currency = 'PLN'
    const rules = build({ currency: () => currency })
    expect(validate(rules.amount.required, null)).toBe(false)
    expect(message(rules.amount.required)).toBe('validation.required')
    expect(validate(rules.amount.positive, 0)).toBe(false)
    expect(validate(rules.amount.positive, 0.01)).toBe(true)
    expect(message(rules.amount.positive)).toBe('validation.positiveAmount')
    expect(validate(rules.amount.max, 1_000_000_000)).toBe(true)
    expect(validate(rules.amount.max, 1_000_000_000.01)).toBe(false)
    expect(message(rules.amount.max)).toBe('validation.invalidValue')
    currency = 'JPY'
    expect(validate(rules.amount.max, 100_000_000_000)).toBe(true)
  })

  it('requires a rate only across currencies, positive and up to the manual maximum', () => {
    let crossCurrency = false
    const rules = build({ crossCurrency: () => crossCurrency })
    expect(validate(rules.rate.required, null)).toBe(true)
    crossCurrency = true
    expect(validate(rules.rate.required, null)).toBe(false)
    expect(validate(rules.rate.required, 4.3)).toBe(true)
    expect(message(rules.rate.required)).toBe('validation.required')
    expect(validate(rules.rate.positive, 0)).toBe(false)
    expect(message(rules.rate.positive)).toBe('validation.positiveAmount')
    expect(validate(rules.rate.max, MANUAL_RATE_MAX)).toBe(true)
    expect(validate(rules.rate.max, MANUAL_RATE_MAX + 1)).toBe(false)
    expect(message(rules.rate.max)).toBe('validation.invalidValue')
  })

  it('requires a date at most the maximum date', () => {
    const rules = build()
    expect(validate(rules.date.required, null)).toBe(false)
    expect(message(rules.date.required)).toBe('validation.required')
    expect(validate(rules.date.notTooFar, new Date(2027, 9, 23, 18))).toBe(true)
    expect(validate(rules.date.notTooFar, new Date(2027, 9, 24))).toBe(false)
    expect(message(rules.date.notTooFar)).toBe('validation.dateTooFar')
  })

  it('limits the note to 200 characters after trimming', () => {
    const rules = build()
    expect(validate(rules.note.maxLength, ` ${'x'.repeat(DEBT_NOTE_MAX)} `)).toBe(true)
    expect(validate(rules.note.maxLength, 'x'.repeat(DEBT_NOTE_MAX + 1))).toBe(false)
    expect(message(rules.note.maxLength)).toBe('validation.noteTooLong')
  })
})
