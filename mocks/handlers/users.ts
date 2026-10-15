import {
  type Locale,
  locales,
  type NotificationPrefs,
  type SettingsDto,
  type ThemePreference,
  themePreferences,
  type UserDto,
} from '../../app/shared/api/contract'
import { type Currency, currencies } from '../../app/shared/money/money'
import type { MonthStart } from '../../app/shared/period/period'
import type { MockDb, SettingsRow } from '../db'
import { badRequest, notFound } from '../errors'
import type { MockRouter } from '../router'

const notificationKeys: (keyof NotificationPrefs)[] = ['budgetLimit', 'dailyReminder', 'weeklyReport', 'goals']

const findSettings = (db: MockDb, userId: string): SettingsRow =>
  db.state.settings.find((row) => row.userId === userId) ?? notFound()

export const toSettingsDto = ({ userId: _userId, ...settings }: SettingsRow): SettingsDto => settings

const isMonthStart = (value: unknown): value is MonthStart =>
  value === 'lastWorkingDay' || (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 28)

const isNotifications = (value: unknown): value is NotificationPrefs =>
  typeof value === 'object' &&
  value !== null &&
  notificationKeys.every((key) => typeof (value as Record<string, unknown>)[key] === 'boolean')

function validateSettings(body: unknown): SettingsDto {
  const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const errors: Record<string, string[]> = {}
  const check = (field: string, valid: boolean) => {
    if (input[field] === undefined || input[field] === null) errors[field] = ['validation.required']
    else if (!valid) errors[field] = ['validation.invalidValue']
  }
  check('baseCurrency', currencies.includes(input.baseCurrency as Currency))
  check('locale', locales.includes(input.locale as Locale))
  check('monthStartDay', isMonthStart(input.monthStartDay))
  check('theme', themePreferences.includes(input.theme as ThemePreference))
  check('notifications', isNotifications(input.notifications))
  if (Object.keys(errors).length > 0) badRequest(errors)
  const notifications = input.notifications as NotificationPrefs
  return {
    baseCurrency: input.baseCurrency as Currency,
    locale: input.locale as Locale,
    monthStartDay: input.monthStartDay as MonthStart,
    theme: input.theme as ThemePreference,
    notifications: Object.fromEntries(notificationKeys.map((key) => [key, notifications[key]])) as NotificationPrefs,
  }
}

export function registerUserHandlers(router: MockRouter) {
  router.on(
    'GET',
    '/v1/me',
    ({ db, userId }): UserDto => db.state.users.find((user) => user.id === userId) ?? notFound(),
  )

  router.on('GET', '/v1/settings', ({ db, userId }) => toSettingsDto(findSettings(db, userId)))

  router.on('PUT', '/v1/settings', ({ db, userId, body }) => {
    const row = findSettings(db, userId)
    Object.assign(row, validateSettings(body))
    db.save()
    return toSettingsDto(row)
  })
}
