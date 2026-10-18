import { describe, expect, it } from 'bun:test'
import { isPublicRoute } from '../../../app/shared/auth/publicRoutes'

describe('isPublicRoute', () => {
  it.each(['login', 'register'])('treats %s as public', (name) => {
    expect(isPublicRoute(name)).toBe(true)
  })

  it.each(['index', 'budgets', 'settings', 'login-help', Symbol('login'), undefined])(
    'requires a session for %s',
    (name) => {
      expect(isPublicRoute(name)).toBe(false)
    },
  )
})
