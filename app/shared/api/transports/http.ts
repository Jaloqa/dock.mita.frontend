import { toApiError } from '../problem'
import type { HttpMethod, QueryValue, Transport } from '../transport'

export type Fetcher = (
  url: string,
  options: {
    method: HttpMethod
    query?: Record<string, string | number | boolean>
    body?: unknown
    headers: Record<string, string>
    credentials: 'include'
  },
) => Promise<unknown>

const definedOnly = (query: Record<string, QueryValue> | undefined) =>
  query
    ? (Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined)) as Record<
        string,
        string | number | boolean
      >)
    : undefined

const statusOf = (error: unknown): number => {
  const status =
    (error as { status?: unknown; statusCode?: unknown } | null)?.status ??
    (error as { statusCode?: unknown } | null)?.statusCode
  return typeof status === 'number' ? status : 503
}

export function createHttpTransport(fetcher: Fetcher, options: { baseUrl: string; locale: () => string }): Transport {
  return async (request) => {
    try {
      return await fetcher(`${options.baseUrl}${request.path}`, {
        method: request.method,
        query: definedOnly(request.query),
        body: request.body,
        headers: { 'Accept-Language': options.locale() },
        credentials: 'include',
      })
    } catch (error) {
      throw toApiError(statusOf(error), (error as { data?: unknown } | null)?.data)
    }
  }
}
