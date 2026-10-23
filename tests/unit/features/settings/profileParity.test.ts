import { describe, expect, it } from 'bun:test'
import { PROFILE_NAME_MAX, profileRules } from '../../../../app/features/settings/schemas/profileSchema'
import { EMAIL_MAX } from '../../../../app/shared/utils/email'
import { loggedInMockApi } from '../../mocks/session'

type Rule = { $validator: unknown }

const passes = (rules: Record<string, Rule>, value: string): boolean =>
  Object.values(rules).every(
    (rule) => (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true,
  )

const rules = profileRules((key) => key)

async function serverAccepts(field: 'name' | 'email', value: string): Promise<boolean> {
  const body = { name: 'Anna Nowak', email: 'anna@demo.mita.app', [field]: value }
  const error = await loggedInMockApi()
    .handle({ method: 'PUT', path: '/v1/me', body })
    .then(() => undefined)
    .catch((e: unknown) => e as { problem?: { errors?: Record<string, string[]> } })
  return error?.problem?.errors?.[field] === undefined
}

const local = (length: number) => 'a'.repeat(length - '@demo.pl'.length)

const names = [
  '',
  '   ',
  ' \t\n',
  'Anna',
  '  Anna Nowak  ',
  'a'.repeat(PROFILE_NAME_MAX),
  ` ${'a'.repeat(PROFILE_NAME_MAX)}\t`,
  'a'.repeat(PROFILE_NAME_MAX + 1),
  '😀'.repeat(PROFILE_NAME_MAX / 2),
  '😀'.repeat(PROFILE_NAME_MAX / 2 + 1),
]

const emails = [
  '',
  '   ',
  'anna@demo.mita.app',
  ' ANNA@Demo.Mita.App ',
  'a@b.c',
  'anna@',
  '@demo.pl',
  'anna@demo',
  'anna@demo.',
  'an na@demo.pl',
  'anna@@demo.pl',
  'anna@demo..pl',
  'anna.nowak+budget@demo.pl',
  `${local(EMAIL_MAX)}@demo.pl`,
  `  ${local(EMAIL_MAX)}@demo.pl  `,
  `${local(EMAIL_MAX + 1)}@demo.pl`,
]

describe('profile rules match the PUT /v1/me validation', () => {
  it.each(names)('agrees on the name %p', async (name) => {
    expect(passes(rules.name, name)).toBe(await serverAccepts('name', name))
  })

  it.each(emails)('agrees on the email %p', async (email) => {
    expect(passes(rules.email, email)).toBe(await serverAccepts('email', email))
  })
})
