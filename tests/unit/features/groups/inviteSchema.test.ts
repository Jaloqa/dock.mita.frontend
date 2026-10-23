import { describe, expect, it } from 'bun:test'
import { inviteRules } from '../../../../app/features/groups/schemas/inviteSchema'
import { EMAIL_MAX } from '../../../../app/shared/utils/email'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

const rules = inviteRules((key) => key)

describe('invite rules', () => {
  it('requires an email that is not blank', () => {
    expect(validate(rules.email.required, '')).toBe(false)
    expect(validate(rules.email.required, '   ')).toBe(false)
    expect(validate(rules.email.required, 'olya@example.com')).toBe(true)
    expect(message(rules.email.required)).toBe('validation.required')
  })

  it('accepts an address, ignoring surrounding spaces', () => {
    expect(validate(rules.email.format, 'olya@example.com')).toBe(true)
    expect(validate(rules.email.format, '  Olya.Nowak+trip@Example.com ')).toBe(true)
  })

  it.each(['no-at-sign', 'olya@', '@example.com', 'olya@example', 'ol ya@example.com'])(
    'refuses %p as an address',
    (value) => {
      expect(validate(rules.email.format, value)).toBe(false)
    },
  )

  it('refuses an address longer than 254 characters, as the server does', () => {
    const local = (length: number) => 'a'.repeat(length - '@example.com'.length)
    expect(validate(rules.email.format, `${local(EMAIL_MAX)}@example.com`)).toBe(true)
    expect(validate(rules.email.format, `${local(EMAIL_MAX + 1)}@example.com`)).toBe(false)
    expect(message(rules.email.format)).toBe('validation.invalidEmail')
  })
})
