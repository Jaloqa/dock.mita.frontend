import { describe, expect, it } from 'bun:test'
import { ApiError } from '../../../app/shared/api/problem'
import { createHttpTransport, type Fetcher } from '../../../app/shared/api/transports/http'

type Call = { url: string; method: string; headers: Record<string, string> }

const unauthorized = () =>
  Object.assign(new Error('401'), { status: 401, data: { title: 'Unauthorized', status: 401 } })

const setup = (
  handler: (call: Call, index: number) => unknown | Promise<unknown>,
  token: () => string | undefined = () => 'tok',
) => {
  const calls: Call[] = []
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
  })
  return { transport, calls, expired: () => expired }
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

  it('treats a 429 refresh as failure', async () => {
    const { transport, expired } = setup((call) => {
      if (call.url === '/v1/auth/refresh') throw Object.assign(new Error('429'), { status: 429 })
      throw unauthorized()
    })
    const error = await transport({ method: 'GET', path: '/v1/me' }).catch((e: unknown) => e)
    expect((error as ApiError).status).toBe(401)
    expect(expired()).toBe(1)
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
