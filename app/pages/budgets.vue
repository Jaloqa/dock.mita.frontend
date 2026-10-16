<script setup lang="ts">
const { t, d } = useI18n()
const { period, monthStart, page, cards, isPending, isError, isEmpty, ready, retry } = useBudgetsScreen()

const eyebrow = computed(() => {
  if (!ready.value) return undefined
  const [year, month] = period.value.split('-').map(Number)
  return d(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 15)), { month: 'long', year: 'numeric', timeZone: 'UTC' })
})

useHead({ title: () => t('navigation.budgets') })
</script>

<template>
  <PageHeader :title="t('navigation.budgets')" :eyebrow="eyebrow">
    <template #actions>
      <PeriodSwitcher v-if="ready" v-model="period" :month-start="monthStart" />
      <Skeleton v-else width="16rem" height="2.75rem" />
    </template>
  </PageHeader>
  <ErrorState v-if="isError" @retry="retry" />
  <div v-else-if="isPending || !page" class="flex flex-col gap-6" aria-hidden="true">
    <Skeleton height="9rem" border-radius="16px" />
    <div class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
      <Skeleton v-for="index in 6" :key="index" height="10.5rem" border-radius="16px" />
    </div>
  </div>
  <EmptyState v-else-if="isEmpty" :title="t('budgets.empty.title')" :description="t('budgets.empty.description')" />
  <template v-else>
    <BudgetSummaryCard :summary="page.summary" :currency="page.currency" />
    <section :aria-label="t('budgets.list.label')" class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
      <BudgetCard
        v-for="card in cards"
        :key="card.budget.id"
        :budget="card.budget"
        :name="card.name"
        :currency="page.currency"
      />
    </section>
  </template>
</template>
