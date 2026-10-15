import type { QueryClient, QueryKey } from '@tanstack/vue-query'

export type DataChange = 'settings' | 'demo'

export const invalidationMap: Record<DataChange, readonly QueryKey[]> = {
  settings: [['overview'], ['budgets'], ['reports'], ['transactions'], ['accounts']],
  demo: [[]],
}

export async function invalidateAfter(queryClient: QueryClient, change: DataChange): Promise<void> {
  await Promise.all(invalidationMap[change].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}
