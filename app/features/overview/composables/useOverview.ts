import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { OverviewRange } from '~/shared/api/contract'
import { overviewKeys } from '../api/keys'
import { overviewApi } from '../api/overviewApi'

export function useOverview(range: MaybeRefOrGetter<OverviewRange>) {
  const api = overviewApi(useApi())
  const query = useQuery({
    queryKey: computed(() => overviewKeys.range(toValue(range))),
    queryFn: ({ queryKey }) => api.get(queryKey[1]),
    placeholderData: keepPreviousData,
  })

  return { overview: query.data, isError: query.isError, refetch: query.refetch }
}
