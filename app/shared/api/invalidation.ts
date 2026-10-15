import type { QueryClient, QueryKey } from '@tanstack/vue-query'

export type DataChange = 'settings' | 'demo' | 'accounts' | 'transfers' | 'categories'

export const invalidationMap: Record<DataChange, readonly QueryKey[]> = {
  settings: [['overview'], ['budgets'], ['reports'], ['transactions'], ['accounts']],
  demo: [[]],
  accounts: [['accounts'], ['transfers'], ['transactions'], ['overview'], ['reports']],
  transfers: [['transfers'], ['accounts'], ['overview']],
  categories: [['categories'], ['transactions'], ['budgets'], ['overview'], ['reports']],
}

export async function invalidateAfter(queryClient: QueryClient, change: DataChange): Promise<void> {
  await Promise.all(invalidationMap[change].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}
