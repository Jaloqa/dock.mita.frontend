import type { UserDto } from '../../app/shared/api/contract'
import type { MockDb } from '../db'
import { unauthorized } from '../errors'
import { newId } from '../ids'
import type { MockRouter } from '../router'
import { defaultSettings } from '../seed/users'
import { checkEmail, checkName, collectErrors, type ErrorCollector, isMissing, objectBody } from '../validation'
import { emailTakenBy } from './users'

export const DEMO_PASSWORD = 'demo-password'

const PASSWORD_MIN = 10
const PASSWORD_MAX = 128
const DEFAULT_LOCALE = 'en'

const sameEmail = (left: string, right: string): boolean => left.trim().toLowerCase() === right.trim().toLowerCase()

function checkPassword(errors: ErrorCollector, password: unknown): void {
  if (isMissing(password)) errors.add('password', 'validation.required')
  else if (typeof password !== 'string') errors.add('password', 'validation.invalidValue')
  else if (password.length < PASSWORD_MIN) errors.add('password', 'validation.passwordTooShort')
  else if (password.length > PASSWORD_MAX) errors.add('password', 'validation.passwordTooLong')
}

const passwordOf = (db: MockDb, userId: string): string =>
  db.state.credentials.find((row) => row.userId === userId)?.password ?? DEMO_PASSWORD

function register(db: MockDb, body: unknown): UserDto {
  const { name, email, password } = objectBody(body)
  const errors = collectErrors()
  checkName(errors, name)
  checkEmail(errors, email, (address) => emailTakenBy(db, undefined, address))
  checkPassword(errors, password)
  errors.throwIfAny()
  const user: UserDto = {
    id: newId('usr'),
    name: (name as string).trim(),
    email: (email as string).trim(),
    createdAt: new Date().toISOString(),
  }
  db.state.users.push(user)
  db.state.settings.push(defaultSettings(user.id, DEFAULT_LOCALE))
  db.state.credentials.push({ userId: user.id, password: password as string })
  db.state.activeUserId = user.id
  db.save()
  return user
}

function login(db: MockDb, body: unknown): UserDto {
  const { email, password } = objectBody(body)
  const errors = collectErrors()
  for (const [field, value] of [
    ['email', email],
    ['password', password],
  ] as const) {
    if (isMissing(value)) errors.add(field, 'validation.required')
    else if (typeof value !== 'string') errors.add(field, 'validation.invalidValue')
  }
  errors.throwIfAny()
  const user = db.state.users.find((row) => sameEmail(row.email, email as string))
  if (!user || passwordOf(db, user.id) !== password) return unauthorized('auth.invalidCredentials')
  db.state.activeUserId = user.id
  db.save()
  return user
}

export function registerAuthHandlers(router: MockRouter) {
  router.on('POST', '/v1/auth/register', ({ db, body }) => register(db, body))

  router.on('POST', '/v1/auth/login', ({ db, body }) => login(db, body))

  router.on('POST', '/v1/auth/refresh', ({ db, userId }) => {
    if (!db.state.users.some((user) => user.id === userId)) unauthorized('auth.sessionExpired')
  })

  router.on('POST', '/v1/auth/logout', ({ db }) => {
    db.state.activeUserId = null
    db.save()
  })
}
