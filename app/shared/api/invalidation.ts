import type { QueryClient, QueryKey } from '@tanstack/vue-query'

export type DataChange =
  | 'settings'
  | 'profile'
  | 'demo'
  | 'accounts'
  | 'transfers'
  | 'categories'
  | 'transactions'
  | 'tags'
  | 'budgets'
  | 'goals'
  | 'goalContributions'
  | 'debts'

export const invalidationMap: Record<DataChange, readonly QueryKey[]> = {
  settings: [['overview'], ['budgets'], ['reports'], ['transactions'], ['accounts'], ['goals'], ['debts']],
  profile: [['demo']],
  demo: [[]],
  accounts: [['accounts'], ['transfers'], ['transactions'], ['overview'], ['reports'], ['goals']],
  transfers: [['transfers'], ['accounts'], ['overview']],
  categories: [['categories'], ['transactions'], ['budgets'], ['overview'], ['reports']],
  transactions: [['transactions'], ['tags'], ['accounts'], ['categories'], ['budgets'], ['overview'], ['reports']],
  tags: [['tags'], ['transactions']],
  budgets: [['budgets'], ['overview']],
  goals: [['goals'], ['accounts'], ['overview']],
  goalContributions: [['goals'], ['accounts'], ['transfers'], ['overview']],
  debts: [['debts'], ['accounts'], ['overview']],
}

export async function invalidateAfter(queryClient: QueryClient, change: DataChange): Promise<void> {
  await Promise.all(invalidationMap[change].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}
