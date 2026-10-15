<script setup lang="ts">
import type { AccountShare } from '../utils/summary'

const props = defineProps<{ shares: AccountShare[]; isPending: boolean; isError: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t, n } = useI18n()

const swatches = ['bg-chart-2', 'bg-chart-5', 'bg-chart-3', 'bg-chart-4', 'bg-chart-1', 'bg-chart-6']
const swatch = (index: number) => swatches[index % swatches.length]
const percent = (value: number) => n(value / 100, 'percent')
const summary = computed(() =>
  props.shares
    .map((share) => t('accounts.distribution.item', { name: share.name, percent: percent(share.percent) }))
    .join(', '),
)
</script>

<template>
  <section
    aria-labelledby="accounts-distribution"
    class="flex min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-(--radius-card) bg-surface p-5.5"
  >
    <h2 id="accounts-distribution" class="m-0 text-base font-semibold">{{ t('accounts.distribution.title') }}</h2>
    <div v-if="isPending" class="flex flex-col gap-2.5" aria-hidden="true">
      <Skeleton height="14px" border-radius="7px" />
      <Skeleton v-for="index in 3" :key="index" height="1.25rem" />
    </div>
    <div v-else-if="isError" class="flex flex-col items-start gap-2">
      <p class="m-0 text-sm text-muted">{{ t('accounts.distribution.unavailable') }}</p>
      <Button :label="t('shared.actions.retry')" severity="secondary" outlined @click="emit('retry')" />
    </div>
    <p v-else-if="shares.length === 0" class="m-0 text-sm text-muted">{{ t('accounts.distribution.empty') }}</p>
    <template v-else>
      <div role="img" :aria-label="summary" class="flex h-3.5 gap-0.75 overflow-hidden rounded-[7px]">
        <template v-for="(share, index) in shares" :key="share.id">
          <div v-if="share.percent > 0" :class="swatch(index)" :style="{ flex: `${share.percent} 1 0` }" />
        </template>
      </div>
      <ul class="m-0 flex list-none flex-col gap-2.5 p-0 text-sm">
        <li v-for="(share, index) in shares" :key="share.id" class="flex justify-between gap-3">
          <span class="flex min-w-0 items-center gap-2">
            <span class="size-2.5 shrink-0 rounded-[3px]" :class="swatch(index)" aria-hidden="true" />
            <span class="truncate">{{ share.name }}</span>
          </span>
          <span class="font-mono text-muted">{{ percent(share.percent) }}</span>
        </li>
      </ul>
    </template>
  </section>
</template>
