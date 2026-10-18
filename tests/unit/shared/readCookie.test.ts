import { describe, expect, it } from 'bun:test'
import { readCookie } from '../../../app/shared/api/cookies'

describe('readCookie', () => {
  it('reads a cookie by name from a cookie header', () => {
    expect(readCookie('a=1; XSRF-TOKEN=abc%3D; b=2', 'XSRF-TOKEN')).toBe('abc=')
  })

  it('does not match a cookie whose name only ends with the requested one', () => {
    expect(readCookie('X-XSRF-TOKEN=nope', 'XSRF-TOKEN')).toBeUndefined()
  })

  it('returns undefined for a missing header or cookie', () => {
    expect(readCookie(undefined, 'XSRF-TOKEN')).toBeUndefined()
    expect(readCookie('a=1', 'XSRF-TOKEN')).toBeUndefined()
  })
})
