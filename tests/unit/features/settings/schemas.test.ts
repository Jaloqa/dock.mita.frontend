import { describe, expect, it } from 'bun:test'
import {
  EMAIL_MAX,
  fitsProfileName,
  isEmailAddress,
  PROFILE_NAME_MAX,
  profileRules,
} from '../../../../app/features/settings/schemas/profileSchema'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

describe('profile form rules', () => {
  const rules = profileRules((key) => key)

  it('requires a name of at most 40 characters, ignoring surrounding spaces', () => {
    expect(validate(rules.name.required, '   ')).toBe(false)
    expect(validate(rules.name.required, 'Anna')).toBe(true)
    expect(fitsProfileName('a'.repeat(PROFILE_NAME_MAX))).toBe(true)
    expect(fitsProfileName(` ${'a'.repeat(PROFILE_NAME_MAX)} `)).toBe(true)
    expect(fitsProfileName('a'.repeat(PROFILE_NAME_MAX + 1))).toBe(false)
    expect(validate(rules.name.maxLength, 'a'.repeat(PROFILE_NAME_MAX + 1))).toBe(false)
  })

  it('requires an email address in a valid format', () => {
    expect(validate(rules.email.required, '')).toBe(false)
    expect(isEmailAddress('anna@demo.mita.app')).toBe(true)
    expect(isEmailAddress(' anna@demo.mita.app ')).toBe(true)
    expect(isEmailAddress('')).toBe(true)
    expect(isEmailAddress('anna@')).toBe(false)
    expect(isEmailAddress('anna@demo')).toBe(false)
    expect(isEmailAddress('an na@demo.pl')).toBe(false)
    expect(isEmailAddress(`${'a'.repeat(EMAIL_MAX - 8)}@demo.pl`)).toBe(true)
    expect(isEmailAddress(`${'a'.repeat(EMAIL_MAX - 7)}@demo.pl`)).toBe(false)
    expect(validate(rules.email.format, 'anna@')).toBe(false)
  })

  it('maps rule failures to the same translation keys as the server', () => {
    expect(message(rules.name.required)).toBe('validation.required')
    expect(message(rules.name.maxLength)).toBe('validation.nameTooLong')
    expect(message(rules.email.required)).toBe('validation.required')
    expect(message(rules.email.format)).toBe('validation.invalidEmail')
  })
})
