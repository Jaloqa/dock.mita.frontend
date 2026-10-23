import { describe, expect, it } from 'bun:test'
import { isOpenRoute, isPublicRoute } from '../../../app/shared/auth/publicRoutes'

describe('isPublicRoute', () => {
  it.each(['login', 'register'])('treats %s as public', (name) => {
    expect(isPublicRoute(name)).toBe(true)
  })

  it.each(['index', 'budgets', 'settings', 'login-help', 'g-token', Symbol('login'), undefined])(
    'requires a session for %s',
    (name) => {
      expect(isPublicRoute(name)).toBe(false)
    },
  )
})

describe('isOpenRoute', () => {
  it('opens the page of a group share link to everybody', () => {
    expect(isOpenRoute('g-token')).toBe(true)
  })

  it.each(['login', 'register', 'index', 'tools-groups-id', 'g-token-x', Symbol('g-token'), undefined])(
    'keeps %s closed',
    (name) => {
      expect(isOpenRoute(name)).toBe(false)
    },
  )
})
