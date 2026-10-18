import { errorMessageKey } from '../../../shared/api/errorMessage'
import { isApiError } from '../../../shared/api/problem'

const messageByCode: Record<string, string> = {
  'auth.invalidCredentials': 'auth.errors.invalidCredentials',
  'auth.sessionExpired': 'auth.errors.sessionExpired',
}

export function authMessageKey(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 429) return 'auth.errors.tooManyAttempts'
    const known = error.code === undefined ? undefined : messageByCode[error.code]
    if (known) return known
  }
  return errorMessageKey(error)
}
