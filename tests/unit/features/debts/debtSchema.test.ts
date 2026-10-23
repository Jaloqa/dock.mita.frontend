import { describe, expect, it } from 'bun:test'
import { debtRules } from '../../../../app/features/debts/schemas/debtSchema'
import { COUNTERPARTY_MAX, DEBT_NOTE_MAX } from '../../../../app/shared/api/contract'
import { type Currency, MANUAL_RATE_MAX } from '../../../../app/shared/money/currencies'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown, siblings: Record<string, unknown> = {}): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, siblings, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

const build = (options: { crossCurrency?: () => boolean; currency?: () => Currency } = {}) =>
  debtRules((key) => key, {
    crossCurrency: options.crossCurrency ?? (() => false),
    currency: options.currency ?? (() => 'PLN'),
    maxDate: () => new Date(2027, 9, 23),
  })

describe('debt form rules', () => {
  it('requires a counterparty of at most 40 characters after trimming', () => {
    const rules = build()
    expect(validate(rules.counterparty.required, '   ')).toBe(false)
    expect(validate(rules.counterparty.required, 'Max')).toBe(true)
    expect(message(rules.counterparty.required)).toBe('validation.required')
    expect(validate(rules.counterparty.maxLength, ` ${'x'.repeat(COUNTERPARTY_MAX)} `)).toBe(true)
    expect(validate(rules.counterparty.maxLength, 'x'.repeat(COUNTERPARTY_MAX + 1))).toBe(false)
    expect(message(rules.counterparty.maxLength)).toBe('validation.nameTooLong')
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

  it('requires a date at most the maximum date', () => {
    const rules = build()
    expect(validate(rules.date.required, null)).toBe(false)
    expect(validate(rules.date.notTooFar, new Date(2027, 9, 23))).toBe(true)
    expect(validate(rules.date.notTooFar, new Date(2027, 9, 24))).toBe(false)
    expect(message(rules.date.notTooFar)).toBe('validation.dateTooFar')
  })

  it('accepts no due date or one on or after the date', () => {
    const rules = build()
    const date = new Date(2026, 9, 23)
    expect(validate(rules.dueDate.notBeforeDate, null, { date })).toBe(true)
    expect(validate(rules.dueDate.notBeforeDate, new Date(2026, 9, 23, 18), { date })).toBe(true)
    expect(validate(rules.dueDate.notBeforeDate, new Date(2026, 9, 24), { date })).toBe(true)
    expect(validate(rules.dueDate.notBeforeDate, new Date(2026, 9, 22), { date })).toBe(false)
    expect(validate(rules.dueDate.notBeforeDate, new Date(2026, 9, 22), { date: null })).toBe(true)
    expect(message(rules.dueDate.notBeforeDate)).toBe('validation.dueBeforeDate')
  })

  it('requires a rate only across currencies, positive and up to the manual maximum', () => {
    let crossCurrency = false
    const rules = build({ crossCurrency: () => crossCurrency })
    expect(validate(rules.rate.required, null)).toBe(true)
    crossCurrency = true
    expect(validate(rules.rate.required, null)).toBe(false)
    expect(validate(rules.rate.required, 4.2563)).toBe(true)
    expect(message(rules.rate.required)).toBe('validation.required')
    expect(validate(rules.rate.positive, 0)).toBe(false)
    expect(validate(rules.rate.max, MANUAL_RATE_MAX)).toBe(true)
    expect(validate(rules.rate.max, MANUAL_RATE_MAX + 1)).toBe(false)
    expect(message(rules.rate.max)).toBe('validation.invalidValue')
  })

  it('limits the note to 200 characters', () => {
    const rules = build()
    expect(validate(rules.note.maxLength, 'x'.repeat(DEBT_NOTE_MAX))).toBe(true)
    expect(validate(rules.note.maxLength, 'x'.repeat(DEBT_NOTE_MAX + 1))).toBe(false)
    expect(message(rules.note.maxLength)).toBe('validation.noteTooLong')
  })
})
