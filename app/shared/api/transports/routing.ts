import type { Transport } from '../transport'

export function parseRealPaths(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim().replace(/\/+$/, ''))
    .filter((entry) => entry.length > 0)
}

export function matchesRealPath(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export function createRoutingTransport(options: { http: Transport; mock: Transport; realPaths: string[] }): Transport {
  return (request) => (matchesRealPath(request.path, options.realPaths) ? options.http(request) : options.mock(request))
}
