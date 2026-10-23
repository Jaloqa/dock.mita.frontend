import { describe, expect, it } from 'bun:test'
import { ApiError } from '../../../app/shared/api/problem'
import { createHttpTransport, type Fetcher } from '../../../app/shared/api/transports/http'

type Call = { url: string; method: string; headers: Record<string, string> }

const unauthorized = () =>
  Object.assign(new Error('401'), { status: 401, data: { title: 'Unauthorized', status: 401 } })

const tooManyRequests = (retryAfter?: string) =>
  Object.assign(new Error('429'), {
    status: 429,
    response: { headers: new Headers(retryAfter === undefined ? {} : { 'Retry-After': retryAfter }) },
  })

const setup = (
  handler: (call: Call, index: number) => unknown | Promise<unknown>,
  token: () => string | undefined = () => 'tok',
  refresh?: boolean,
) => {
  const calls: Call[] = []
  const sleeps: number[] = []
  let expired = 0
  const fetcher: Fetcher = async (url, options) => {
    const call = { url, method: options.method, headers: options.headers }
    calls.push(call)
    return handler(call, calls.length - 1)
  }
  const transport = createHttpTransport(fetcher, {
    baseUrl: '',
    locale: () => 'en',
    xsrfToken: token,
    onSessionExpired: () => {
      expired++
    },
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    ...(refresh === undefined ? {} : { refresh }),
  })
  return { transport, calls, sleeps, expired: () => expired }
}

describe('http transport xsrf header', () => {
  it.each(['POST', 'PUT', 'DELETE'] as const)('sends X-XSRF-TOKEN on %s', async (method) => {
    const { transport, calls } = setup(() => ({}))
    await transport({ method, path: '/v1/items' })
    expect(calls[0]?.headers['X-XSRF-TOKEN']).toBe('tok')
  })

  it('does not send X-XSRF-TOKEN on GET', async () => {
    const { transport, calls } = setup(() => ({}))
    await transport({ method: 'GET', path: '/v1/items' })
    expect(calls[0]?.headers['X-XSRF-TOKEN']).toBeUndefined()
  })

  it('omits the header when there is no token', async () => {
    const { transport, calls } = setup(
      () => ({}),
      () => undefined,
    )
    await transport({ method: 'POST', path: '/v1/items' })
    expect('X-XSRF-TOKEN' in (calls[0]?.headers ?? {})).toBe(false)
  })
})

describe('http transport request headers', () => {
  it.each(['GET', 'POST', 'PUT', 'DELETE'] as const)('sends the headers of a %s request', async (method) => {
    const { transport, calls } = setup(() => ({}))
    await transport({ method, path: '/v1/items', headers: { 'X-Group-Member': 'mbr_1' } })
    expect(calls[0]?.headers['X-Group-Member']).toBe('mbr_1')
    expect(calls[0]?.headers['Accept-Language']).toBe('en')
  })

  it('keeps the X-XSRF-TOKEN of the transport next to the headers of the request', async () => {
    const { transport, calls } = setup(() => ({}))
    await transport({ method: 'POST', path: '/v1/items', headers: { 'X-Group-Member': 'mbr_1' } })
    expect(calls[0]?.headers).toEqual({ 'Accept-Language': 'en', 'X-Group-Member': 'mbr_1', 'X-XSRF-TOKEN': 'tok' })
  })

  it('lets its own Accept-Language and X-XSRF-TOKEN win over the same headers of the request', async () => {
    const { transport, calls } = setup(() => ({}))
    await transport({
      method: 'DELETE',
      path: '/v1/items',
      headers: { 'Accept-Language': 'de', 'X-XSRF-TOKEN': 'forged', 'X-Group-Member': 'mbr_1' },
    })
    expect(calls[0]?.headers).toEqual({ 'Accept-Language': 'en', 'X-Group-Member': 'mbr_1', 'X-XSRF-TOKEN': 'tok' })
  })

  it('sends no other header when the request has none', async () => {
    const { transport, calls } = setup(() => ({}))
    await transport({ method: 'GET', path: '/v1/items' })
    await transport({ method: 'POST', path: '/v1/items' })
    expect(calls[0]?.headers).toEqual({ 'Accept-Language': 'en' })
    expect(calls[1]?.headers).toEqual({ 'Accept-Language': 'en', 'X-XSRF-TOKEN': 'tok' })
  })

  it('sends the headers again on the request retried after a refresh', async () => {
    const { transport, calls } = setup((_call, index) => {
      if (index === 0) throw unauthorized()
      return {}
    })
    await transport({ method: 'POST', path: '/v1/items', headers: { 'X-Group-Member': 'mbr_1' } })
    expect(calls.map((c) => c.url)).toEqual(['/v1/items', '/v1/auth/refresh', '/v1/items'])
    expect(calls[0]?.headers['X-Group-Member']).toBe('mbr_1')
    expect(calls[1]?.headers['X-Group-Member']).toBeUndefined()
    expect(calls[2]?.headers['X-Group-Member']).toBe('mbr_1')
  })
})

describe('http transport refresh', () => {
  it('refreshes on 401 and retries the request once', async () => {
    const { transport, calls } = setup((call, index) => {
      if (index === 0) throw unauthorized()
      return call.url === '/v1/auth/refresh' ? undefined : { id: 1 }
    })
    expect(await transport({ method: 'GET', path: '/v1/me' })).toEqual({ id: 1 })
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['GET /v1/me', 'POST /v1/auth/refresh', 'GET /v1/me'])
  })

  it('shares one refresh between concurrent 401s', async () => {
    let refreshed = false
    const { transport, calls } = setup(async (call) => {
      if (call.url === '/v1/auth/refresh') {
        await new Promise((resolve) => setTimeout(resolve, 5))
        refreshed = true
        return undefined
      }
      if (!refreshed) throw unauthorized()
      return { ok: true }
    })
    const results = await Promise.all(Array.from({ length: 5 }, () => transport({ method: 'GET', path: '/v1/me' })))
    expect(results).toEqual(Array.from({ length: 5 }, () => ({ ok: true })))
    expect(calls.filter((c) => c.url === '/v1/auth/refresh')).toHaveLength(1)
    expect(calls.filter((c) => c.url === '/v1/me')).toHaveLength(10)
  })

  it('reads the xsrf token again for the retried request', async () => {
    let token = 'old'
    const { transport, calls } = setup(
      (call, index) => {
        if (index === 0) throw unauthorized()
        if (call.url === '/v1/auth/refresh') token = 'new'
        return {}
      },
      () => token,
    )
    await transport({ method: 'POST', path: '/v1/items' })
    expect(calls[0]?.headers['X-XSRF-TOKEN']).toBe('old')
    expect(calls[1]?.headers['X-XSRF-TOKEN']).toBe('old')
    expect(calls[2]?.headers['X-XSRF-TOKEN']).toBe('new')
  })

  it('signals session expiry and throws the original 401 when refresh fails', async () => {
    const { transport, calls, expired } = setup(() => {
      throw unauthorized()
    })
    const error = await transport({ method: 'GET', path: '/v1/me' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect(expired()).toBe(1)
    expect(calls.filter((c) => c.url === '/v1/auth/refresh')).toHaveLength(1)
    expect(calls).toHaveLength(2)
  })

  it('waits Retry-After and refreshes again after a 429', async () => {
    let refreshCalls = 0
    const { transport, calls, expired, sleeps } = setup((call) => {
      if (call.url === '/v1/auth/refresh') {
        refreshCalls++
        if (refreshCalls === 1) throw tooManyRequests('0')
        return undefined
      }
      if (refreshCalls < 2) throw unauthorized()
      return { ok: true }
    })
    expect(await transport({ method: 'GET', path: '/v1/me' })).toEqual({ ok: true })
    expect(calls.filter((c) => c.url === '/v1/auth/refresh')).toHaveLength(2)
    expect(sleeps).toEqual([0])
    expect(expired()).toBe(0)
  })

  it('throws the original 401 without expiry when refresh answers 503', async () => {
    const { transport, calls, expired } = setup((call) => {
      if (call.url === '/v1/auth/refresh') throw Object.assign(new Error('503'), { status: 503 })
      throw unauthorized()
    })
    const error = await transport({ method: 'GET', path: '/v1/me' }).catch((e: unknown) => e)
    expect((error as ApiError).status).toBe(401)
    expect(calls.filter((c) => c.url === '/v1/auth/refresh')).toHaveLength(1)
    expect(expired()).toBe(0)
  })

  it('refreshes once and signals expiry once for concurrent 401s when refresh answers 401', async () => {
    const { transport, calls, expired } = setup(async (call) => {
      if (call.url === '/v1/auth/refresh') await new Promise((resolve) => setTimeout(resolve, 5))
      throw unauthorized()
    })
    const errors = await Promise.all(
      Array.from({ length: 5 }, () => transport({ method: 'GET', path: '/v1/me' }).catch((e: unknown) => e)),
    )
    expect(errors.map((e) => (e as ApiError).status)).toEqual([401, 401, 401, 401, 401])
    expect(calls.filter((c) => c.url === '/v1/auth/refresh')).toHaveLength(1)
    expect(expired()).toBe(1)
  })

  it('gives up without expiry after three 429 refresh answers', async () => {
    const { transport, calls, expired, sleeps } = setup((call) => {
      if (call.url === '/v1/auth/refresh') throw tooManyRequests(calls.length === 2 ? undefined : '120')
      throw unauthorized()
    })
    const error = await transport({ method: 'GET', path: '/v1/me' }).catch((e: unknown) => e)
    expect((error as ApiError).status).toBe(401)
    expect(calls.filter((c) => c.url === '/v1/auth/refresh')).toHaveLength(3)
    expect(sleeps).toEqual([1000, 30000])
    expect(expired()).toBe(0)
  })

  it('does not refresh for /v1/auth/* paths', async () => {
    const { transport, calls, expired } = setup(() => {
      throw unauthorized()
    })
    const error = await transport({ method: 'POST', path: '/v1/auth/login' }).catch((e: unknown) => e)
    expect((error as ApiError).status).toBe(401)
    expect(calls).toHaveLength(1)
    expect(expired()).toBe(0)
  })

  it('throws the 401 without refreshing or signalling expiry when refresh is disabled', async () => {
    const { transport, calls, expired } = setup(
      () => {
        throw unauthorized()
      },
      () => 'tok',
      false,
    )
    const error = await transport({ method: 'GET', path: '/v1/me' }).catch((e: unknown) => e)
    expect((error as ApiError).status).toBe(401)
    expect(calls.map((c) => c.url)).toEqual(['/v1/me'])
    expect(expired()).toBe(0)
  })

  it('does not refresh again when the retried request is 401', async () => {
    const { transport, calls, expired } = setup((call) => {
      if (call.url === '/v1/auth/refresh') return undefined
      throw unauthorized()
    })
    const error = await transport({ method: 'GET', path: '/v1/me' }).catch((e: unknown) => e)
    expect((error as ApiError).status).toBe(401)
    expect(calls.map((c) => c.url)).toEqual(['/v1/me', '/v1/auth/refresh', '/v1/me'])
    expect(expired()).toBe(0)
  })
})
