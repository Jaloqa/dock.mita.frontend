import { describe, expect, it } from 'bun:test'
import { createMockApi, type MockApi } from '../../../mocks/api'
import { createDb, type KeyValueStorage, STORAGE_KEY } from '../../../mocks/db'
import { defaultHandlers } from '../../../mocks/handlers'
import { DEMO_PASSWORD } from '../../../mocks/handlers/auth'
import { seedState } from '../../../mocks/seed'

const anonymous = () => createMockApi({ register: defaultHandlers })

const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)

const post = (api: MockApi, path: string, body?: unknown) => api.handle({ method: 'POST', path, body })

const register = (api: MockApi, overrides: Record<string, unknown> = {}) =>
  post(api, '/v1/auth/register', {
    name: 'Jan Kowalski',
    email: 'jan@example.com',
    password: 'long-enough-password',
    ...overrides,
  })

const registerErrors = async (overrides: Record<string, unknown>) =>
  ((await failure(register(anonymous(), overrides))) as { problem: { errors: Record<string, string[]> } }).problem
    .errors

const storageOf = (stored: string): KeyValueStorage => ({
  getItem: (key) => (key === STORAGE_KEY ? stored : null),
  setItem: () => {},
})

describe('mock auth', () => {
  it('starts anonymous and answers 401 outside the auth paths', async () => {
    const api = anonymous()
    expect(api.db.state.activeUserId).toBeNull()
    expect(await failure(api.handle({ method: 'GET', path: '/v1/me' }))).toMatchObject({
      problem: { status: 401, code: 'auth.sessionExpired' },
    })
  })

  it('registers a user, logs in and serves the new profile', async () => {
    const api = anonymous()
    const created = (await register(api)) as { id: string; email: string }
    expect(created).toMatchObject({ name: 'Jan Kowalski', email: 'jan@example.com' })
    expect(created).not.toHaveProperty('password')
    expect(await api.handle({ method: 'GET', path: '/v1/me' })).toEqual(created)
  })

  it('creates default settings and no demo data for a registered user', async () => {
    const api = anonymous()
    await register(api)
    expect(await api.handle({ method: 'GET', path: '/v1/settings' })).toEqual({
      baseCurrency: 'PLN',
      locale: 'en',
      monthStartDay: 1,
      theme: 'system',
      notifications: { budgetLimit: true, dailyReminder: true, weeklyReport: false, goals: true },
    })
    expect(await api.handle({ method: 'GET', path: '/v1/accounts' })).toMatchObject({ total: 0 })
  })

  it('trims the name and email on register', async () => {
    const created = await register(anonymous(), { name: '  Jan  ', email: '  jan@example.com ' })
    expect(created).toMatchObject({ name: 'Jan', email: 'jan@example.com' })
  })

  it('validates register fields with the backend codes', async () => {
    expect(await registerErrors({ name: ' ', email: null, password: undefined })).toEqual({
      name: ['validation.required'],
      email: ['validation.required'],
      password: ['validation.required'],
    })
    expect(await registerErrors({ name: 'a'.repeat(41) })).toEqual({ name: ['validation.nameTooLong'] })
    expect(await registerErrors({ email: 'nope' })).toEqual({ email: ['validation.invalidEmail'] })
    expect(await registerErrors({ email: 5 })).toEqual({ email: ['validation.invalidValue'] })
    expect(await registerErrors({ password: 'short' })).toEqual({ password: ['validation.passwordTooShort'] })
    expect(await registerErrors({ password: 'a'.repeat(9) })).toEqual({ password: ['validation.passwordTooShort'] })
    expect(await registerErrors({ password: 'a'.repeat(129) })).toEqual({ password: ['validation.passwordTooLong'] })
    expect(await registerErrors({ password: 1234567890 })).toEqual({ password: ['validation.invalidValue'] })
  })

  it('accepts passwords of 10 and 128 characters', async () => {
    expect(await register(anonymous(), { password: 'a'.repeat(10) })).toMatchObject({ email: 'jan@example.com' })
    expect(await register(anonymous(), { password: 'a'.repeat(128) })).toMatchObject({ email: 'jan@example.com' })
  })

  it('rejects an email that another account uses, ignoring case', async () => {
    expect(await registerErrors({ email: 'ANNA@demo.mita.app' })).toEqual({ email: ['validation.emailTaken'] })
  })

  it('logs in a demo user with the demo password', async () => {
    const api = anonymous()
    expect(await post(api, '/v1/auth/login', { email: 'anna@demo.mita.app', password: DEMO_PASSWORD })).toMatchObject({
      id: 'usr_anna',
    })
    expect(await api.handle({ method: 'GET', path: '/v1/me' })).toMatchObject({ id: 'usr_anna' })
  })

  it('logs in a registered user again after logout', async () => {
    const api = anonymous()
    const created = await register(api)
    await post(api, '/v1/auth/logout')
    expect(await post(api, '/v1/auth/login', { email: 'JAN@example.com', password: 'long-enough-password' })).toEqual(
      created,
    )
  })

  it('answers 401 invalidCredentials for a wrong password or unknown email', async () => {
    const api = anonymous()
    const expected = { problem: { status: 401, code: 'auth.invalidCredentials' } }
    expect(
      await failure(post(api, '/v1/auth/login', { email: 'anna@demo.mita.app', password: 'wrong' })),
    ).toMatchObject(expected)
    expect(await failure(post(api, '/v1/auth/login', { email: 'x@y.pl', password: DEMO_PASSWORD }))).toMatchObject(
      expected,
    )
    expect(api.db.state.activeUserId).toBeNull()
  })

  it('requires email and password on login', async () => {
    expect(await failure(post(anonymous(), '/v1/auth/login', {}))).toMatchObject({
      problem: { status: 400, errors: { email: ['validation.required'], password: ['validation.required'] } },
    })
  })

  it('refreshes with 204 when logged in and 401 sessionExpired otherwise', async () => {
    const api = anonymous()
    expect(await failure(post(api, '/v1/auth/refresh'))).toMatchObject({
      problem: { status: 401, code: 'auth.sessionExpired' },
    })
    await post(api, '/v1/auth/login', { email: 'oleh@demo.mita.app', password: DEMO_PASSWORD })
    expect(await post(api, '/v1/auth/refresh')).toBeUndefined()
  })

  it('logs out with 204 and answers 401 afterwards', async () => {
    const api = anonymous()
    await post(api, '/v1/auth/login', { email: 'anna@demo.mita.app', password: DEMO_PASSWORD })
    expect(await post(api, '/v1/auth/logout')).toBeUndefined()
    expect(api.db.state.activeUserId).toBeNull()
    expect(await failure(api.handle({ method: 'GET', path: '/v1/accounts' }))).toMatchObject({
      problem: { status: 401 },
    })
  })

  it('keeps the demo state and user switch reachable without a session', async () => {
    const api = anonymous()
    expect(await api.handle({ method: 'GET', path: '/v1/demo/state' })).toMatchObject({ activeUserId: null })
    expect(await post(api, '/v1/demo/switch-user', { userId: 'usr_oleh' })).toMatchObject({ activeUserId: 'usr_oleh' })
    expect(await api.handle({ method: 'GET', path: '/v1/me' })).toMatchObject({ id: 'usr_oleh' })
  })

  it('keeps the session on reset when the user exists in the seed', async () => {
    const api = anonymous()
    await post(api, '/v1/auth/login', { email: 'anna@demo.mita.app', password: DEMO_PASSWORD })
    expect(await post(api, '/v1/demo/reset')).toMatchObject({ activeUserId: 'usr_anna' })
  })

  it('logs out on reset when the user is not in the seed', async () => {
    const api = anonymous()
    await register(api)
    expect(await post(api, '/v1/demo/reset')).toMatchObject({ activeUserId: null })
  })

  it('forgets registered users and passwords on reset', async () => {
    const api = anonymous()
    await register(api)
    await post(api, '/v1/demo/reset')
    expect(
      await failure(post(api, '/v1/auth/login', { email: 'jan@example.com', password: 'long-enough-password' })),
    ).toMatchObject({ problem: { status: 401 } })
  })
})

describe('mock db session persistence', () => {
  it('keeps a stored logged-in state instead of discarding it', () => {
    const stored = JSON.stringify({ ...seedState(), activeUserId: 'usr_oleh' })
    expect(createDb(storageOf(stored), seedState).state.activeUserId).toBe('usr_oleh')
  })

  it('keeps a stored anonymous state', () => {
    const stored = JSON.stringify({ ...seedState(), simulateErrors: true })
    const state = createDb(storageOf(stored), seedState).state
    expect(state.activeUserId).toBeNull()
    expect(state.simulateErrors).toBe(true)
  })
})
