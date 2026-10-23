import type { Page } from '../app/shared/api/contract'
import { collectErrors, type ErrorCollector } from './validation'

const positiveInteger = (value: string | undefined, fallback: number): number | undefined => {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined
}

export function paginate<T>(
  items: readonly T[],
  query: Record<string, string>,
  options: { defaultPageSize: number; maxPageSize: number },
  errors: ErrorCollector = collectErrors(),
): Page<T> {
  const page = positiveInteger(query.page, 1)
  const pageSize = positiveInteger(query.pageSize, options.defaultPageSize)
  if (page === undefined) errors.add('page', 'validation.invalidValue')
  if (pageSize === undefined || pageSize > options.maxPageSize) errors.add('pageSize', 'validation.invalidValue')
  errors.throwIfAny()
  const current = page as number
  const size = pageSize as number
  return {
    items: items.slice((current - 1) * size, current * size),
    page: current,
    pageSize: size,
    total: items.length,
  }
}
