<script setup lang="ts">
import { reportStateOf } from '~/features/reports/utils/reportsView'

const { t } = useI18n()
const range = useReportRange()
const { report, isError, refetch } = useReport(range)
const rangeLabel = useReportRangeLabel()

const failed = computed(() => isError.value && !report.value)
const state = computed(() => (report.value ? reportStateOf(report.value) : undefined))
const covered = computed(() => (report.value ? rangeLabel(report.value.periods) : ''))

useHead({ title: () => t('navigation.reports') })
</script>

<template>
  <PageHeader class="hidden! lg:flex!" :eyebrow="t('reports.eyebrow')" :title="t('navigation.reports')">
    <template #actions>
      <ReportRangeSwitch v-model="range" />
    </template>
  </PageHeader>
  <PageHeader class="lg:hidden!" :eyebrow="covered || t('reports.eyebrow')" :title="t('navigation.reports')" />
  <ErrorState v-if="failed" @retry="refetch()" />
  <EmptyState
    v-else-if="state === 'noTransactions'"
    :title="t('reports.empty.title')"
    :description="t('reports.empty.description')"
  >
    <template #action>
      <NuxtLinkLocale
        to="/transactions"
        class="inline-flex min-h-11 items-center rounded-(--radius-control) bg-accent px-4 text-sm font-semibold text-on-accent no-underline"
      >
        {{ t('reports.empty.action') }}
      </NuxtLinkLocale>
    </template>
  </EmptyState>
  <EmptyState
    v-else-if="state === 'noData'"
    :title="t('reports.noData.title')"
    :description="t('reports.noData.description', { range: covered })"
  >
    <template v-if="range !== '12m'" #action>
      <Button :label="t('reports.noData.showYear')" class="min-h-11" @click="range = '12m'" />
    </template>
  </EmptyState>
  <div v-else class="hidden flex-col gap-6 lg:flex">
    <ReportStats variant="full" :report="report" />
    <ReportStructure :report="report" />
  </div>
</template>
