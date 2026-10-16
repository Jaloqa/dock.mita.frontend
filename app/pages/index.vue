<script setup lang="ts">
const { t } = useI18n()
const monthLabel = useMonthLabel()
const rangeLabel = useOverviewRangeLabel()
const range = useOverviewRange()
const { overview, isError, refetch } = useOverview(range)
const dialog = useTransactionDialog()

const failed = computed(() => isError.value && !overview.value)
const title = computed(() =>
  overview.value ? rangeLabel(overview.value.from, overview.value.to) : t('navigation.overview'),
)
const mobileTitle = computed(() =>
  overview.value ? monthLabel(overview.value.month.period) : t('navigation.overview'),
)

useHead({ title: () => t('navigation.overview') })
</script>

<template>
  <PageHeader class="hidden! lg:flex!" :eyebrow="t('overview.eyebrow')" :title="title">
    <template #actions>
      <OverviewRangeSwitch v-model="range" />
      <Button class="min-h-11" @click="dialog.openCreate()">
        <AppIcon name="plus" :size="16" :stroke-width="2.2" />
        {{ t('transactions.actions.add') }}
      </Button>
    </template>
  </PageHeader>
  <PageHeader class="lg:hidden!" :eyebrow="t('overview.mobile.eyebrow')" :title="mobileTitle">
    <template #actions>
      <NuxtLinkLocale
        to="/budgets"
        :aria-label="t('overview.mobile.periodLink')"
        class="flex size-11 items-center justify-center rounded-xl border border-border bg-surface text-ink"
      >
        <AppIcon name="calendar" :size="20" />
      </NuxtLinkLocale>
    </template>
  </PageHeader>
  <EmptyState
    v-if="overview && overview.balance.accounts === 0"
    :title="t('overview.noAccounts.title')"
    :description="t('overview.noAccounts.description')"
  >
    <template #action>
      <NuxtLinkLocale
        to="/accounts"
        class="inline-flex min-h-11 items-center rounded-(--radius-control) bg-accent px-4 text-sm font-semibold text-on-accent no-underline"
      >
        {{ t('overview.noAccounts.action') }}
      </NuxtLinkLocale>
    </template>
  </EmptyState>
  <div class="hidden flex-col gap-6 lg:flex">
    <OverviewStats :overview="overview" :failed="failed" @retry="refetch()" />
    <div class="flex flex-wrap items-stretch gap-4">
      <SpendingCard
        class="flex-[2_1_520px]"
        :overview="overview"
        :failed="failed"
        @retry="refetch()"
        @add="dialog.openCreate()"
      />
    </div>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-stretch gap-4">
      <OverviewBudgets variant="full" :overview="overview" :failed="failed" @retry="refetch()" />
      <RecentTransactions :overview="overview" :failed="failed" @retry="refetch()" />
      <OverviewGoals :overview="overview" :failed="failed" @retry="refetch()" />
    </div>
  </div>
</template>
