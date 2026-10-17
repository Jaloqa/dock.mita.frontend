import { describe, expect, it } from 'bun:test'
import { capitalizeFirst } from '../../../app/shared/utils/text'

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
