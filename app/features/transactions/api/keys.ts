import type { TransactionQuery } from '~/shared/api/contract'

export const transactionKeys = {
  all: ['transactions'],
  list: (query: TransactionQuery) => ['transactions', 'list', query] as const,
} as const

export const tagKeys = {
  all: ['tags'],
  list: ['tags', 'list'],
  suggestions: (search: string) => ['tags', 'suggestions', search] as const,
} as const
