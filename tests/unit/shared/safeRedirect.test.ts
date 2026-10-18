import { describe, expect, it } from 'bun:test'
import { safeRedirect } from '../../../app/shared/auth/safeRedirect'

describe('safeRedirect', () => {
  it('returns a same-origin relative path unchanged', () => {
    expect(safeRedirect('/budgets?period=2026-10')).toBe('/budgets?period=2026-10')
  })

  it.each(['/pl/budgets', '/budgets?period=2026-10#top', '/%09/x'])('allows %s', (value) => {
    expect(safeRedirect(value)).toBe(value)
  })

  it.each([
    ['a tab after the slash', '/\t/evil.example'],
    ['a space after the slash', '/ /evil.example'],
    ['a newline after the slash', '/\n/evil.example'],
    ['an absolute url', 'https://evil.example'],
    ['a protocol-relative url', '//evil.example'],
    ['a backslash after the slash', '/\\evil.example'],
    ['undefined', undefined],
    ['an empty string', ''],
    ['a path without a leading slash', 'budgets'],
    ['an array', ['/budgets']],
  ])('returns / for %s', (_, value) => {
    expect(safeRedirect(value)).toBe('/')
  })
})
