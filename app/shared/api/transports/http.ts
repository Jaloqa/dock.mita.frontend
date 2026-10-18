import { ApiError, toApiError } from '../problem'
import type { ApiRequest, HttpMethod, QueryValue, Transport } from '../transport'

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

const XSRF_METHODS = new Set<HttpMethod>(['POST', 'PUT', 'DELETE'])
const REFRESH_PATH = '/v1/auth/refresh'
const isAuthPath = (path: string) => path.startsWith('/v1/auth/')

export function createHttpTransport(
  fetcher: Fetcher,
  options: {
    baseUrl: string
    locale: () => string
    xsrfToken: () => string | undefined
    onSessionExpired: () => void
  },
): Transport {
  const send = async (request: ApiRequest) => {
    const headers: Record<string, string> = { 'Accept-Language': options.locale() }
    if (XSRF_METHODS.has(request.method)) {
      const token = options.xsrfToken()
      if (token) headers['X-XSRF-TOKEN'] = token
    }
    try {
      return await fetcher(`${options.baseUrl}${request.path}`, {
        method: request.method,
        query: definedOnly(request.query),
        body: request.body,
        headers,
        credentials: 'include',
      })
    } catch (error) {
      throw toApiError(statusOf(error), (error as { data?: unknown } | null)?.data)
    }
  }

  let refreshing: Promise<boolean> | undefined
  const refresh = () => {
    refreshing ??= send({ method: 'POST', path: REFRESH_PATH })
      .then(() => true)
      .catch(() => {
        options.onSessionExpired()
        return false
      })
      .finally(() => {
        refreshing = undefined
      })
    return refreshing
  }

  return async (request) => {
    try {
      return await send(request)
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || isAuthPath(request.path)) throw error
      if (!(await refresh())) throw error
      return send(request)
    }
  }
}
