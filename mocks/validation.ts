import { type Currency, currencies } from '../app/shared/money/money'
import { badRequest } from './errors'

export const objectBody = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {}

export const isMissing = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

export const isCurrency = (value: unknown): value is Currency => currencies.includes(value as Currency)

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
