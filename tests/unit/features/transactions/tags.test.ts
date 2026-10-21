import { describe, expect, it } from 'bun:test'
import { addTag, normalizeTag, tagSuggestions, visibleTags } from '../../../../app/features/transactions/utils/tags'

describe('tag helpers', () => {
  it('normalizes a name by trimming and lower-casing', () => {
    expect(normalizeTag('  TriP ')).toBe('trip')
  })

  it('offers a create option first, then the matches', () => {
    expect(tagSuggestions('tr', ['Trip', 'Travel', 'Food'], [])).toEqual([
      { name: 'tr', create: true },
      { name: 'Trip', create: false },
      { name: 'Travel', create: false },
    ])
  })

  it('puts the exact match first and offers no create option for it', () => {
    expect(tagSuggestions('trip', ['Trip', 'Trips'], [])).toEqual([
      { name: 'Trip', create: false },
      { name: 'Trips', create: false },
    ])
    expect(tagSuggestions('trip', ['Trips', 'Trip'], [])).toEqual([
      { name: 'Trip', create: false },
      { name: 'Trips', create: false },
    ])
  })

  it('leaves out chosen tags, case-insensitively', () => {
    expect(tagSuggestions('trip', ['Trip'], ['TRIP'])).toEqual([])
  })

  it('offers nothing for blank text', () => {
    expect(tagSuggestions('  ', ['Trip'], [])).toEqual([])
  })

  it('caps the options at ten', () => {
    const existing = Array.from({ length: 15 }, (_, index) => `trip${index}`)
    expect(tagSuggestions('trip', existing, [])).toHaveLength(10)
  })

  it('adds a trimmed name without duplicates and keeps the order', () => {
    expect(addTag(['Trip'], ' trip ')).toEqual(['Trip'])
    expect(addTag([], ' Food ')).toEqual(['Food'])
    expect(addTag(['Trip'], 'Food')).toEqual(['Trip', 'Food'])
    expect(addTag(['Trip'], '   ')).toEqual(['Trip'])
  })

  it('shows the first tags and counts the hidden ones', () => {
    expect(visibleTags(['a', 'b', 'c', 'd'], 2)).toEqual({ shown: ['a', 'b'], hidden: 2 })
    expect(visibleTags(['a', 'b'], 3)).toEqual({ shown: ['a', 'b'], hidden: 0 })
    expect(visibleTags([], 3)).toEqual({ shown: [], hidden: 0 })
  })
})
