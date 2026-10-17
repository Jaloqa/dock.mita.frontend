import { createPluralRule } from './plural-rules'

const currency = {
  currency: { style: 'currency', currency: 'PLN', currencyDisplay: 'narrowSymbol' },
  percent: { style: 'percent', maximumFractionDigits: 1 },
} as const

const dates = {
  short: { day: 'numeric', month: 'short' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  monthYear: { month: 'long', year: 'numeric' },
  dayMonth: { day: 'numeric', month: 'long', timeZone: 'UTC' },
} as const

export default defineI18nConfig(() => ({
  fallbackLocale: 'en',
  pluralRules: {
    pl: createPluralRule('pl'),
    ru: createPluralRule('ru'),
    uk: createPluralRule('uk'),
  },
  numberFormats: { en: currency, pl: currency, ru: currency, uk: currency },
  datetimeFormats: { en: dates, pl: dates, ru: dates, uk: dates },
}))
