<script setup lang="ts">
import { canExport, reportStateOf } from '~/features/reports/utils/reportsView'
import { capitalizeFirst } from '~/shared/utils/text'

const { t, locale } = useI18n()
const range = useReportRange()
const { report, isError, isPlaceholderData, refetch } = useReport(range)
const rangeLabel = useReportRangeLabel()

const failed = computed(() => isError.value && !report.value)
const state = computed(() => (report.value ? reportStateOf(report.value) : undefined))
const covered = computed(() => (report.value ? rangeLabel(report.value.periods) : ''))
const exportable = computed(() => canExport(report.value, isPlaceholderData.value))

const exportPdf = () => window.print()

useHead({ title: () => t('navigation.reports') })
</script>

<template>
  <PageHeader class="hidden! lg:flex! print:flex!" :eyebrow="t('reports.eyebrow')" :title="t('navigation.reports')">
    <template #actions>
      <ReportRangeSwitch v-model="range" class="print:hidden!" />
      <Button severity="secondary" outlined class="min-h-11 print:hidden!" :disabled="!exportable" @click="exportPdf">
        <AppIcon name="download" :size="16" />
        {{ t('reports.export') }}
      </Button>
    </template>
  </PageHeader>
  <PageHeader
    class="lg:hidden! print:hidden!"
    :eyebrow="covered ? capitalizeFirst(covered, locale) : t('reports.eyebrow')"
    :title="t('navigation.reports')"
  >
    <template #actions>
      <button
        type="button"
        class="flex size-11 items-center justify-center rounded-(--radius-control) border border-border bg-surface text-ink disabled:opacity-50"
        :aria-label="t('reports.export')"
        :disabled="!exportable"
        @click="exportPdf"
      >
        <AppIcon name="download" :size="20" />
      </button>
    </template>
  </PageHeader>
  <ReportRangeSwitch v-model="range" class="self-start lg:hidden! print:hidden!" />
  <p v-if="covered" class="m-0 hidden text-sm text-muted print:block">
    {{ t('reports.printRange', { range: covered }) }}
  </p>
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
  <template v-else>
    <div class="hidden flex-col gap-6 lg:flex print:flex!">
      <ReportStats variant="full" :report="report" />
      <ReportTrendCard :report="report" :range-label="covered" />
      <ReportStructure :report="report" />
    </div>
    <div class="flex flex-col gap-4 lg:hidden print:hidden!">
      <ReportStats variant="compact" :report="report" />
      <ReportTrendCard compact :report="report" :range-label="covered" />
      <ReportStructure compact :report="report" />
    </div>
  </template>
</template>
