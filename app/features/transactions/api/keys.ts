import type { TransactionQuery } from '~/shared/api/contract'

export const transactionKeys = {
  all: ['transactions'],
  list: (query: TransactionQuery) => ['transactions', 'list', query] as const,
} as const
