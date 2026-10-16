import type { QueryClient, QueryKey } from '@tanstack/vue-query'

export type DataChange =
  | 'settings'
  | 'demo'
  | 'accounts'
  | 'transfers'
  | 'categories'
  | 'transactions'
  | 'budgets'
  | 'goals'
  | 'goalContributions'

export const invalidationMap: Record<DataChange, readonly QueryKey[]> = {
  settings: [['overview'], ['budgets'], ['reports'], ['transactions'], ['accounts'], ['goals']],
  demo: [[]],
  accounts: [['accounts'], ['transfers'], ['transactions'], ['overview'], ['reports'], ['goals']],
  transfers: [['transfers'], ['accounts'], ['overview']],
  categories: [['categories'], ['transactions'], ['budgets'], ['overview'], ['reports']],
  transactions: [['transactions'], ['accounts'], ['categories'], ['budgets'], ['overview'], ['reports']],
  budgets: [['budgets'], ['overview']],
  goals: [['goals'], ['accounts'], ['overview']],
  goalContributions: [['goals'], ['accounts'], ['transfers'], ['overview']],
}

export async function invalidateAfter(queryClient: QueryClient, change: DataChange): Promise<void> {
  await Promise.all(invalidationMap[change].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}
