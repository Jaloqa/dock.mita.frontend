import { type GroupScope, scopeKey } from '../utils/scope'

const scoped = (scope: GroupScope) => ['groups', ...scopeKey(scope)] as const

export const groupKeys = {
  all: ['groups'],
  list: ['groups', 'list'],
  scoped,
  group: (scope: GroupScope) => [...scoped(scope), 'group'] as const,
} as const
