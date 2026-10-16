import {
  type Locale,
  locales,
  type NotificationPrefs,
  type SettingsDto,
  type ThemePreference,
  themePreferences,
  type UpdateMeRequest,
  type UserDto,
} from '../../app/shared/api/contract'
import { type Currency, currencies } from '../../app/shared/money/money'
import type { MonthStart } from '../../app/shared/period/period'
import type { MockDb, SettingsRow } from '../db'
import { badRequest, notFound } from '../errors'
import type { MockRouter } from '../router'
import { collectErrors, isMissing, objectBody } from '../validation'

const PROFILE_NAME_MAX = 40
const EMAIL_MAX = 254
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

const emailTakenBy = (db: MockDb, userId: string, email: string): boolean =>
  db.state.users.some((user) => user.id !== userId && user.email.toLowerCase() === email.toLowerCase())

function validateProfile(db: MockDb, userId: string, body: unknown): UpdateMeRequest {
  const { name, email } = objectBody(body)
  const errors = collectErrors()
  if (isMissing(name)) errors.add('name', 'validation.required')
  else if (typeof name !== 'string') errors.add('name', 'validation.invalidValue')
  else if (name.trim().length > PROFILE_NAME_MAX) errors.add('name', 'validation.nameTooLong')
  if (isMissing(email)) errors.add('email', 'validation.required')
  else if (typeof email !== 'string') errors.add('email', 'validation.invalidValue')
  else {
    const address = email.trim()
    if (address.length > EMAIL_MAX || !EMAIL_PATTERN.test(address)) errors.add('email', 'validation.invalidEmail')
    else if (emailTakenBy(db, userId, address)) errors.add('email', 'validation.emailTaken')
  }
  errors.throwIfAny()
  return { name: (name as string).trim(), email: (email as string).trim() }
}

export function registerUserHandlers(router: MockRouter) {
  router.on(
    'GET',
    '/v1/me',
    ({ db, userId }): UserDto => db.state.users.find((user) => user.id === userId) ?? notFound(),
  )

  router.on('PUT', '/v1/me', ({ db, userId, body }): UserDto => {
    const user = db.state.users.find((row) => row.id === userId) ?? notFound()
    Object.assign(user, validateProfile(db, userId, body))
    db.save()
    return user
  })

  router.on('GET', '/v1/settings', ({ db, userId }) => toSettingsDto(findSettings(db, userId)))

  router.on('PUT', '/v1/settings', ({ db, userId, body }) => {
    const row = findSettings(db, userId)
    Object.assign(row, validateSettings(body))
    db.save()
    return toSettingsDto(row)
  })
}
