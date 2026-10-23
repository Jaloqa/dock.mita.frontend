import { describe, expect, it } from 'bun:test'
import { groupCategoryRules } from '../../../../app/features/groups/schemas/groupCategorySchema'
import { GROUP_NAME_MAX } from '../../../../app/shared/api/contract'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

const build = (taken: string[] = []) =>
  groupCategoryRules(
    (key) => key,
    () => taken,
  )

describe('group category rules', () => {
  it('requires a name that is not blank', () => {
    const rules = build()
    expect(validate(rules.name.required, '')).toBe(false)
    expect(validate(rules.name.required, '  ')).toBe(false)
    expect(validate(rules.name.required, 'Ferry')).toBe(true)
    expect(message(rules.name.required)).toBe('validation.required')
  })

  it('allows at most 40 characters after trimming', () => {
    const rules = build()
    expect(validate(rules.name.maxLength, ` ${'x'.repeat(GROUP_NAME_MAX)} `)).toBe(true)
    expect(validate(rules.name.maxLength, 'x'.repeat(GROUP_NAME_MAX + 1))).toBe(false)
    expect(message(rules.name.maxLength)).toBe('validation.nameTooLong')
  })

  it('refuses a name the group already offers, ignoring case and surrounding spaces', () => {
    const rules = build(['Beach', 'Groceries'])
    expect(validate(rules.name.unique, 'Ferry')).toBe(true)
    expect(validate(rules.name.unique, ' beach ')).toBe(false)
    expect(validate(rules.name.unique, 'GROCERIES')).toBe(false)
    expect(message(rules.name.unique)).toBe('validation.categoryNameTaken')
  })
})
