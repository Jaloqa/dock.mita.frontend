import { MANUAL_RATE_MAX } from '../app/shared/money/currencies'
import { badRequest } from './errors'

export const objectBody = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {}

export const isMissing = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

export const isManualRate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MANUAL_RATE_MAX

export const NAME_MAX = 40
export const EMAIL_MAX = 254
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ErrorCollector = ReturnType<typeof collectErrors>

export const isEmailAddress = (address: string): boolean => address.length <= EMAIL_MAX && EMAIL_PATTERN.test(address)

export function checkName(errors: ErrorCollector, name: unknown): void {
  if (isMissing(name)) errors.add('name', 'validation.required')
  else if (typeof name !== 'string') errors.add('name', 'validation.invalidValue')
  else if (name.trim().length > NAME_MAX) errors.add('name', 'validation.nameTooLong')
}

export function checkEmail(errors: ErrorCollector, email: unknown, isTaken: (address: string) => boolean): void {
  if (isMissing(email)) errors.add('email', 'validation.required')
  else if (typeof email !== 'string') errors.add('email', 'validation.invalidValue')
  else {
    const address = email.trim()
    if (!isEmailAddress(address)) errors.add('email', 'validation.invalidEmail')
    else if (isTaken(address)) errors.add('email', 'validation.emailTaken')
  }
}

export function collectErrors() {
  const errors: Record<string, string[]> = {}
  return {
    add: (field: string, code: string) => {
      errors[field] ??= [code]
    },
    throwIfAny: () => {
      if (Object.keys(errors).length > 0) badRequest(errors)
    },
  }
}
