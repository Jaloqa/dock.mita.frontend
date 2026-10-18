import { describe, expect, it } from 'bun:test'
import { authMessageKey } from '../../../../app/features/auth/utils/authMessage'
import { demoAccounts } from '../../../../app/features/auth/utils/demoAccounts'
import { ApiError } from '../../../../app/shared/api/problem'
import { DEMO_PASSWORD } from '../../../../mocks/handlers/auth'
import { demoUsers } from '../../../../mocks/seed/users'

describe('auth message', () => {
  it('explains wrong credentials, rate limits and expired sessions', () => {
    expect(authMessageKey(new ApiError({ status: 401, title: 'Unauthorized', code: 'auth.invalidCredentials' }))).toBe(
      'auth.errors.invalidCredentials',
    )
    expect(authMessageKey(new ApiError({ status: 429, title: 'Too many requests' }))).toBe(
      'auth.errors.tooManyAttempts',
    )
    expect(authMessageKey(new ApiError({ status: 401, title: 'Unauthorized', code: 'auth.sessionExpired' }))).toBe(
      'auth.errors.sessionExpired',
    )
  })

  it('falls back to the generic error messages', () => {
    expect(authMessageKey(new ApiError({ status: 503, title: 'Server error' }))).toBe('shared.error.server')
    expect(
      authMessageKey(new ApiError({ status: 400, title: 'Bad', errors: { body: ['validation.invalidValue'] } })),
    ).toBe('validation.invalidValue')
    expect(authMessageKey(new Error('network'))).toBe('shared.error.unknown')
  })
})

describe('demo accounts hint', () => {
  it('matches the seeded demo users and their password', () => {
    expect(demoAccounts.emails).toEqual(demoUsers().map((user) => user.email))
    expect(demoAccounts.password).toBe(DEMO_PASSWORD)
  })
})
