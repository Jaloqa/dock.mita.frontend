<script setup lang="ts">
import type { OverviewDto } from '~/shared/api/contract'
import { todayIso } from '~/shared/period/period'

defineProps<{ overview?: OverviewDto; failed?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
const today = todayIso()
</script>

<template>
  <section
    aria-labelledby="overview-today"
    :aria-busy="!overview && !failed"
    class="flex flex-col rounded-(--radius-card) bg-surface px-4 pt-4 pb-1"
  >
    <h2 id="overview-today" class="m-0 mb-1.5 text-[15px] font-semibold">{{ t('overview.mobile.today') }}</h2>
    <ErrorState v-if="failed" compact @retry="emit('retry')" />
    <div v-else-if="!overview" class="flex flex-col gap-3 pb-3" aria-hidden="true">
      <Skeleton v-for="index in 2" :key="index" height="2.75rem" />
    </div>
    <div v-else-if="overview.today.length === 0" class="flex flex-col items-start gap-1 pb-3">
      <p class="m-0 text-sm text-muted">{{ t('overview.mobile.todayEmpty') }}</p>
      <NuxtLinkLocale
        to="/transactions/new"
        class="inline-flex min-h-11 items-center text-sm font-semibold text-accent no-underline"
      >
        {{ t('overview.mobile.add') }}
      </NuxtLinkLocale>
    </div>
    <OverviewTransactionList
      v-else
      :items="overview.today"
      :currency="overview.currency"
      meta="account"
      :today="today"
    />
  </section>
</template>
