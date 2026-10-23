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

const retryAfterOf = (error: unknown): number | undefined => {
  const value = (
    error as { response?: { headers?: { get?: (name: string) => string | null } } } | null
  )?.response?.headers?.get?.('retry-after')
  if (value === undefined || value === null || value.trim() === '') return undefined
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined
}

const XSRF_METHODS = new Set<HttpMethod>(['POST', 'PUT', 'DELETE'])
const REFRESH_PATH = '/v1/auth/refresh'
const REFRESH_ATTEMPTS = 3
const MAX_RETRY_AFTER_SECONDS = 30
const DEFAULT_RETRY_AFTER_SECONDS = 1
const isAuthPath = (path: string) => path.startsWith('/v1/auth/')
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type RefreshOutcome = 'refreshed' | 'expired' | 'unavailable'

export function createHttpTransport(
  fetcher: Fetcher,
  options: {
    baseUrl: string
    locale: () => string
    xsrfToken: () => string | undefined
    onSessionExpired: () => void
    refresh?: boolean
    sleep?: (ms: number) => Promise<void>
  },
): Transport {
  const canRefresh = options.refresh ?? true
  const sleep = options.sleep ?? wait
  const send = async (request: ApiRequest) => {
    const headers: Record<string, string> = { ...request.headers, 'Accept-Language': options.locale() }
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
      throw toApiError(statusOf(error), (error as { data?: unknown } | null)?.data, retryAfterOf(error))
    }
  }

  const refreshWithRetries = async (): Promise<RefreshOutcome> => {
    for (let attempt = 1; ; attempt++) {
      try {
        await send({ method: 'POST', path: REFRESH_PATH })
        return 'refreshed'
      } catch (error) {
        if (!(error instanceof ApiError)) return 'unavailable'
        if (error.status === 401) {
          options.onSessionExpired()
          return 'expired'
        }
        if (error.status !== 429 || attempt >= REFRESH_ATTEMPTS) return 'unavailable'
        await sleep(Math.min(error.retryAfter ?? DEFAULT_RETRY_AFTER_SECONDS, MAX_RETRY_AFTER_SECONDS) * 1000)
      }
    }
  }

  let refreshing: Promise<RefreshOutcome> | undefined
  const refresh = () => {
    refreshing ??= refreshWithRetries().finally(() => {
      refreshing = undefined
    })
    return refreshing
  }

  return async (request) => {
    try {
      return await send(request)
    } catch (error) {
      if (!canRefresh || !(error instanceof ApiError) || error.status !== 401 || isAuthPath(request.path)) throw error
      if ((await refresh()) !== 'refreshed') throw error
      return send(request)
    }
  }
}
