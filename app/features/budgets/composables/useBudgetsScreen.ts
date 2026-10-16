import { useCategories } from '~/shared/categories/useCategories'
import { shiftPeriod } from '~/shared/period/period'
import { useUserSettings } from '~/shared/user/useUserSettings'
import { budgetableCategories } from '../utils/budgetView'

export function useBudgetsScreen() {
  const settings = useUserSettings()
  const categories = useCategories()
  const ready = computed(() => !settings.isPending.value && !settings.isError.value)
  const { period, current } = useBudgetPeriod(settings.monthStart)
  const list = useBudgets(period, { enabled: ready })
  const previousKey = computed(() => shiftPeriod(period.value, -1, settings.monthStart.value).key)
  const isEmpty = computed(() => list.page.value !== undefined && list.items.value.length === 0)
  const previous = useBudgets(previousKey, { enabled: computed(() => ready.value && isEmpty.value) })
  const canCopy = computed(() => isEmpty.value && (previous.page.value?.total ?? 0) > 0)

  const cards = computed(() =>
    list.items.value.map((budget) => ({ budget, name: categories.nameOf(budget.categoryId) ?? '' })),
  )
  const available = computed(() => budgetableCategories(categories.categories.value, list.items.value))

  const isError = computed(() => settings.isError.value || list.isError.value || categories.isError.value)
  const isPending = computed(
    () => !isError.value && (settings.isPending.value || list.isPending.value || categories.isPending.value),
  )

  function retry() {
    if (settings.isError.value) settings.refetch()
    if (list.isError.value) list.refetch()
    if (categories.isError.value) categories.refetch()
  }

  return {
    period,
    current,
    previousKey,
    monthStart: settings.monthStart,
    page: list.page,
    cards,
    available,
    isEmpty,
    canCopy,
    isPending,
    isError,
    ready,
    retry,
  }
}
