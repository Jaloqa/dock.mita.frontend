const PREFIX = '/v1'
const PARSE_ORIGIN = 'http://proxy.invalid'

const isDotSegment = (segment: string) => segment === '.' || segment === '..'

const decodedSegment = (segment: string): string | null => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

const hasDotSegment = (path: string) =>
  path.split('/').some((segment) => {
    const decoded = decodedSegment(segment)
    return decoded === null || isDotSegment(segment) || isDotSegment(decoded)
  })

export function resolveProxyUrl(target: string, requestUrl: string): string | null {
  const base = target.trim().replace(/\/+$/, '')
  if (!base) return null
  const path = requestUrl.split('?')[0] ?? ''
  if (path.includes('\\') || hasDotSegment(path)) return null
  let pathname: string
  try {
    pathname = new URL(requestUrl, PARSE_ORIGIN).pathname
  } catch {
    return null
  }
  if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) return null
  if (path !== PREFIX && !path.startsWith(`${PREFIX}/`)) return null
  return `${base}${requestUrl}`
}
