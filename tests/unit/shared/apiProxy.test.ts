import { describe, expect, it } from 'bun:test'
import { forwardedHeaders, isApiPath, resolveProxyUrl } from '../../../server/utils/apiProxy'

describe('forwardedHeaders', () => {
  it('starts the chain with the peer', () => {
    expect(forwardedHeaders({}, { ip: '172.18.0.1', protocol: 'http' })).toEqual({
      'x-forwarded-for': '172.18.0.1',
      'x-forwarded-proto': 'http',
    })
  })

  it('keeps the incoming chain and appends the peer', () => {
    expect(
      forwardedHeaders(
        { forwardedFor: '203.0.113.9, 10.0.0.3', forwardedProto: 'https, https' },
        { ip: '10.0.0.4', protocol: 'http' },
      ),
    ).toEqual({ 'x-forwarded-for': '203.0.113.9, 10.0.0.3, 10.0.0.4', 'x-forwarded-proto': 'https, https, http' })
  })

  it('trims blank entries of the incoming chain', () => {
    expect(
      forwardedHeaders({ forwardedFor: ' , 1.2.3.4' }, { ip: '10.0.0.4', protocol: 'http' })['x-forwarded-for'],
    ).toBe('1.2.3.4, 10.0.0.4')
  })

  it('writes IPv4-mapped peers as IPv4', () => {
    expect(forwardedHeaders({}, { ip: '::ffff:172.18.0.1', protocol: 'http' })['x-forwarded-for']).toBe('172.18.0.1')
  })

  it('keeps IPv6 peers', () => {
    expect(forwardedHeaders({}, { ip: '2001:db8::1', protocol: 'https' })['x-forwarded-for']).toBe('2001:db8::1')
  })

  it('drops a client chain when the peer is unknown', () => {
    expect(forwardedHeaders({ forwardedFor: '198.51.100.1', forwardedProto: 'https' }, { protocol: 'http' })).toEqual({
      'x-forwarded-for': '',
      'x-forwarded-proto': '',
    })
  })
})

describe('isApiPath', () => {
  it.each(['/v1', '/v1/', '/v1/me', '/v1/me?x=1'])('is true for %s', (url) => expect(isApiPath(url)).toBe(true))
  it.each(['/', '/v10/me', '/en/login', '/v1me'])('is false for %s', (url) => expect(isApiPath(url)).toBe(false))
})

describe('resolveProxyUrl', () => {
  it('builds the target url keeping the query', () => {
    expect(resolveProxyUrl('http://localhost:8080/', '/v1/me?x=1')).toBe('http://localhost:8080/v1/me?x=1')
  })

  it('returns null when the target is empty', () => {
    expect(resolveProxyUrl('', '/v1/me')).toBeNull()
  })

  it('returns null for paths outside /v1', () => {
    expect(resolveProxyUrl('http://localhost:8080', '/v10/me')).toBeNull()
    expect(resolveProxyUrl('http://localhost:8080', '/en/login')).toBeNull()
  })

  it.each(['/v1/../health/ready', '/v1/%2e%2e/health', '/v1/%2E%2E/health', '/v1\\..\\x', '/v1/./me', '/v1/me/..'])(
    'returns null for %s',
    (requestUrl) => {
      expect(resolveProxyUrl('http://localhost:8080', requestUrl)).toBeNull()
    },
  )

  it('proxies /v1 itself', () => {
    expect(resolveProxyUrl('http://localhost:8080', '/v1')).toBe('http://localhost:8080/v1')
  })
})
