import { describe, expect, it } from 'bun:test'
import { type ExpenseForm, expenseRules } from '../../../../app/features/groups/schemas/expenseSchema'
import { EXPENSE_DESCRIPTION_MAX, TAG_NAME_MAX } from '../../../../app/shared/api/contract'
import type { Currency } from '../../../../app/shared/money/currencies'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown, siblings: Partial<ExpenseForm> = {}): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, siblings, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

const build = (
  options: { crossCurrency?: boolean; currency?: Currency; maxDate?: Date; exactTotal?: number | undefined } = {},
) =>
  expenseRules((key) => key, {
    crossCurrency: () => options.crossCurrency ?? false,
    currency: () => options.currency ?? 'EUR',
    maxDate: () => options.maxDate ?? new Date(2027, 9, 23),
    exactTotal: () => ('exactTotal' in options ? options.exactTotal : 10_000),
  })

describe('expense form rules', () => {
  it('requires a payer', () => {
    const rules = build()
    expect(validate(rules.payerId.required, null)).toBe(false)
    expect(validate(rules.payerId.required, 'gmb_anna')).toBe(true)
    expect(message(rules.payerId.required)).toBe('validation.required')
  })

  it('requires a positive amount within the limit', () => {
    const rules = build()
    expect(validate(rules.amount.required, null)).toBe(false)
    expect(message(rules.amount.required)).toBe('validation.required')
    expect(validate(rules.amount.positive, 0)).toBe(false)
    expect(validate(rules.amount.positive, -5)).toBe(false)
    expect(validate(rules.amount.positive, 0.01)).toBe(true)
    expect(message(rules.amount.positive)).toBe('validation.positiveAmount')
    expect(validate(rules.amount.max, 1_000_000_000)).toBe(true)
    expect(validate(rules.amount.max, 1_000_000_000.01)).toBe(false)
    expect(message(rules.amount.max)).toBe('validation.invalidValue')
  })

  it('counts the amount limit in minor units of the currency', () => {
    const rules = build({ currency: 'JPY' })
    expect(validate(rules.amount.max, 100_000_000_000)).toBe(true)
    expect(validate(rules.amount.max, 100_000_000_001)).toBe(false)
  })

  it('requires a date at most one year ahead', () => {
    const rules = build({ maxDate: new Date(2027, 9, 23) })
    expect(validate(rules.date.required, null)).toBe(false)
    expect(message(rules.date.required)).toBe('validation.required')
    expect(validate(rules.date.notTooFar, new Date(2027, 9, 23))).toBe(true)
    expect(validate(rules.date.notTooFar, new Date(2027, 9, 24))).toBe(false)
    expect(message(rules.date.notTooFar)).toBe('validation.dateTooFar')
  })

  it('allows a description of at most 100 characters after trimming', () => {
    const rules = build()
    expect(validate(rules.description.maxLength, '')).toBe(true)
    expect(validate(rules.description.maxLength, ` ${'x'.repeat(EXPENSE_DESCRIPTION_MAX)} `)).toBe(true)
    expect(validate(rules.description.maxLength, 'x'.repeat(EXPENSE_DESCRIPTION_MAX + 1))).toBe(false)
    expect(message(rules.description.maxLength)).toBe('validation.titleTooLong')
  })

  it('allows tags of at most 30 characters and at most 10 of them', () => {
    const rules = build()
    expect(validate(rules.tags.tooLong, ['x'.repeat(TAG_NAME_MAX)])).toBe(true)
    expect(validate(rules.tags.tooLong, ['x'.repeat(TAG_NAME_MAX + 1)])).toBe(false)
    expect(message(rules.tags.tooLong)).toBe('validation.tagTooLong')
    const ten = Array.from({ length: 10 }, (_, index) => `tag ${index}`)
    expect(validate(rules.tags.tooMany, ten)).toBe(true)
    expect(validate(rules.tags.tooMany, [...ten, 'eleven'])).toBe(false)
    expect(message(rules.tags.tooMany)).toBe('validation.tooManyTags')
  })

  it('requires a rate only for another currency', () => {
    expect(validate(build({ crossCurrency: false }).rate.required, null)).toBe(true)
    const rules = build({ crossCurrency: true })
    expect(validate(rules.rate.required, null)).toBe(false)
    expect(validate(rules.rate.required, 0.25)).toBe(true)
    expect(message(rules.rate.required)).toBe('validation.required')
  })

  it('requires a positive rate within the manual rate limit', () => {
    const rules = build({ crossCurrency: true })
    expect(validate(rules.rate.positive, 0)).toBe(false)
    expect(validate(rules.rate.positive, 0.000001)).toBe(true)
    expect(message(rules.rate.positive)).toBe('validation.positiveAmount')
    expect(validate(rules.rate.max, 1_000_000_000)).toBe(true)
    expect(validate(rules.rate.max, 1_000_000_001)).toBe(false)
    expect(message(rules.rate.max)).toBe('validation.invalidValue')
  })

  it('asks for at least one member in an equal split', () => {
    const rules = build()
    expect(validate(rules.memberIds.chooseMembers, [], { splitMode: 'equal' })).toBe(false)
    expect(validate(rules.memberIds.chooseMembers, ['gmb_anna'], { splitMode: 'equal' })).toBe(true)
    expect(validate(rules.memberIds.chooseMembers, [], { splitMode: 'exact' })).toBe(true)
    expect(message(rules.memberIds.chooseMembers)).toBe('groups.expense.chooseMembers')
  })

  it('asks the exact amounts to add up to the amount', () => {
    const rules = build({ exactTotal: 10_000 })
    const exact = (values: Record<string, number | null>) =>
      validate(rules.exact.splitMismatch, values, { splitMode: 'exact' })
    expect(exact({ gmb_anna: 40, gmb_olya: 59.99 })).toBe(false)
    expect(exact({ gmb_anna: 40, gmb_olya: 60 })).toBe(true)
    expect(exact({ gmb_anna: 40, gmb_olya: 60, gmb_max: null })).toBe(true)
    expect(exact({ gmb_anna: 40, gmb_olya: 60.01 })).toBe(false)
    expect(exact({})).toBe(false)
    expect(message(rules.exact.splitMismatch)).toBe('validation.splitMismatch')
  })

  it('reads the exact amounts in the digits of the currency', () => {
    const rules = build({ currency: 'JPY', exactTotal: 1_000 })
    expect(validate(rules.exact.splitMismatch, { gmb_anna: 400, gmb_olya: 600 }, { splitMode: 'exact' })).toBe(true)
    const kwd = build({ currency: 'KWD', exactTotal: 1_000 })
    expect(validate(kwd.exact.splitMismatch, { gmb_anna: 0.4, gmb_olya: 0.6 }, { splitMode: 'exact' })).toBe(true)
    expect(validate(kwd.exact.splitMismatch, { gmb_anna: 0.4, gmb_olya: 0.599 }, { splitMode: 'exact' })).toBe(false)
  })

  it('checks the exact amounts only in exact mode and with a valid amount', () => {
    expect(validate(build().exact.splitMismatch, { gmb_anna: 1 }, { splitMode: 'equal' })).toBe(true)
    const rules = build({ exactTotal: undefined })
    expect(validate(rules.exact.splitMismatch, { gmb_anna: 1 }, { splitMode: 'exact' })).toBe(true)
  })
})
