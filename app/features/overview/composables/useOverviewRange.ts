import type { OverviewRange } from '~/shared/api/contract'
import { resolveOverviewRange } from '../utils/overviewView'

export function useOverviewRange() {
  const route = useRoute()
  const router = useRouter()

  return computed<OverviewRange>({
    get: () => resolveOverviewRange(route.query.range),
    set: (range) => {
      router.replace({ query: { ...route.query, range } })
    },
  })
}
