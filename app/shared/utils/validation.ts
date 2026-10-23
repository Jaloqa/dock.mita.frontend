import { fromLocalDate } from '../period/period'

export const isPositiveOrEmpty = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'number' && value > 0)

export const requiredWhen =
  (condition: () => boolean) =>
  (value: unknown): boolean =>
    !condition() || (value !== null && value !== undefined && value !== '')

export const notAfter =
  (limit: () => Date) =>
  (value: unknown): boolean =>
    !(value instanceof Date) || fromLocalDate(value) <= fromLocalDate(limit())
