import { describe, expect, it } from 'bun:test'
import { createPluralRule } from '../../i18n/plural-rules'

describe('createPluralRule', () => {
  it.each([
    [1, 0],
    [2, 1],
    [4, 1],
    [5, 2],
    [11, 2],
    [21, 0],
    [22, 1],
    [0, 2],
    [1.5, 3],
  ])('ru: %d -> form %d', (count, form) => {
    expect(createPluralRule('ru')(count, 4)).toBe(form)
  })

  it.each([
    [1, 0],
    [2, 1],
    [5, 2],
    [12, 2],
    [21, 2],
    [22, 1],
  ])('pl: %d -> form %d', (count, form) => {
    expect(createPluralRule('pl')(count, 4)).toBe(form)
  })

  it('never returns an index beyond the available forms', () => {
    expect(createPluralRule('uk')(1.5, 3)).toBe(2)
  })
})
