import type { ReportRange } from '~/shared/api/contract'
import { resolveReportRange } from '../utils/reportsView'

export function useReportRange() {
  const route = useRoute()
  const router = useRouter()

  return computed<ReportRange>({
    get: () => resolveReportRange(route.query.range),
    set: (range) => {
      router.replace({ query: { ...route.query, range } })
    },
  })
}
