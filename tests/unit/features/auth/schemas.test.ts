import { describe, expect, it } from 'bun:test'
import {
  EMAIL_MAX,
  isEmailAddress,
  loginRules,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  registerRules,
} from '../../../../app/features/auth/schemas/authSchema'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

describe('register form rules', () => {
  const rules = registerRules((key) => key)

  it('requires a name of at most 40 characters after trimming', () => {
    expect(validate(rules.name.required, '   ')).toBe(false)
    expect(validate(rules.name.required, 'Anna')).toBe(true)
    expect(validate(rules.name.maxLength, ` ${'a'.repeat(NAME_MAX)} `)).toBe(true)
    expect(validate(rules.name.maxLength, 'a'.repeat(NAME_MAX + 1))).toBe(false)
  })

  it('requires an email of at most 254 characters in a valid format', () => {
    expect(validate(rules.email.required, '')).toBe(false)
    expect(validate(rules.email.format, 'anna@demo.mita.app')).toBe(true)
    expect(validate(rules.email.format, ' anna@demo.mita.app ')).toBe(true)
    expect(validate(rules.email.format, 'anna@demo')).toBe(false)
    expect(validate(rules.email.format, 'an na@demo.pl')).toBe(false)
    expect(isEmailAddress(`${'a'.repeat(EMAIL_MAX - 8)}@demo.pl`)).toBe(true)
    expect(isEmailAddress(`${'a'.repeat(EMAIL_MAX - 7)}@demo.pl`)).toBe(false)
  })

  it('requires a password of 10 to 128 characters', () => {
    expect(validate(rules.password.required, '')).toBe(false)
    expect(validate(rules.password.minLength, 'a'.repeat(PASSWORD_MIN - 1))).toBe(false)
    expect(validate(rules.password.minLength, 'a'.repeat(PASSWORD_MIN))).toBe(true)
    expect(validate(rules.password.maxLength, 'a'.repeat(PASSWORD_MAX))).toBe(true)
    expect(validate(rules.password.maxLength, 'a'.repeat(PASSWORD_MAX + 1))).toBe(false)
  })

  it('maps rule failures to the same translation keys as the server', () => {
    expect(message(rules.name.required)).toBe('validation.required')
    expect(message(rules.name.maxLength)).toBe('validation.nameTooLong')
    expect(message(rules.email.format)).toBe('validation.invalidEmail')
    expect(message(rules.password.minLength)).toBe('validation.passwordTooShort')
    expect(message(rules.password.maxLength)).toBe('validation.passwordTooLong')
  })
})

describe('login form rules', () => {
  const rules = loginRules((key) => key)

  it('requires an email in a valid format and any password', () => {
    expect(validate(rules.email.required, ' ')).toBe(false)
    expect(validate(rules.email.format, 'anna@')).toBe(false)
    expect(validate(rules.password.required, '')).toBe(false)
    expect(validate(rules.password.required, 'short')).toBe(true)
    expect(Object.keys(rules.password)).toEqual(['required'])
  })
})
