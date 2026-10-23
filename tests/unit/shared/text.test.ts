import { describe, expect, it } from 'bun:test'
import { capitalizeFirst, hasText, trimmedWithin } from '../../../app/shared/utils/text'

describe('capitalizeFirst', () => {
  it('upper-cases only the first letter of a month name in every locale', () => {
    expect(capitalizeFirst('październik 2026', 'pl')).toBe('Październik 2026')
    expect(capitalizeFirst('октябрь', 'ru')).toBe('Октябрь')
    expect(capitalizeFirst('жовтень 2026', 'uk')).toBe('Жовтень 2026')
    expect(capitalizeFirst('October', 'en')).toBe('October')
  })

  it('keeps an empty label empty', () => {
    expect(capitalizeFirst('', 'pl')).toBe('')
  })
})

describe('hasText', () => {
  it('accepts a string with a visible character', () => {
    expect(hasText('Anna')).toBe(true)
    expect(hasText('  Anna  ')).toBe(true)
  })

  it('rejects an empty or blank string and anything that is not a string', () => {
    expect(hasText('')).toBe(false)
    expect(hasText('   ')).toBe(false)
    expect(hasText(null)).toBe(false)
    expect(hasText(undefined)).toBe(false)
    expect(hasText(7)).toBe(false)
  })
})

describe('trimmedWithin', () => {
  const within3 = trimmedWithin(3)

  it('counts the length after trimming', () => {
    expect(within3('abc')).toBe(true)
    expect(within3('  abc  ')).toBe(true)
    expect(within3('abcd')).toBe(false)
    expect(within3('  abcd  ')).toBe(false)
  })

  it('lets an empty value and a non-string value pass for the required rule to judge', () => {
    expect(within3('')).toBe(true)
    expect(within3(null)).toBe(true)
    expect(within3(undefined)).toBe(true)
  })
})
