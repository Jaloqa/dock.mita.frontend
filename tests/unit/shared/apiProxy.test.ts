import { describe, expect, it } from 'bun:test'
import { resolveProxyUrl } from '../../../server/utils/apiProxy'

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
