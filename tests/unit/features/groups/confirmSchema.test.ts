import { describe, expect, it } from 'bun:test'
import { confirmLineRules, confirmRules, NEW_CATEGORY } from '../../../../app/features/groups/schemas/confirmSchema'
import { TAG_NAME_MAX, TAGS_PER_TRANSACTION_MAX } from '../../../../app/shared/api/contract'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

const build = (crossCurrency = false) => confirmRules((key) => key, { crossCurrency: () => crossCurrency })

describe('confirm form rules', () => {
  it('requires an account', () => {
    const rules = build()
    expect(validate(rules.accountId.required, null)).toBe(false)
    expect(validate(rules.accountId.required, 'acc_anna_cash')).toBe(true)
    expect(message(rules.accountId.required)).toBe('validation.required')
  })

  it('requires a rate only for another currency', () => {
    expect(validate(build(false).rate.required, null)).toBe(true)
    expect(validate(build(true).rate.required, null)).toBe(false)
    expect(validate(build(true).rate.required, 4.25)).toBe(true)
    expect(message(build(true).rate.required)).toBe('validation.required')
  })

  it('requires a positive rate within the limit', () => {
    const rules = build(true)
    expect(validate(rules.rate.positive, 0)).toBe(false)
    expect(validate(rules.rate.positive, 0.0001)).toBe(true)
    expect(message(rules.rate.positive)).toBe('validation.positiveAmount')
    expect(validate(rules.rate.max, 1_000_000_000)).toBe(true)
    expect(validate(rules.rate.max, 1_000_000_001)).toBe(false)
    expect(message(rules.rate.max)).toBe('validation.invalidValue')
  })
})

describe('confirm line rules', () => {
  const rules = confirmLineRules((key) => key)

  it('requires a category, existing or new', () => {
    expect(validate(rules.categoryId.required, null)).toBe(false)
    expect(validate(rules.categoryId.required, 'cat_anna_expense_cafes')).toBe(true)
    expect(validate(rules.categoryId.required, NEW_CATEGORY)).toBe(true)
    expect(message(rules.categoryId.required)).toBe('validation.required')
  })

  it('keeps the title within 100 characters after trimming', () => {
    expect(validate(rules.title.maxLength, 'a'.repeat(100))).toBe(true)
    expect(validate(rules.title.maxLength, `  ${'a'.repeat(100)}  `)).toBe(true)
    expect(validate(rules.title.maxLength, 'a'.repeat(101))).toBe(false)
    expect(message(rules.title.maxLength)).toBe('validation.titleTooLong')
  })

  it('allows at most ten tags of a limited length', () => {
    const tags = (count: number) => Array.from({ length: count }, (_, index) => `tag${index}`)
    expect(validate(rules.tags.tooMany, tags(TAGS_PER_TRANSACTION_MAX))).toBe(true)
    expect(validate(rules.tags.tooMany, tags(TAGS_PER_TRANSACTION_MAX + 1))).toBe(false)
    expect(message(rules.tags.tooMany)).toBe('validation.tooManyTags')
    expect(validate(rules.tags.tooLong, ['a'.repeat(TAG_NAME_MAX)])).toBe(true)
    expect(validate(rules.tags.tooLong, ['a'.repeat(TAG_NAME_MAX + 1)])).toBe(false)
    expect(message(rules.tags.tooLong)).toBe('validation.tagTooLong')
  })
})
