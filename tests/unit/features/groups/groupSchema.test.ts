import { describe, expect, it } from 'bun:test'
import { faultyMemberRows, groupRules } from '../../../../app/features/groups/schemas/groupSchema'
import { GROUP_MEMBERS_MAX, GROUP_NAME_MAX } from '../../../../app/shared/api/contract'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown, siblings: Record<string, unknown> = {}): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, siblings, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

const build = (creating = true) => groupRules((key) => key, { creating: () => creating })

const members = (count: number) => Array.from({ length: count }, (_, index) => `Member ${index + 1}`)

describe('group form rules', () => {
  it('requires a name of at most 40 characters after trimming', () => {
    const rules = build()
    expect(validate(rules.name.required, '')).toBe(false)
    expect(validate(rules.name.required, '   ')).toBe(false)
    expect(validate(rules.name.required, 'Rome')).toBe(true)
    expect(message(rules.name.required)).toBe('validation.required')
    expect(validate(rules.name.maxLength, ` ${'x'.repeat(GROUP_NAME_MAX)} `)).toBe(true)
    expect(validate(rules.name.maxLength, 'x'.repeat(GROUP_NAME_MAX + 1))).toBe(false)
    expect(message(rules.name.maxLength)).toBe('validation.nameTooLong')
  })

  it('requires a main currency', () => {
    const rules = build()
    expect(validate(rules.currency.required, '')).toBe(false)
    expect(validate(rules.currency.required, 'EUR')).toBe(true)
    expect(message(rules.currency.required)).toBe('validation.required')
  })

  it('requires at least one member that is not blank', () => {
    const rules = build()
    expect(validate(rules.members.required, [])).toBe(false)
    expect(validate(rules.members.required, ['', ' '])).toBe(false)
    expect(validate(rules.members.required, ['', 'Max'])).toBe(true)
    expect(message(rules.members.required)).toBe('validation.required')
  })

  it('refuses a member name of more than 40 characters after trimming', () => {
    const rules = build()
    expect(validate(rules.members.nameLength, [` ${'x'.repeat(GROUP_NAME_MAX)} `])).toBe(true)
    expect(validate(rules.members.nameLength, ['Max', 'x'.repeat(GROUP_NAME_MAX + 1)])).toBe(false)
    expect(message(rules.members.nameLength)).toBe('validation.nameTooLong')
  })

  it('refuses more than 50 members and does not count blank rows', () => {
    const rules = build()
    expect(validate(rules.members.maxCount, members(GROUP_MEMBERS_MAX))).toBe(true)
    expect(validate(rules.members.maxCount, members(GROUP_MEMBERS_MAX + 1))).toBe(false)
    expect(validate(rules.members.maxCount, [...members(GROUP_MEMBERS_MAX), '', ' '])).toBe(true)
    expect(message(rules.members.maxCount)).toBe('validation.tooManyMembers')
  })

  it('refuses two members with the same name ignoring case and surrounding spaces', () => {
    const rules = build()
    expect(validate(rules.members.unique, ['Max', 'Anna'])).toBe(true)
    expect(validate(rules.members.unique, ['Max', ' max'])).toBe(false)
    expect(validate(rules.members.unique, ['Ольга', 'ОЛЬГА '])).toBe(false)
    expect(validate(rules.members.unique, ['Max', '', ' '])).toBe(true)
    expect(message(rules.members.unique)).toBe('validation.memberNameTaken')
  })

  it('ignores the members when editing', () => {
    const rules = build(false)
    expect(validate(rules.members.required, [])).toBe(true)
    expect(validate(rules.members.nameLength, ['x'.repeat(GROUP_NAME_MAX + 1)])).toBe(true)
    expect(validate(rules.members.maxCount, members(GROUP_MEMBERS_MAX + 1))).toBe(true)
    expect(validate(rules.members.unique, ['Max', 'max'])).toBe(true)
  })
})

describe('faulty member rows', () => {
  it('points at the first row when every row is blank', () => {
    expect(faultyMemberRows(['', ' ', ''])).toEqual(new Set([0]))
  })

  it('points at the rows that are too long and at later duplicates', () => {
    expect(faultyMemberRows(['Max', 'x'.repeat(GROUP_NAME_MAX + 1), 'Anna', ' MAX', 'anna'])).toEqual(
      new Set([1, 3, 4]),
    )
  })

  it('points at nothing when the rows are fine', () => {
    expect(faultyMemberRows(['Max', '', 'Anna'])).toEqual(new Set())
  })
})
