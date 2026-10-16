<script setup lang="ts">
const { t } = useI18n()
const { format } = useMoney()
const { page, items, isPending, isError, refetch } = useGoals()

const savedCaption = computed(() =>
  page.value ? t('goals.savedCaption', { amount: format(page.value.summary.saved, page.value.currency) }) : undefined,
)

useHead({ title: () => t('navigation.goals') })
</script>

<template>
  <PageHeader :title="t('navigation.goals')">
    <template #eyebrow>
      <span class="hidden lg:inline">{{ t('goals.eyebrow') }}</span>
      <span v-if="savedCaption" class="lg:hidden">{{ savedCaption }}</span>
      <Skeleton v-else-if="isPending" width="8rem" height="1rem" class="lg:hidden!" />
    </template>
  </PageHeader>
  <ErrorState v-if="isError" @retry="refetch" />
  <div v-else-if="isPending || !page" class="flex flex-col gap-6" aria-hidden="true">
    <div class="hidden grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-4 lg:grid">
      <Skeleton v-for="index in 3" :key="index" height="6.5rem" border-radius="16px" />
    </div>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4">
      <Skeleton v-for="index in 3" :key="index" height="12rem" border-radius="16px" />
    </div>
  </div>
  <EmptyState
    v-else-if="items.length === 0"
    :title="t('goals.empty.title')"
    :description="t('goals.empty.description')"
  />
  <template v-else>
    <GoalSummaryCards :summary="page.summary" :currency="page.currency" />
    <section
      :aria-label="t('goals.list.label')"
      class="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4"
    >
      <GoalCard v-for="goal in items" :key="goal.id" :goal="goal" :currency="page.currency" />
    </section>
  </template>
</template>
