import { describe, expect, it } from 'bun:test'
import { isCardLast4 } from '../../../../app/features/accounts/schemas/accountSchema'

describe('account form rules', () => {
  it('accepts an empty value or exactly four digits as card digits', () => {
    expect(isCardLast4('')).toBe(true)
    expect(isCardLast4('0042')).toBe(true)
    expect(isCardLast4('123')).toBe(false)
    expect(isCardLast4('12a4')).toBe(false)
    expect(isCardLast4('12345')).toBe(false)
  })
})
