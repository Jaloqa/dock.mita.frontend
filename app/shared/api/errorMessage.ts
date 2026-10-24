import { isApiError } from './problem'

const validationCode = /^validation\.[A-Za-z0-9]+$/

const messageByCode: Record<string, string> = {
  'group.itemChanged': 'groups.errors.itemChanged',
}

export function errorMessageKey(error: unknown): string {
  if (!isApiError(error)) return 'shared.error.unknown'
  const known = error.code === undefined ? undefined : messageByCode[error.code]
  if (known) return known
  if (error.status === 400) {
    const code = Object.values(error.fieldErrors)
      .flat()
      .find((value) => validationCode.test(value))
    return code ?? 'shared.error.validation'
  }
  if (error.status === 404) return 'shared.error.notFound'
  if (error.status >= 500) return 'shared.error.server'
  return 'shared.error.unknown'
}
