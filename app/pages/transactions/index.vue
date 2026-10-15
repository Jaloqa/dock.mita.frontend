<script setup lang="ts">
const { t, d } = useI18n()
const screen = useTransactionsScreen()
const { filters, sort, rows, total, sum, currency, isPending, isError, emptyState, hasNextPage, isFetchingNextPage } =
  screen
const dialog = useTransactionDialog()
const exporter = useTransactionExport()

const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number)
  return d(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 15)), { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const eyebrow = computed(() => {
  const key = screen.periodKey.value
  return key ? monthLabel(key) : t(`transactions.period.${filters.value.period}`)
})

useHead({ title: () => t('navigation.transactions') })
</script>

<template>
  <PageHeader :title="t('navigation.transactions')" :eyebrow="eyebrow">
    <template #actions>
      <Button
        severity="secondary"
        outlined
        class="min-h-11"
        :loading="exporter.exporting.value"
        :disabled="!screen.ready.value"
        @click="exporter.exportCsv(screen.query.value)"
      >
        <AppIcon name="download" :size="16" />
        {{ t('transactions.actions.export') }}
      </Button>
      <Button class="min-h-11" @click="dialog.openCreate()">
        <AppIcon name="plus" :size="16" :stroke-width="2.2" />
        {{ t('transactions.actions.add') }}
      </Button>
    </template>
  </PageHeader>
  <section
    :aria-label="t('transactions.filters.label')"
    class="flex flex-wrap items-end gap-3 rounded-(--radius-card) bg-surface px-5.5 py-4.5"
  >
    <TransactionSearch id="transactions-search" v-model="filters.search" class="flex-[2_1_240px]" />
    <TransactionFilterFields
      v-model:category-id="filters.categoryId"
      v-model:account-id="filters.accountId"
      v-model:period="filters.period"
      id-prefix="transactions"
      :categories="screen.categories.value"
      :accounts="screen.accounts.value"
    />
    <TransactionKindTabs v-model="filters.kind" />
  </section>
  <TransactionSummary
    v-if="!isPending && !isError && currency"
    :count="total ?? 0"
    :sum="sum ?? 0"
    :currency="currency"
  />
  <ErrorState v-if="isError" @retry="screen.retry" />
  <section v-else-if="isPending" class="flex flex-col gap-3 rounded-(--radius-card) bg-surface p-4" aria-hidden="true">
    <Skeleton v-for="index in 8" :key="index" height="2.75rem" />
  </section>
  <EmptyState
    v-else-if="rows.length === 0 && emptyState === 'filtered'"
    :title="t('transactions.empty.filteredTitle')"
    :description="t('transactions.empty.filteredDescription')"
  >
    <template #action>
      <div class="flex flex-wrap justify-center gap-2">
        <Button
          :label="t('transactions.actions.resetFilters')"
          severity="secondary"
          outlined
          @click="screen.resetFilters"
        />
        <Button
          v-if="screen.offersAllTime.value"
          :label="t('transactions.actions.showAllTime')"
          severity="secondary"
          outlined
          @click="screen.showAllTime"
        />
      </div>
    </template>
  </EmptyState>
  <EmptyState
    v-else-if="rows.length === 0 && emptyState === 'period'"
    :title="t('transactions.empty.filteredTitle')"
    :description="t('transactions.empty.periodDescription')"
  >
    <template #action>
      <Button
        :label="t('transactions.actions.showAllTime')"
        severity="secondary"
        outlined
        @click="screen.showAllTime"
      />
    </template>
  </EmptyState>
  <EmptyState
    v-else-if="rows.length === 0"
    :title="t('transactions.empty.title')"
    :description="t('transactions.empty.description')"
  >
    <template #action>
      <Button :label="t('transactions.actions.addFirst')" @click="dialog.openCreate()" />
    </template>
  </EmptyState>
  <template v-else>
    <TransactionTable v-model:sort="sort" :rows="rows" @open="dialog.openEdit" />
    <div v-if="hasNextPage" class="flex justify-center">
      <Button
        :label="t('transactions.actions.showMore')"
        severity="secondary"
        outlined
        class="min-h-11"
        :loading="isFetchingNextPage"
        @click="screen.fetchNextPage()"
      />
    </div>
  </template>
</template>
