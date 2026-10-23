import type { Currency } from '~/shared/money/currencies'
import { type GroupScope, scopeKey } from '../utils/scope'

const scoped = (scope: GroupScope) => ['groups', ...scopeKey(scope)] as const

export const groupKeys = {
  all: ['groups'],
  list: ['groups', 'list'],
  scoped,
  group: (scope: GroupScope) => [...scoped(scope), 'group'] as const,
  expenses: (scope: GroupScope, deleted: boolean) => [...scoped(scope), 'expenses', deleted] as const,
  repayments: (scope: GroupScope, deleted: boolean) => [...scoped(scope), 'repayments', deleted] as const,
  balances: (scope: GroupScope, currency: Currency) => [...scoped(scope), 'balances', currency] as const,
} as const
