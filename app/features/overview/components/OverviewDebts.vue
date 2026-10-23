<script setup lang="ts">
import type { OverviewDto } from '~/shared/api/contract'
import { hasOpenDebts } from '../utils/overviewView'

defineProps<{ overview?: OverviewDto; failed?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
const { included, setIncluded } = useBalanceWithDebts()
const headingId = useId()
const switchId = useId()
</script>

<template>
  <section
    :aria-labelledby="headingId"
    :aria-busy="!overview && !failed"
    class="flex flex-col gap-4.5 rounded-(--radius-card) bg-surface p-4 lg:p-5.5"
  >
    <div class="flex items-baseline justify-between gap-2">
      <h2 :id="headingId" class="m-0 text-base font-semibold">{{ t('overview.debts.title') }}</h2>
      <NuxtLinkLocale
        to="/tools/debts"
        class="inline-flex min-h-11 items-center text-[13px] font-medium text-accent no-underline"
      >
        {{ t('overview.debts.all') }}
      </NuxtLinkLocale>
    </div>
    <ErrorState v-if="failed" compact @retry="emit('retry')" />
    <div v-else-if="!overview" class="flex flex-col gap-4" aria-hidden="true">
      <Skeleton v-for="index in 3" :key="index" height="2rem" />
    </div>
    <div v-else-if="!hasOpenDebts(overview.debts)" class="flex flex-col items-start gap-1">
      <p class="m-0 text-sm text-muted">{{ t('overview.debts.empty') }}</p>
      <NuxtLinkLocale
        to="/tools/debts"
        class="inline-flex min-h-11 items-center text-sm font-semibold text-accent no-underline"
      >
        {{ t('overview.debts.add') }}
      </NuxtLinkLocale>
    </div>
    <template v-else>
      <dl class="m-0 flex flex-col gap-3 text-sm">
        <div class="flex items-baseline justify-between gap-3">
          <dt class="text-muted">{{ t('overview.debts.owedToMe') }}</dt>
          <dd class="m-0">
            <MoneyText
              data-testid="overview-owed-to-me"
              :amount="overview.debts.owedToMe"
              :currency="overview.currency"
            />
          </dd>
        </div>
        <div class="flex items-baseline justify-between gap-3">
          <dt class="text-muted">{{ t('overview.debts.owedByMe') }}</dt>
          <dd class="m-0">
            <MoneyText
              data-testid="overview-owed-by-me"
              :amount="overview.debts.owedByMe"
              :currency="overview.currency"
            />
          </dd>
        </div>
      </dl>
      <p v-if="overview.debts.overdue > 0" class="m-0 text-sm font-medium text-accent">
        {{ t('overview.debts.overdue', { count: overview.debts.overdue }, overview.debts.overdue) }}
      </p>
      <div class="border-t border-bg pt-3">
        <div class="relative flex min-h-11 items-center justify-between gap-3">
          <label :for="switchId" class="cursor-pointer text-sm font-medium after:absolute after:inset-0">
            {{ t('overview.debts.include') }}
          </label>
          <ToggleSwitch
            :input-id="switchId"
            :model-value="included"
            class="relative z-1 shrink-0"
            @update:model-value="(value: boolean) => setIncluded(value)"
          />
        </div>
      </div>
    </template>
  </section>
</template>
