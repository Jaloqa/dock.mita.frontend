import { describe, expect, it } from 'bun:test'
import { tagRules } from '../../../../app/features/transactions/schemas/tagSchema'
import {
  isPositiveMinor,
  quickAddRules,
  TRANSACTION_NOTE_MAX,
  TRANSACTION_TITLE_MAX,
  transactionRules,
} from '../../../../app/features/transactions/schemas/transactionSchema'
import { TAG_NAME_MAX, TAGS_PER_TRANSACTION_MAX } from '../../../../app/shared/api/contract'
import { type Currency, MANUAL_RATE_MAX } from '../../../../app/shared/money/currencies'
import { isPositiveOrEmpty, notAfter } from '../../../../app/shared/utils/validation'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

const limit = new Date(2027, 9, 16)

const options = (currency: Currency = 'PLN', crossCurrency = () => false) => ({
  crossCurrency,
  maxDate: () => limit,
  currency: () => currency,
})

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
    const rules = transactionRules(
      (key) => key,
      options('PLN', () => cross),
    )
    expect(validate(rules.rate.required, null)).toBe(true)
    cross = true
    expect(validate(rules.rate.required, null)).toBe(false)
    expect(validate(rules.rate.positive, -1)).toBe(false)
  })

  it('holds a manual rate to the backend maximum', () => {
    const rules = transactionRules(
      (key) => key,
      options('PLN', () => true),
    )
    expect(validate(rules.rate.max, MANUAL_RATE_MAX)).toBe(true)
    expect(validate(rules.rate.max, MANUAL_RATE_MAX + 1)).toBe(false)
    expect(message(rules.rate.max)).toBe('validation.invalidValue')
  })

  it('holds the amount to the minor unit limit of the entered currency', () => {
    const jpy = transactionRules((key) => key, options('JPY'))
    expect(validate(jpy.amount.max, 100_000_000_000)).toBe(true)
    expect(validate(jpy.amount.max, 100_000_000_001)).toBe(false)
    const kwd = transactionRules((key) => key, options('KWD'))
    expect(validate(kwd.amount.max, 100_000_000)).toBe(true)
    expect(validate(kwd.amount.max, 100_000_001)).toBe(false)
    expect(validate(kwd.amount.positive, 0.001)).toBe(true)
    expect(message(kwd.amount.max)).toBe('validation.invalidValue')
  })

  it('checks lengths and maps failures to translation keys', () => {
    const rules = transactionRules((key) => key, options())
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

  it('limits the number and the length of tags', () => {
    const rules = transactionRules((key) => key, options())
    const names = (count: number) => Array.from({ length: count }, (_, index) => `tag${index}`)
    expect(validate(rules.tags.tooMany, names(TAGS_PER_TRANSACTION_MAX))).toBe(true)
    expect(validate(rules.tags.tooMany, names(TAGS_PER_TRANSACTION_MAX + 1))).toBe(false)
    expect(validate(rules.tags.tooLong, ['a'.repeat(TAG_NAME_MAX)])).toBe(true)
    expect(validate(rules.tags.tooLong, ['a'.repeat(TAG_NAME_MAX + 1)])).toBe(false)
    expect(message(rules.tags.tooMany)).toBe('validation.tooManyTags')
    expect(message(rules.tags.tooLong)).toBe('validation.tagTooLong')
  })

  it('needs an amount, a category and an account on the quick add screen', () => {
    const rules = quickAddRules((key) => key)
    expect(validate(rules.amount.positive, 0)).toBe(false)
    expect(message(rules.amount.positive)).toBe('validation.positiveAmount')
    expect(validate(rules.amount.max, 100_000_000_000)).toBe(true)
    expect(validate(rules.amount.max, 100_000_000_001)).toBe(false)
    expect(message(rules.amount.max)).toBe('validation.invalidValue')
    expect(validate(rules.categoryId.required, null)).toBe(false)
    expect(validate(rules.accountId.required, 'acc')).toBe(true)
  })
})

describe('tag rename rules', () => {
  const rules = tagRules(
    (key) => key,
    () => ['praca', 'Barcelona'],
  )

  it('requires a name', () => {
    expect(validate(rules.name.required, '')).toBe(false)
    expect(validate(rules.name.required, '   ')).toBe(false)
    expect(validate(rules.name.required, 'kino')).toBe(true)
    expect(message(rules.name.required)).toBe('validation.required')
  })

  it('limits the trimmed length', () => {
    expect(validate(rules.name.tooLong, 'a'.repeat(TAG_NAME_MAX))).toBe(true)
    expect(validate(rules.name.tooLong, ` ${'a'.repeat(TAG_NAME_MAX)} `)).toBe(true)
    expect(validate(rules.name.tooLong, 'a'.repeat(TAG_NAME_MAX + 1))).toBe(false)
    expect(message(rules.name.tooLong)).toBe('validation.tagTooLong')
  })

  it('refuses a name another tag has, ignoring case and surrounding spaces', () => {
    expect(validate(rules.name.taken, ' PRACA ')).toBe(false)
    expect(validate(rules.name.taken, 'barcelona')).toBe(false)
    expect(validate(rules.name.taken, 'kino')).toBe(true)
    expect(message(rules.name.taken)).toBe('validation.tagNameTaken')
  })

  it('allows the own name in another case because it is not among the other tags', () => {
    const own = tagRules(
      (key) => key,
      () => ['barcelona'],
    )
    expect(validate(own.name.taken, 'Praca')).toBe(true)
  })
})
