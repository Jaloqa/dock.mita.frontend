<script setup lang="ts">
import type { BudgetDto } from '~/shared/api/contract'

const { t } = useI18n()
const notify = useNotify()
const { period, previousKey, monthStart, page, cards, available, isPending, isError, isEmpty, canCopy, ready, retry } =
  useBudgetsScreen()
const { copy } = useBudgetMutations()

const dialogOpen = ref(false)
const categoriesOpen = ref(false)
const editing = ref<BudgetDto>()

const monthLabel = useMonthLabel()

const eyebrow = computed(() =>
  ready.value ? monthLabel(period.value, { withYear: true, capitalize: true }) : undefined,
)
const editingName = computed(() => cards.value.find((card) => card.budget.id === editing.value?.id)?.name)

function openCreate() {
  if (!page.value || isPending.value || isError.value) return
  editing.value = undefined
  dialogOpen.value = true
}

function openEdit(budget: BudgetDto) {
  editing.value = budget
  dialogOpen.value = true
}

function copyPrevious() {
  copy.mutate(
    { period: period.value },
    {
      onSuccess: (result) => notify.success(t('budgets.toast.copied', { count: result.copied }, result.copied)),
      onError: (error) => notify.error(error),
    },
  )
}

useHead({ title: () => t('navigation.budgets') })
</script>

<template>
  <PageHeader :title="t('navigation.budgets')" :eyebrow="eyebrow">
    <template #actions>
      <PeriodSwitcher v-if="ready" v-model="period" :month-start="monthStart" />
      <Skeleton v-else width="16rem" height="2.75rem" />
      <Button class="min-h-11" :disabled="!page || isPending || isError" @click="openCreate">
        <AppIcon name="plus" :size="16" :stroke-width="2.2" />
        {{ t('budgets.actions.add') }}
      </Button>
    </template>
  </PageHeader>
  <ErrorState v-if="isError" @retry="retry" />
  <div v-else-if="isPending || !page" class="flex flex-col gap-6" aria-hidden="true">
    <Skeleton height="9rem" border-radius="16px" />
    <div class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
      <Skeleton v-for="index in 6" :key="index" height="10.5rem" border-radius="16px" />
    </div>
  </div>
  <EmptyState v-else-if="isEmpty" :title="t('budgets.empty.title')" :description="t('budgets.empty.description')">
    <template #action>
      <div class="flex flex-wrap justify-center gap-2">
        <Button :label="t('budgets.actions.addFirst')" class="min-h-11" @click="openCreate" />
        <Button
          v-if="canCopy"
          :label="t('budgets.actions.copy', { month: monthLabel(previousKey) })"
          severity="secondary"
          outlined
          class="min-h-11"
          :loading="copy.isPending.value"
          @click="copyPrevious"
        />
      </div>
    </template>
  </EmptyState>
  <template v-else>
    <BudgetSummaryCard :summary="page.summary" :currency="page.currency" />
    <section :aria-label="t('budgets.list.label')" class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
      <BudgetCard
        v-for="card in cards"
        :key="card.budget.id"
        :budget="card.budget"
        :name="card.name"
        :currency="page.currency"
      >
        <template #actions>
          <Button
            text
            rounded
            severity="secondary"
            class="size-11"
            :aria-label="t('budgets.actions.edit', { name: card.name })"
            @click="openEdit(card.budget)"
          >
            <AppIcon name="edit" :size="18" />
          </Button>
        </template>
      </BudgetCard>
      <BudgetAddTile @add="openCreate" />
    </section>
  </template>
  <BudgetDialog
    v-if="page"
    v-model:visible="dialogOpen"
    :budget="editing"
    :category-name="editingName"
    :period="period"
    :categories="available"
    :currency="page.currency"
    @manage-categories="categoriesOpen = true"
  />
  <CategoryManagerDialog v-model:visible="categoriesOpen" />
</template>
