import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ReportRange } from '~/shared/api/contract'
import { reportKeys } from '../api/keys'
import { reportsApi } from '../api/reportsApi'

export function useReport(range: MaybeRefOrGetter<ReportRange>) {
  const api = reportsApi(useApi())
  const query = useQuery({
    queryKey: computed(() => reportKeys.range(toValue(range))),
    queryFn: ({ queryKey }) => api.get(queryKey[1]),
    placeholderData: keepPreviousData,
  })

  return {
    report: query.data,
    isError: query.isError,
    isPlaceholderData: query.isPlaceholderData,
    refetch: query.refetch,
  }
}
