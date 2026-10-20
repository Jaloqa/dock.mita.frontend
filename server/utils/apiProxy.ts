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

export function isApiPath(requestUrl: string): boolean {
  const path = requestUrl.split('?')[0] ?? ''
  return path === PREFIX || path.startsWith(`${PREFIX}/`)
}

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i

const splitList = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

export function forwardedHeaders(
  incoming: { forwardedFor?: string; forwardedProto?: string },
  peer: { ip?: string; protocol: 'http' | 'https' },
): { 'x-forwarded-for': string; 'x-forwarded-proto': string } {
  if (!peer.ip) return { 'x-forwarded-for': '', 'x-forwarded-proto': '' }
  const ip = peer.ip.replace(IPV4_MAPPED, '$1')
  return {
    'x-forwarded-for': [...splitList(incoming.forwardedFor), ip].join(', '),
    'x-forwarded-proto': [...splitList(incoming.forwardedProto), peer.protocol].join(', '),
  }
}

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
