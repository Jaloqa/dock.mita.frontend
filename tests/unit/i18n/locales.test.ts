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

  it.each([
    ['en', en],
    ['pl', pl],
    ['ru', ru],
    ['uk', uk],
  ])('%s explains the exchange rate of a goal contribution like the one of a transfer', (_name, locale) => {
    expect(locale.goals.contribute.rateHint).toBe(locale.accounts.transferDialog.rateHint)
    expect(locale.goals.contribute.rate).toBe(locale.accounts.transferDialog.rate)
  })

  it.each([
    ['ru', ru, 'Изменение'],
    ['uk', uk, 'Зміна'],
  ])('%s names every edit dialog the same way', (_name, locale, prefix) => {
    const titles = [
      locale.accounts.dialog.editTitle,
      locale.categories.form.editTitle,
      locale.transactions.dialog.editTitle,
      locale.budgets.dialog.editTitle,
      locale.goals.dialog.editTitle,
      locale.debts.dialog.editTitle,
      locale.groups.dialog.editTitle,
      locale.groups.expense.editTitle,
      locale.groups.repayment.editTitle,
    ]
    for (const title of titles) expect(title.startsWith(prefix)).toBe(true)
  })
})
