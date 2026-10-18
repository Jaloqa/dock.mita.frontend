import { parseRealPaths } from './transports/routing'

export type ApiMode = 'mock' | 'hybrid' | 'real'

export function resolveApiMode(apiMocks: boolean, apiRealPaths: string): ApiMode {
  if (!apiMocks) return 'real'
  return parseRealPaths(apiRealPaths).length === 0 ? 'mock' : 'hybrid'
}
