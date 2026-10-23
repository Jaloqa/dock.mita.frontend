import { describe, expect, it } from 'bun:test'
import { memberNameRules } from '../../../../app/features/groups/schemas/memberSchema'
import { GROUP_NAME_MAX } from '../../../../app/shared/api/contract'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

const build = (taken: string[] = []) =>
  memberNameRules(
    (key) => key,
    () => taken,
  )

describe('member name rules', () => {
  it('requires a name that is not blank', () => {
    const rules = build()
    expect(validate(rules.name.required, '')).toBe(false)
    expect(validate(rules.name.required, '   ')).toBe(false)
    expect(validate(rules.name.required, 'Tomek')).toBe(true)
    expect(message(rules.name.required)).toBe('validation.required')
  })

  it('allows at most 40 characters after trimming', () => {
    const rules = build()
    expect(validate(rules.name.maxLength, ` ${'x'.repeat(GROUP_NAME_MAX)} `)).toBe(true)
    expect(validate(rules.name.maxLength, 'x'.repeat(GROUP_NAME_MAX + 1))).toBe(false)
    expect(message(rules.name.maxLength)).toBe('validation.nameTooLong')
  })

  it('refuses a name another member already has, ignoring case and surrounding spaces', () => {
    const rules = build(['Olya', 'Max'])
    expect(validate(rules.name.unique, 'Tomek')).toBe(true)
    expect(validate(rules.name.unique, 'olya')).toBe(false)
    expect(validate(rules.name.unique, '  MAX ')).toBe(false)
    expect(message(rules.name.unique)).toBe('validation.memberNameTaken')
  })

  it('reads the taken names when it validates, not when the rules are built', () => {
    const taken = ['Olya']
    const rules = memberNameRules(
      (key) => key,
      () => taken,
    )
    expect(validate(rules.name.unique, 'Tomek')).toBe(true)
    taken.push('Tomek')
    expect(validate(rules.name.unique, 'tomek')).toBe(false)
  })
})
