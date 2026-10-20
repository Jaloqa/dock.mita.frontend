import { describe, expect, it } from 'bun:test'
import { resolveApiMode } from '../../../app/shared/api/apiMode'

describe('resolveApiMode', () => {
  it('is mock when mocks are on', () => {
    expect(resolveApiMode(true)).toBe('mock')
  })

  it('is real when mocks are off', () => {
    expect(resolveApiMode(false)).toBe('real')
  })
})
