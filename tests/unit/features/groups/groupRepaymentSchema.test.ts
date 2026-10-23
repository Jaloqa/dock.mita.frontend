import { describe, expect, it } from 'bun:test'
import {
  type GroupRepaymentForm,
  groupRepaymentRules,
} from '../../../../app/features/groups/schemas/groupRepaymentSchema'
import { GROUP_NOTE_MAX } from '../../../../app/shared/api/contract'
import type { Currency } from '../../../../app/shared/money/currencies'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown, siblings: Partial<GroupRepaymentForm> = {}): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, siblings, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

const build = (options: { crossCurrency?: boolean; currency?: Currency; maxDate?: Date } = {}) =>
  groupRepaymentRules((key) => key, {
    crossCurrency: () => options.crossCurrency ?? false,
    currency: () => options.currency ?? 'EUR',
    maxDate: () => options.maxDate ?? new Date(2027, 9, 23),
  })

describe('group repayment form rules', () => {
  it('requires both members', () => {
    const rules = build()
    expect(validate(rules.fromMemberId.required, null)).toBe(false)
    expect(validate(rules.fromMemberId.required, 'gmb_max')).toBe(true)
    expect(message(rules.fromMemberId.required)).toBe('validation.required')
    expect(validate(rules.toMemberId.required, null)).toBe(false)
    expect(validate(rules.toMemberId.required, 'gmb_anna')).toBe(true)
    expect(message(rules.toMemberId.required)).toBe('validation.required')
  })

  it('refuses the same member on both sides', () => {
    const rules = build()
    expect(validate(rules.toMemberId.differentMember, 'gmb_max', { fromMemberId: 'gmb_max' })).toBe(false)
    expect(validate(rules.toMemberId.differentMember, 'gmb_anna', { fromMemberId: 'gmb_max' })).toBe(true)
    expect(message(rules.toMemberId.differentMember)).toBe('validation.sameMember')
  })

  it('does not call a missing member the same member', () => {
    const rules = build()
    expect(validate(rules.toMemberId.differentMember, null, { fromMemberId: null })).toBe(true)
    expect(validate(rules.toMemberId.differentMember, null, { fromMemberId: 'gmb_max' })).toBe(true)
    expect(validate(rules.toMemberId.differentMember, 'gmb_anna', { fromMemberId: null })).toBe(true)
  })

  it('requires a positive amount within the limit', () => {
    const rules = build()
    expect(validate(rules.amount.required, null)).toBe(false)
    expect(message(rules.amount.required)).toBe('validation.required')
    expect(validate(rules.amount.positive, 0)).toBe(false)
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

  it('allows a note of at most 200 characters after trimming', () => {
    const rules = build()
    expect(validate(rules.note.maxLength, '')).toBe(true)
    expect(validate(rules.note.maxLength, ` ${'x'.repeat(GROUP_NOTE_MAX)} `)).toBe(true)
    expect(validate(rules.note.maxLength, 'x'.repeat(GROUP_NOTE_MAX + 1))).toBe(false)
    expect(message(rules.note.maxLength)).toBe('validation.noteTooLong')
  })
})
