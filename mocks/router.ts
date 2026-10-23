import type { HttpMethod } from '../app/shared/api/transport'
import type { MockDb } from './db'

export type MockContext = {
  db: MockDb
  userId: string
  params: Record<string, string>
  query: Record<string, string>
  body: unknown
  headers: Record<string, string>
}

export type MockHandler = (context: MockContext) => unknown

export type MockRouter = {
  on(method: HttpMethod, pattern: string, handler: MockHandler): void
  match(method: HttpMethod, path: string): { handler: MockHandler; params: Record<string, string> } | undefined
}

type Route = { method: HttpMethod; segments: string[]; handler: MockHandler }

const split = (path: string) => path.split('/').filter(Boolean)

const decode = (value: string): string | undefined => {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

function matchSegments(pattern: string[], actual: string[]): Record<string, string> | undefined {
  if (pattern.length !== actual.length) return undefined
  const params: Record<string, string> = {}
  for (const [index, segment] of pattern.entries()) {
    const value = actual[index] ?? ''
    if (segment.startsWith(':')) {
      const decoded = decode(value)
      if (decoded === undefined) return undefined
      params[segment.slice(1)] = decoded
    } else if (segment !== value) return undefined
  }
  return params
}

export function createRouter(): MockRouter {
  const routes: Route[] = []
  return {
    on: (method, pattern, handler) => {
      routes.push({ method, segments: split(pattern), handler })
    },
    match: (method, path) => {
      const actual = split(path)
      for (const route of routes) {
        if (route.method !== method) continue
        const params = matchSegments(route.segments, actual)
        if (params) return { handler: route.handler, params }
      }
      return undefined
    },
  }
}
