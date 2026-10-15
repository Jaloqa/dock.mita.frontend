import { describe, expect, it } from 'bun:test'
import { createApiClient } from '../../../app/shared/api/client'
import { ApiError, fieldErrorsOf, isApiError, toApiError } from '../../../app/shared/api/problem'
import type { ApiRequest } from '../../../app/shared/api/transport'
import { createHttpTransport, type Fetcher } from '../../../app/shared/api/transports/http'

describe('ApiError', () => {
  it('keeps ProblemDetails and normalizes field names to camelCase', () => {
    const error = toApiError(400, {
      title: 'Validation failed',
      status: 400,
      errors: { Amount: ['validation.amountPositive'], categoryId: ['validation.required'] },
    })
    expect(isApiError(error)).toBe(true)
    expect(error.status).toBe(400)
    expect(error.title).toBe('Validation failed')
    expect(error.fieldErrors).toEqual({ amount: ['validation.amountPositive'], categoryId: ['validation.required'] })
  })

  it('falls back to a generic error when the body is not ProblemDetails', () => {
    expect(toApiError(502, '<html>Bad gateway</html>')).toMatchObject({ status: 502, title: 'Server error' })
    expect(toApiError(404, undefined)).toMatchObject({ status: 404, title: 'Request failed', fieldErrors: {} })
  })

  it('reads field errors from any value', () => {
    const error = new ApiError({ title: 'Invalid', status: 400, errors: { name: ['validation.required'] } })
    expect(fieldErrorsOf(error, 'name')).toEqual(['validation.required'])
    expect(fieldErrorsOf(error, 'email')).toEqual([])
    expect(fieldErrorsOf(new Error('boom'), 'name')).toEqual([])
  })
})

describe('createApiClient', () => {
  it('maps calls to transport requests', async () => {
    const seen: ApiRequest[] = []
    const client = createApiClient(async (request) => {
      seen.push(request)
      return { ok: true }
    })
    await client.get('/v1/items', { page: 2 })
    await client.post('/v1/items', { name: 'a' })
    await client.put('/v1/items/1', { name: 'b' })
    await client.delete('/v1/items/1')
    expect(seen).toEqual([
      { method: 'GET', path: '/v1/items', query: { page: 2 } },
      { method: 'POST', path: '/v1/items', body: { name: 'a' } },
      { method: 'PUT', path: '/v1/items/1', body: { name: 'b' } },
      { method: 'DELETE', path: '/v1/items/1' },
    ])
  })
})

describe('createHttpTransport', () => {
  it('sends the request with locale, credentials and without undefined query values', async () => {
    const calls: Parameters<Fetcher>[] = []
    const fetcher: Fetcher = async (...args) => {
      calls.push(args)
      return { id: 1 }
    }
    const transport = createHttpTransport(fetcher, { baseUrl: 'https://api.test', locale: () => 'pl' })
    const result = await transport({ method: 'GET', path: '/v1/items', query: { page: 1, search: undefined } })
    expect(result).toEqual({ id: 1 })
    expect(calls[0]).toEqual([
      'https://api.test/v1/items',
      {
        method: 'GET',
        query: { page: 1 },
        body: undefined,
        headers: { 'Accept-Language': 'pl' },
        credentials: 'include',
      },
    ])
  })

  it('turns fetch errors with ProblemDetails into ApiError', async () => {
    const fetcher: Fetcher = async () => {
      throw Object.assign(new Error('400'), {
        status: 400,
        data: { title: 'Invalid', status: 400, errors: { Name: ['x'] } },
      })
    }
    const transport = createHttpTransport(fetcher, { baseUrl: '', locale: () => 'en' })
    const error = await transport({ method: 'POST', path: '/v1/items' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).fieldErrors).toEqual({ name: ['x'] })
  })

  it('turns network failures without status into a 503 ApiError', async () => {
    const fetcher: Fetcher = async () => {
      throw new TypeError('fetch failed')
    }
    const transport = createHttpTransport(fetcher, { baseUrl: '', locale: () => 'en' })
    const error = await transport({ method: 'GET', path: '/v1/items' }).catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 503, title: 'Server error' })
  })
})
