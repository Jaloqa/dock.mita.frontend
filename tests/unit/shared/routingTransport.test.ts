import { describe, expect, it } from 'bun:test'
import type { ApiRequest, Transport } from '../../../app/shared/api/transport'
import { createRoutingTransport, matchesRealPath, parseRealPaths } from '../../../app/shared/api/transports/routing'

describe('parseRealPaths', () => {
  it('trims, drops empty entries and strips a trailing slash', () => {
    expect(parseRealPaths(' /v1/auth, /v1/me/ ,,')).toEqual(['/v1/auth', '/v1/me'])
  })

  it('returns an empty list for an empty value', () => {
    expect(parseRealPaths('')).toEqual([])
  })
})

describe('matchesRealPath', () => {
  it('matches the exact path', () => {
    expect(matchesRealPath('/v1/me', ['/v1/me'])).toBe(true)
  })

  it('matches nested paths', () => {
    expect(matchesRealPath('/v1/me/x', ['/v1/me'])).toBe(true)
    expect(matchesRealPath('/v1/auth/login', ['/v1/auth'])).toBe(true)
  })

  it('matches whole segments only', () => {
    expect(matchesRealPath('/v1/mestatus', ['/v1/me'])).toBe(false)
  })

  it('does not match with an empty list', () => {
    expect(matchesRealPath('/v1/me', [])).toBe(false)
  })
})

describe('createRoutingTransport', () => {
  const setup = (realPaths: string[]) => {
    const calls: string[] = []
    const http: Transport = async (request: ApiRequest) => {
      calls.push(`http:${request.path}`)
      return 'http'
    }
    const mock: Transport = async (request: ApiRequest) => {
      calls.push(`mock:${request.path}`)
      return 'mock'
    }
    return { calls, transport: createRoutingTransport({ http, mock, realPaths }) }
  }

  it('sends real paths to http and the rest to mock', async () => {
    const { calls, transport } = setup(['/v1/settings'])
    await transport({ method: 'GET', path: '/v1/settings' })
    await transport({ method: 'GET', path: '/v1/transactions' })
    expect(calls).toEqual(['http:/v1/settings', 'mock:/v1/transactions'])
  })

  it('sends everything to mock when the list is empty', async () => {
    const { calls, transport } = setup([])
    await transport({ method: 'GET', path: '/v1/settings' })
    expect(calls).toEqual(['mock:/v1/settings'])
  })
})
