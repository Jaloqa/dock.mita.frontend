import type { Currency } from '~/shared/money/money'

export const rateKeys = {
  all: ['rates'],
  table: (to: Currency, date?: string) => ['rates', to, date ?? 'today'] as const,
} as const
