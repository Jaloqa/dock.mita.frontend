import type { Currency } from '~/shared/money/money'
import { RATES_PATH } from './ratesApi'

export const rateKeys = {
  all: ['rates'],
  table: (to: Currency, date?: string, path = RATES_PATH) => ['rates', path, to, date ?? 'today'] as const,
} as const
