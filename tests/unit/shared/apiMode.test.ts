import { describe, expect, it } from 'bun:test'
import { resolveApiMode } from '../../../app/shared/api/apiMode'

describe('resolveApiMode', () => {
  it('is mock when mocks are on and nothing is routed to the backend', () => {
    expect(resolveApiMode(true, '')).toBe('mock')
    expect(resolveApiMode(true, ' , ')).toBe('mock')
  })

  it('is hybrid when mocks are on and some paths go to the backend', () => {
    expect(resolveApiMode(true, '/v1/auth,/v1/me')).toBe('hybrid')
  })

  it('is real when mocks are off, whatever the paths are', () => {
    expect(resolveApiMode(false, '')).toBe('real')
    expect(resolveApiMode(false, '/v1/auth')).toBe('real')
  })
})
