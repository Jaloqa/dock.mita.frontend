import { describe, expect, it } from 'bun:test'
import { reactive } from 'vue'
import { ApiError } from '../../../app/shared/api/problem'
import { createMockApi } from '../../../mocks/api'
import { badRequest } from '../../../mocks/errors'
import { createRouter } from '../../../mocks/router'
import { createMockTransport } from '../../../mocks/transport'

const loggedIn = (options: Parameters<typeof createMockApi>[0]) => {
  const api = createMockApi(options)
  api.db.state.activeUserId = 'usr_anna'
  return api
}

describe('mock router', () => {
  it('matches static and parameterized paths', () => {
    const router = createRouter()
    const list = () => 'list'
    const item = () => 'item'
    router.on('GET', '/v1/items', list)
    router.on('GET', '/v1/items/:id', item)
    expect(router.match('GET', '/v1/items')?.handler).toBe(list)
    expect(router.match('GET', '/v1/items/42')).toEqual({ handler: item, params: { id: '42' } })
    expect(router.match('POST', '/v1/items')).toBeUndefined()
    expect(router.match('GET', '/v1/items/42/extra')).toBeUndefined()
  })

  it('treats undecodable path segments as no match', () => {
    const router = createRouter()
    router.on('GET', '/v1/items/:id', () => 'item')
    expect(router.match('GET', '/v1/items/%E0%A4%A')).toBeUndefined()
  })
})

describe('mock api', () => {
  const echo = (
    api = loggedIn({
      register: [
        (router) =>
          router.on('POST', '/v1/echo/:id', ({ userId, params, query, body }) => ({ userId, params, query, body })),
      ],
    }),
  ) => api

  it('passes session user, params, string query and a copy of the body', async () => {
    const body = { nested: { value: 1 } }
    const result = (await echo().handle({
      method: 'POST',
      path: '/v1/echo/7',
      query: { page: 2, q: undefined },
      body,
    })) as {
      userId: string
      params: Record<string, string>
      query: Record<string, string>
      body: { nested: { value: number } }
    }
    expect(result.userId).toBe('usr_anna')
    expect(result.params).toEqual({ id: '7' })
    expect(result.query).toEqual({ page: '2' })
    result.body.nested.value = 99
    expect(body.nested.value).toBe(1)
  })

  it('passes the request headers to handlers with lower-cased names', async () => {
    const api = loggedIn({
      register: [(router) => router.on('GET', '/v1/headers', ({ headers }) => headers)],
    })
    expect(
      await api.handle({ method: 'GET', path: '/v1/headers', headers: { 'X-Group-Member': 'mbr_1', Accept: 'a/b' } }),
    ).toEqual({ 'x-group-member': 'mbr_1', accept: 'a/b' })
    expect(await api.handle({ method: 'GET', path: '/v1/headers' })).toEqual({})
  })

  it('answers /v1/shared/ paths without a session and keeps every other path closed', async () => {
    const api = createMockApi({
      register: [
        (router) => router.on('GET', '/v1/shared/ping', ({ userId }) => ({ userId })),
        (router) => router.on('GET', '/v1/closed', () => 'closed'),
      ],
    })
    expect(api.db.state.activeUserId).toBeNull()
    expect(await api.handle({ method: 'GET', path: '/v1/shared/ping' })).toEqual({ userId: '' })
    expect(await api.handle({ method: 'GET', path: '/v1/closed' }).catch((e: unknown) => e)).toMatchObject({
      problem: { status: 401, code: 'auth.sessionExpired' },
    })
  })

  it('answers unknown routes with a 404 problem', async () => {
    const error = await loggedIn({})
      .handle({ method: 'GET', path: '/v1/nope' })
      .catch((e: unknown) => e)
    expect(error).toMatchObject({ problem: { status: 404, title: 'Not Found' } })
  })

  it('answers undecodable path segments with a 404 problem', async () => {
    const api = loggedIn({ register: [(router) => router.on('GET', '/v1/items/:id', () => 'item')] })
    const error = await api.handle({ method: 'GET', path: '/v1/items/%E0%A4%A' }).catch((e: unknown) => e)
    expect(error).toMatchObject({ problem: { status: 404 } })
  })

  it('does not let handlers mutate the caller body', async () => {
    const body = { nested: { value: 1 } }
    const api = loggedIn({
      register: [
        (router) =>
          router.on('POST', '/v1/mutate', ({ body: received }) => {
            const mutable = received as { nested: { value: number } }
            mutable.nested.value = 99
            return 'ok'
          }),
      ],
    })
    expect(await api.handle({ method: 'POST', path: '/v1/mutate', body })).toBe('ok')
    expect(body.nested.value).toBe(1)
  })

  it('sends bodies and results over the wire as JSON', async () => {
    const api = loggedIn({
      register: [
        (router) => router.on('POST', '/v1/body', ({ body }) => body),
        (router) => router.on('GET', '/v1/dates', () => ({ when: new Date('2026-10-15T00:00:00Z'), skip: undefined })),
      ],
    })
    expect(await api.handle({ method: 'POST', path: '/v1/body', body: reactive({ nested: { value: 1 } }) })).toEqual({
      nested: { value: 1 },
    })
    expect(await api.handle({ method: 'GET', path: '/v1/dates' })).toEqual({ when: '2026-10-15T00:00:00.000Z' })
  })

  it('simulates server errors except for demo endpoints', async () => {
    const api = loggedIn({
      random: () => 0,
      register: [
        (router) => router.on('GET', '/v1/ping', () => 'pong'),
        (router) => router.on('GET', '/v1/demo/ping', () => 'pong'),
      ],
    })
    api.db.state.simulateErrors = true
    expect(await api.handle({ method: 'GET', path: '/v1/ping' }).catch((e: unknown) => e)).toMatchObject({
      problem: { status: 500 },
    })
    expect(await api.handle({ method: 'GET', path: '/v1/demo/ping' })).toBe('pong')
  })

  it('never simulates errors on the session probe and the auth endpoints', async () => {
    const api = loggedIn({
      random: () => 0,
      register: [
        (router) => router.on('GET', '/v1/me', () => 'me'),
        (router) => router.on('PUT', '/v1/me', () => 'updated'),
        (router) => router.on('POST', '/v1/auth/login', () => 'signed in'),
      ],
    })
    api.db.state.simulateErrors = true
    expect(await api.handle({ method: 'GET', path: '/v1/me' })).toBe('me')
    expect(await api.handle({ method: 'POST', path: '/v1/auth/login' })).toBe('signed in')
    expect(await api.handle({ method: 'PUT', path: '/v1/me' }).catch((e: unknown) => e)).toMatchObject({
      problem: { status: 500 },
    })
  })
})

describe('mock transport', () => {
  it('returns handler results', async () => {
    const api = loggedIn({ register: [(router) => router.on('GET', '/v1/ping', () => ({ pong: true }))] })
    expect(await createMockTransport(api, () => 0)({ method: 'GET', path: '/v1/ping' })).toEqual({ pong: true })
  })

  it('turns mock errors into ApiError with field errors', async () => {
    const api = loggedIn({
      register: [(router) => router.on('POST', '/v1/things', () => badRequest({ name: ['validation.required'] }))],
    })
    const error = await createMockTransport(
      api,
      () => 0,
    )({ method: 'POST', path: '/v1/things' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, fieldErrors: { name: ['validation.required'] } })
  })

  it('turns unexpected handler errors into a 500 ApiError', async () => {
    const api = loggedIn({
      register: [
        (router) =>
          router.on('GET', '/v1/boom', () => {
            throw new Error('boom')
          }),
      ],
    })
    const error = await createMockTransport(api, () => 0)({ method: 'GET', path: '/v1/boom' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 500 })
  })
})
