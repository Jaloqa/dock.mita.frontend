import { isApiError } from '~/shared/api/problem'

export function useServerErrors() {
  const { t } = useI18n()
  const errors = ref<Record<string, string[]>>({})

  const clear = (field?: string) => {
    if (field === undefined) errors.value = {}
    else if (field in errors.value) {
      errors.value = Object.fromEntries(Object.entries(errors.value).filter(([key]) => key !== field))
    }
  }

  const apply = (error: unknown, fields: readonly string[], aliases: Record<string, string> = {}): boolean => {
    if (!isApiError(error)) return false
    const known = Object.entries(error.fieldErrors)
      .map(([field, codes]) => [aliases[field] ?? field, codes] as const)
      .filter(([field]) => fields.includes(field))
    errors.value = Object.fromEntries(known)
    return known.length > 0
  }

  return { messages: (field: string) => (errors.value[field] ?? []).map((code) => t(code)), clear, apply }
}
