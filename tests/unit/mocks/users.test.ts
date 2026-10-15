import { describe, expect, it } from 'bun:test'
import type { SettingsDto } from '../../../app/shared/api/contract'
import { createMockApi } from '../../../mocks/api'
import { defaultHandlers } from '../../../mocks/handlers'

const api = () => createMockApi({ register: defaultHandlers })

const validSettings: SettingsDto = {
  baseCurrency: 'EUR',
  locale: 'en',
  monthStartDay: 'lastWorkingDay',
  theme: 'light',
  notifications: { budgetLimit: false, dailyReminder: false, weeklyReport: true, goals: true },
}

describe('user endpoints', () => {
  it('returns the active demo user without settings fields', async () => {
    expect(await api().handle({ method: 'GET', path: '/v1/me' })).toEqual({
      id: 'usr_anna',
      name: 'Anna Nowak',
      email: 'anna@demo.mita.app',
      createdAt: '2026-04-01T09:00:00Z',
    })
  })

  it('returns settings without userId', async () => {
    const settings = await api().handle({ method: 'GET', path: '/v1/settings' })
    expect(settings).toEqual({
      baseCurrency: 'PLN',
      locale: 'pl',
      monthStartDay: 1,
      theme: 'system',
      notifications: { budgetLimit: true, dailyReminder: true, weeklyReport: false, goals: true },
    })
  })

  it('updates settings of the active user only', async () => {
    const mock = api()
    expect(await mock.handle({ method: 'PUT', path: '/v1/settings', body: validSettings })).toEqual(validSettings)
    await mock.handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_oleh' } })
    expect(await mock.handle({ method: 'GET', path: '/v1/settings' })).toMatchObject({ baseCurrency: 'UAH' })
  })

  it('rejects invalid settings with field errors', async () => {
    const error = await api()
      .handle({
        method: 'PUT',
        path: '/v1/settings',
        body: { ...validSettings, baseCurrency: 'GBP', monthStartDay: 31, locale: undefined },
      })
      .catch((e: unknown) => e)
    expect(error).toMatchObject({
      problem: {
        status: 400,
        errors: {
          baseCurrency: ['validation.invalidValue'],
          monthStartDay: ['validation.invalidValue'],
          locale: ['validation.required'],
        },
      },
    })
  })

  it('rejects a body that is not an object', async () => {
    const error = await api()
      .handle({ method: 'PUT', path: '/v1/settings', body: 'x' })
      .catch((e: unknown) => e)
    expect(error).toMatchObject({ problem: { status: 400 } })
  })
})

describe('demo endpoints', () => {
  it('lists demo users and the active one', async () => {
    expect(await api().handle({ method: 'GET', path: '/v1/demo/state' })).toEqual({
      activeUserId: 'usr_anna',
      users: [
        { id: 'usr_anna', name: 'Anna Nowak' },
        { id: 'usr_oleh', name: 'Oleh Kravets' },
      ],
      simulateErrors: false,
    })
  })

  it('switches the session user', async () => {
    const mock = api()
    await mock.handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_oleh' } })
    expect(await mock.handle({ method: 'GET', path: '/v1/me' })).toMatchObject({ id: 'usr_oleh' })
  })

  it('refuses to switch to an unknown user', async () => {
    const error = await api()
      .handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_ghost' } })
      .catch((e: unknown) => e)
    expect(error).toMatchObject({ problem: { status: 400, errors: { userId: ['validation.invalidValue'] } } })
  })

  it('toggles simulated errors and resets everything', async () => {
    const mock = api()
    await mock.handle({ method: 'PUT', path: '/v1/demo/simulate-errors', body: { enabled: true } })
    expect(mock.db.state.simulateErrors).toBe(true)
    await mock.handle({ method: 'POST', path: '/v1/demo/reset' })
    expect(mock.db.state.simulateErrors).toBe(false)
    expect(mock.db.state.activeUserId).toBe('usr_anna')
  })
})
