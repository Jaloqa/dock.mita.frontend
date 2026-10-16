import { useQuery } from '@tanstack/vue-query'
import { settingsKeys } from '../api/keys'
import { settingsApi } from '../api/settingsApi'

export function useDemoState() {
  const api = settingsApi(useApi())
  const query = useQuery({ queryKey: settingsKeys.demo, queryFn: api.demoState })

  return {
    state: computed(() => query.data.value),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
