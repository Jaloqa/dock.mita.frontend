<script setup lang="ts">
const { t } = useI18n()
const monthLabel = useMonthLabel()
const screen = useTransactionsScreen()
const { filters, sort, rows, total, sum, currency, isPending, isError, emptyState, hasNextPage, isFetchingNextPage } =
  screen
const dialog = useTransactionDialog()
const exporter = useTransactionExport()
const filtersOpen = ref(false)

const eyebrow = computed(() => {
  const key = screen.periodKey.value
  return key ? monthLabel(key, { withYear: true, capitalize: true }) : t(`transactions.period.${filters.value.period}`)
})

const exportCsv = () => exporter.exportCsv(screen.query.value)

useHead({ title: () => t('navigation.transactions') })
</script>

<template>
  <PageHeader :title="t('navigation.transactions')" :eyebrow="eyebrow">
    <template #actions>
      <Button
        severity="secondary"
        outlined
        class="hidden! min-h-11 lg:inline-flex!"
        :loading="exporter.exporting.value"
        :disabled="!screen.ready.value"
        @click="exportCsv"
      >
        <AppIcon name="download" :size="16" />
        {{ t('transactions.actions.export') }}
      </Button>
      <Button class="hidden! min-h-11 lg:inline-flex!" @click="dialog.openCreate()">
        <AppIcon name="plus" :size="16" :stroke-width="2.2" />
        {{ t('transactions.actions.add') }}
      </Button>
      <Button
        severity="secondary"
        outlined
        class="size-11 lg:hidden!"
        :aria-label="t('transactions.actions.filters')"
        @click="filtersOpen = true"
      >
        <AppIcon name="filter" :size="20" />
      </Button>
      <Button
        severity="secondary"
        outlined
        class="size-11 lg:hidden!"
        :aria-label="t('transactions.actions.export')"
        :loading="exporter.exporting.value"
        :disabled="!screen.ready.value"
        @click="exportCsv"
      >
        <AppIcon name="download" :size="20" />
      </Button>
    </template>
  </PageHeader>
  <section
    :aria-label="t('transactions.filters.label')"
    class="hidden flex-wrap items-end gap-3 rounded-(--radius-card) bg-surface px-5.5 py-4.5 lg:flex"
  >
    <TransactionSearch id="transactions-search" v-model="filters.search" class="flex-[2_1_240px]" />
    <TransactionFilterFields
      v-model:category-id="filters.categoryId"
      v-model:account-id="filters.accountId"
      v-model:tags="filters.tags"
      v-model:period="filters.period"
      id-prefix="transactions"
      :categories="screen.categories.value"
      :accounts="screen.accounts.value"
    />
    <TransactionKindTabs v-model="filters.kind" />
  </section>
  <div class="flex flex-col gap-3 lg:hidden">
    <TransactionSearch id="transactions-search-mobile" v-model="filters.search" variant="bar" />
    <TransactionKindTabs v-model="filters.kind" variant="chips" />
  </div>
  <TransactionSummary
    v-if="!isPending && !isError && currency"
    :count="total ?? 0"
    :sum="sum ?? 0"
    :currency="currency"
  />
  <ErrorState v-if="isError" @retry="screen.retry" />
  <div v-else-if="isPending" class="flex flex-col gap-3" aria-hidden="true">
    <section class="hidden flex-col gap-3 rounded-(--radius-card) bg-surface p-4 lg:flex">
      <Skeleton v-for="index in 8" :key="index" height="2.75rem" />
    </section>
    <div class="flex flex-col gap-3.5 lg:hidden">
      <Skeleton v-for="index in 3" :key="index" height="8rem" border-radius="16px" />
    </div>
  </div>
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
      <Button
        :label="t('transactions.actions.addFirst')"
        class="hidden! lg:inline-flex!"
        @click="dialog.openCreate()"
      />
      <NuxtLinkLocale
        to="/transactions/new"
        class="inline-flex min-h-11 items-center rounded-(--radius-control) bg-accent px-4 text-sm font-semibold text-on-accent no-underline lg:hidden"
      >
        {{ t('transactions.actions.addFirst') }}
      </NuxtLinkLocale>
    </template>
  </EmptyState>
  <template v-else>
    <TransactionTable v-model:sort="sort" class="hidden lg:block" :rows="rows" @open="dialog.openEdit" />
    <TransactionDayList
      v-if="currency"
      class="lg:hidden"
      :rows="rows"
      :currency="currency"
      :sort="sort"
      @open="dialog.openEdit"
    />
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
  <Drawer
    v-model:visible="filtersOpen"
    position="bottom"
    block-scroll
    :header="t('transactions.filters.label')"
    :aria-label="t('transactions.filters.label')"
    class="h-auto! rounded-t-(--radius-panel)"
  >
    <div class="flex flex-col gap-4">
      <TransactionFilterFields
        v-model:category-id="filters.categoryId"
        v-model:account-id="filters.accountId"
        v-model:tags="filters.tags"
        v-model:period="filters.period"
        id-prefix="transactions-drawer"
        :categories="screen.categories.value"
        :accounts="screen.accounts.value"
      />
      <div class="flex gap-2">
        <Button
          :label="t('transactions.actions.resetFilters')"
          severity="secondary"
          outlined
          class="min-h-11 flex-1"
          @click="screen.resetFilters"
        />
        <Button :label="t('transactions.actions.apply')" class="min-h-11 flex-1" @click="filtersOpen = false" />
      </div>
    </div>
  </Drawer>
</template>
