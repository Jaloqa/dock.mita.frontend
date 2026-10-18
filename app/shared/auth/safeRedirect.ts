const FALLBACK = '/'
const ORIGIN = 'http://mita.invalid'

const isUnsafeChar = (char: string) => {
  const code = char.charCodeAt(0)
  return code <= 0x20 || code === 0x7f || char === '\\'
}

export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return FALLBACK
  if (Array.from(value).some(isUnsafeChar)) return FALLBACK
  try {
    if (new URL(value, ORIGIN).origin !== ORIGIN) return FALLBACK
  } catch {
    return FALLBACK
  }
  return value
}
