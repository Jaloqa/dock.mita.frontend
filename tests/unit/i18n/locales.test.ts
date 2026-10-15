import { describe, expect, it } from 'bun:test'
import en from '../../../i18n/locales/en.json'
import pl from '../../../i18n/locales/pl.json'
import ru from '../../../i18n/locales/ru.json'
import uk from '../../../i18n/locales/uk.json'

const keysOf = (value: unknown, prefix = ''): string[] =>
  typeof value === 'object' && value !== null
    ? Object.entries(value).flatMap(([key, nested]) => keysOf(nested, prefix ? `${prefix}.${key}` : key))
    : [prefix]

describe('locales', () => {
  it.each([
    ['pl', pl],
    ['ru', ru],
    ['uk', uk],
  ])('%s has exactly the keys of en', (_name, locale) => {
    expect(keysOf(locale).sort()).toEqual(keysOf(en).sort())
  })

  it('contains the shared keys used by building blocks and validation', () => {
    expect(keysOf(en)).toEqual(
      expect.arrayContaining([
        'shared.actions.retry',
        'shared.error.title',
        'shared.error.description',
        'shared.period.label',
        'validation.required',
        'validation.invalidValue',
      ]),
    )
  })
})
