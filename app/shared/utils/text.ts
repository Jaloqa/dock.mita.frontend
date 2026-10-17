export function capitalizeFirst(value: string, locale: string): string {
  const first = Array.from(value)[0] ?? ''
  return first.toLocaleUpperCase(locale) + value.slice(first.length)
}
