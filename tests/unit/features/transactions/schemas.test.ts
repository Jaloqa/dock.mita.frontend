import { describe, expect, it } from 'bun:test'
import {
  isPositiveMinor,
  isPositiveOrEmpty,
  notAfter,
  quickAddRules,
  TRANSACTION_NOTE_MAX,
  TRANSACTION_TITLE_MAX,
  transactionRules,
} from '../../../../app/features/transactions/schemas/transactionSchema'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

const limit = new Date(2027, 9, 16)

describe('transaction form rules', () => {
  it('accepts positive amounts only', () => {
    expect(isPositiveOrEmpty(null)).toBe(true)
    expect(isPositiveOrEmpty(0.01)).toBe(true)
    expect(isPositiveOrEmpty(0)).toBe(false)
    expect(isPositiveMinor(1)).toBe(true)
    expect(isPositiveMinor(0)).toBe(false)
    expect(isPositiveMinor(1.5)).toBe(false)
  })

  it('limits the date', () => {
    expect(notAfter(() => limit)(new Date(2027, 9, 16))).toBe(true)
    expect(notAfter(() => limit)(new Date(2027, 9, 17))).toBe(false)
    expect(notAfter(() => limit)(null)).toBe(true)
  })

  it('requires a rate only for another currency', () => {
    let cross = false
    const rules = transactionRules((key) => key, { crossCurrency: () => cross, maxDate: () => limit })
    expect(validate(rules.rate.required, null)).toBe(true)
    cross = true
    expect(validate(rules.rate.required, null)).toBe(false)
    expect(validate(rules.rate.positive, -1)).toBe(false)
  })

  it('checks lengths and maps failures to translation keys', () => {
    const rules = transactionRules((key) => key, { crossCurrency: () => false, maxDate: () => limit })
    expect(validate(rules.title.maxLength, 'a'.repeat(TRANSACTION_TITLE_MAX))).toBe(true)
    expect(validate(rules.title.maxLength, 'a'.repeat(TRANSACTION_TITLE_MAX + 1))).toBe(false)
    expect(validate(rules.note.maxLength, 'a'.repeat(TRANSACTION_NOTE_MAX + 1))).toBe(false)
    expect(message(rules.amount.required)).toBe('validation.required')
    expect(message(rules.amount.positive)).toBe('validation.positiveAmount')
    expect(message(rules.date.notTooFar)).toBe('validation.dateTooFar')
    expect(message(rules.title.maxLength)).toBe('validation.titleTooLong')
    expect(message(rules.note.maxLength)).toBe('validation.noteTooLong')
    expect(message(rules.categoryId.required)).toBe('validation.required')
  })

  it('needs an amount, a category and an account on the quick add screen', () => {
    const rules = quickAddRules((key) => key)
    expect(validate(rules.amount.positive, 0)).toBe(false)
    expect(message(rules.amount.positive)).toBe('validation.positiveAmount')
    expect(validate(rules.categoryId.required, null)).toBe(false)
    expect(validate(rules.accountId.required, 'acc')).toBe(true)
  })
})
