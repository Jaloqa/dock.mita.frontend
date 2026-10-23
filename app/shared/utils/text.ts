export function capitalizeFirst(value: string, locale: string): string {
  const first = Array.from(value)[0] ?? ''
  return first.toLocaleUpperCase(locale) + value.slice(first.length)
}

export const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim() !== ''

export const trimmedWithin =
  (max: number) =>
  (value: unknown): boolean =>
    typeof value !== 'string' || value.trim().length <= max
