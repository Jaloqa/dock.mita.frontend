import { isApiError } from './problem'

export function errorMessageKey(error: unknown): string {
  if (!isApiError(error)) return 'shared.error.unknown'
  if (error.status === 400) return 'shared.error.validation'
  if (error.status === 404) return 'shared.error.notFound'
  if (error.status >= 500) return 'shared.error.server'
  return 'shared.error.unknown'
}
