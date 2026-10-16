<script setup lang="ts">
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import type { ReportPeriodDto } from '~/shared/api/contract'
import { type Currency, fromMinor } from '~/shared/money/money'
import { monthKeyDate } from '~/shared/period/period'

type Palette = { income: string; expense: string; grid: string; tick: string }

const props = defineProps<{
  periods: ReportPeriodDto[]
  currency: Currency
  description: string
  compact?: boolean
}>()
const { t, d, n } = useI18n()
const { format } = useMoney()
const monthLabel = useMonthLabel()

const reducedMotion = ref(false)
const palette = ref<Palette>()
let observer: MutationObserver | undefined

function readPalette(prefix: '' | 'light-'): Palette {
  const style = getComputedStyle(document.documentElement)
  const token = (name: string) => style.getPropertyValue(`--mita-${prefix}${name}`).trim()
  return { income: token('chart-income'), expense: token('chart-expense'), grid: token('border'), tick: token('muted') }
}

const shortMonth = (key: string) => d(monthKeyDate(key), { month: 'short', timeZone: 'UTC' })
const compactMoney = (minor: number) =>
  n(fromMinor(minor), { key: 'currency', currency: props.currency, notation: 'compact', maximumFractionDigits: 1 })

function dataFor(colors: Palette): ChartData<'bar', number[], string> {
  const bar = { borderRadius: props.compact ? 4 : 5, maxBarThickness: props.compact ? 14 : 22 }
  return {
    labels: props.periods.map((row) => shortMonth(row.period)),
    datasets: [
      {
        label: t('reports.chart.income'),
        data: props.periods.map((row) => row.income),
        backgroundColor: colors.income,
        ...bar,
      },
      {
        label: t('reports.chart.expense'),
        data: props.periods.map((row) => row.expense),
        backgroundColor: colors.expense,
        ...bar,
      },
    ],
  }
}

function optionsFor(colors: Palette): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: reducedMotion.value ? false : undefined,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<'bar'>) =>
            `${item.dataset.label ?? ''}: ${format(item.parsed.y ?? 0, props.currency)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: colors.grid },
        ticks: { color: colors.tick, font: { size: props.compact ? 11 : 12 } },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: colors.grid },
        ticks: {
          color: colors.tick,
          maxTicksLimit: props.compact ? 4 : 5,
          callback: (value) => compactMoney(Number(value)),
        },
      },
    },
  }
}

const data = computed(() => (palette.value ? dataFor(palette.value) : undefined))
const options = computed(() => (palette.value ? optionsFor(palette.value) : undefined))

onMounted(() => {
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  palette.value = readPalette('')
  observer = new MutationObserver(() => {
    palette.value = readPalette('')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="flex flex-col">
    <div class="relative w-full" :class="compact ? 'h-32.5' : 'h-55'">
      <ClientOnly>
        <Chart
          v-if="data && options"
          type="bar"
          class="size-full"
          :data="data"
          :options="options"
          :canvas-props="{ role: 'img', 'aria-label': description }"
        />
      </ClientOnly>
    </div>
    <table class="sr-only">
      <caption>
        {{ t('reports.chart.title') }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ t('reports.chart.month') }}</th>
          <th scope="col">{{ t('reports.chart.income') }}</th>
          <th scope="col">{{ t('reports.chart.expense') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in periods" :key="row.period">
          <th scope="row">{{ monthLabel(row.period, { withYear: true }) }}</th>
          <td>{{ format(row.income, currency) }}</td>
          <td>{{ format(row.expense, currency) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
