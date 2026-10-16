<script setup lang="ts">
import type { TooltipItem } from 'chart.js'
import type { CategoryColor } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'

type Slice = { name: string; amount: number; percent: number; color: CategoryColor }

const props = defineProps<{ slices: Slice[]; total: number; currency: Currency }>()
const { t } = useI18n()
const { format } = useMoney()
const percent = useOverviewPercent()

const TOKENS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6', 'surface'] as const
const reducedMotion = ref(false)
const palette = ref<Record<string, string>>({})
let observer: MutationObserver | undefined

function readPalette() {
  const style = getComputedStyle(document.documentElement)
  palette.value = Object.fromEntries(TOKENS.map((token) => [token, style.getPropertyValue(`--mita-${token}`).trim()]))
}

onMounted(() => {
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  readPalette()
  observer = new MutationObserver(readPalette)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => observer?.disconnect())

const data = computed(() => ({
  labels: props.slices.map((slice) => slice.name),
  datasets: [
    {
      data: props.slices.map((slice) => slice.amount),
      backgroundColor: props.slices.map((slice) => palette.value[slice.color] ?? ''),
      borderColor: palette.value.surface ?? '',
      borderWidth: 2,
      hoverOffset: 4,
    },
  ],
}))

const options = computed(() => ({
  cutout: '70%',
  responsive: true,
  maintainAspectRatio: false,
  animation: reducedMotion.value ? false : undefined,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (item: TooltipItem<'doughnut'>) =>
          `${item.label}: ${format(props.slices[item.dataIndex]?.amount ?? 0, props.currency)}`,
      },
    },
  },
}))

const description = computed(() =>
  t('overview.spending.chartLabel', {
    items: props.slices.map((slice) => `${slice.name} ${percent.share(slice.percent)}`).join(', '),
  }),
)
</script>

<template>
  <div class="relative size-55 shrink-0">
    <ClientOnly>
      <Chart
        v-if="palette.surface"
        type="doughnut"
        class="size-full"
        :data="data"
        :options="options"
        :canvas-props="{ role: 'img', 'aria-label': description }"
      />
    </ClientOnly>
    <div
      class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5"
      aria-hidden="true"
    >
      <span class="text-xs text-muted">{{ t('overview.spending.center') }}</span>
      <MoneyText class="text-lg" :amount="total" :currency="currency" />
    </div>
  </div>
</template>
