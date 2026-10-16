import type { Ref } from 'vue'
import { currentPeriodKey, type MonthStart } from '~/shared/period/period'
import { resolvePeriodKey } from '../utils/budgetView'

export function useBudgetPeriod(monthStart: Ref<MonthStart>) {
  const route = useRoute()
  const router = useRouter()
  const current = computed(() => currentPeriodKey(monthStart.value))

  const period = computed({
    get: () => resolvePeriodKey(route.query.period, current.value),
    set: (key: string) => {
      router.replace({ query: { ...route.query, period: key } })
    },
  })

  return { current, period }
}
