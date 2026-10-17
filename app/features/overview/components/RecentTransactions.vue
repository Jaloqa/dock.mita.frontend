<script setup lang="ts">
import type { OverviewDto } from '~/shared/api/contract'

defineProps<{ overview?: OverviewDto; failed?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
const today = useToday()
const headingId = useId()
</script>

<template>
  <section
    :aria-labelledby="headingId"
    :aria-busy="!overview && !failed"
    class="flex flex-col gap-1.5 rounded-(--radius-card) bg-surface p-4 lg:p-5.5"
  >
    <div class="flex items-baseline justify-between gap-2">
      <h2 :id="headingId" class="m-0 text-base font-semibold">{{ t('overview.recent.title') }}</h2>
      <NuxtLinkLocale
        to="/transactions"
        class="inline-flex min-h-11 items-center text-[13px] font-medium text-accent no-underline"
      >
        {{ t('overview.recent.all') }}
      </NuxtLinkLocale>
    </div>
    <ErrorState v-if="failed" compact @retry="emit('retry')" />
    <div v-else-if="!overview" class="flex flex-col gap-3" aria-hidden="true">
      <Skeleton v-for="index in 6" :key="index" height="2.75rem" />
    </div>
    <p v-else-if="overview.recent.length === 0" class="m-0 text-sm text-muted">
      {{ overview.hasTransactions ? t('overview.recent.empty') : t('overview.recent.none') }}
    </p>
    <OverviewTransactionList v-else :items="overview.recent" :currency="overview.currency" meta="date" :today="today" />
  </section>
</template>
