<script setup lang="ts">
import type { ChartData, Chart as ChartJs, ChartOptions, TooltipItem } from 'chart.js'
import type { ReportPeriodDto } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'
import { monthKeyDate } from '~/shared/period/period'
import { capitalizeFirst } from '~/shared/utils/text'
import { axisLabels } from '../utils/reportsView'

type Palette = { income: string; expense: string; grid: string; tick: string }
type BarChart = ChartJs<'bar', number[], string[]>
type ChartHandle = { getChart(): BarChart | undefined }

const props = defineProps<{
  periods: ReportPeriodDto[]
  currency: Currency
  description: string
  compact?: boolean
}>()
const { t, d, locale } = useI18n()
const { format } = useMoney()
const monthLabel = useMonthLabel()
const chart = useTemplateRef<ChartHandle>('chart')

const reducedMotion = ref(false)
const palette = ref<Palette>()
let observer: MutationObserver | undefined

function readPalette(prefix: '' | 'light-'): Palette {
  const style = getComputedStyle(document.documentElement)
  const token = (name: string) => style.getPropertyValue(`--mita-${prefix}${name}`).trim()
  return { income: token('chart-income'), expense: token('chart-expense'), grid: token('border'), tick: token('muted') }
}

const shortMonth = (key: string) =>
  capitalizeFirst(d(monthKeyDate(key), { month: 'short', timeZone: 'UTC' }), locale.value)
function barStyle() {
  const narrow = props.compact && props.periods.length > 6
  const gap = narrow ? 2 : 4
  const width = narrow ? 8 : props.compact ? 16 : 22
  const radius = props.compact ? 4 : 6
  // A fixed thickness keeps each income/expense pair side by side; the transparent side borders draw the gap between them.
  return {
    barThickness: width + gap,
    borderWidth: { left: gap / 2, right: gap / 2, top: 0, bottom: 0 },
    borderColor: 'transparent',
    borderRadius: { topLeft: radius, topRight: radius, bottomLeft: 0, bottomRight: 0 },
  }
}

function dataFor(colors: Palette): ChartData<'bar', number[], string[]> {
  const bar = barStyle()
  return {
    labels: axisLabels(
      props.periods.map((row) => row.period),
      shortMonth,
    ),
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
          title: (items: TooltipItem<'bar'>[]) => {
            const period = props.periods[items[0]?.dataIndex ?? -1]?.period
            return period ? monthLabel(period, { withYear: true, capitalize: true }) : ''
          },
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
      y: { beginAtZero: true, display: false },
    },
  }
}

const data = computed(() => (palette.value ? dataFor(palette.value) : undefined))
const options = computed(() => (palette.value ? optionsFor(palette.value) : undefined))

const PRINT_SIZE = { width: 640, height: 220 } as const

function repaint(colors: Palette, size?: { width: number; height: number }) {
  const instance = chart.value?.getChart()
  if (!instance) return
  instance.stop()
  instance.data = dataFor(colors)
  instance.options = optionsFor(colors)
  if (size) instance.resize(size.width, size.height)
  else instance.resize()
  instance.update('none')
}

const beforePrint = () => repaint(readPalette('light-'), PRINT_SIZE)
const afterPrint = () => {
  if (palette.value) repaint(palette.value)
}

onMounted(() => {
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  palette.value = readPalette('')
  observer = new MutationObserver(() => {
    palette.value = readPalette('')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  if (props.compact) return
  window.addEventListener('beforeprint', beforePrint)
  window.addEventListener('afterprint', afterPrint)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('beforeprint', beforePrint)
  window.removeEventListener('afterprint', afterPrint)
})
</script>

<template>
  <div class="flex flex-col">
    <div class="relative w-full" :class="compact ? 'h-37.5' : 'h-60 print:w-160'">
      <ClientOnly>
        <Chart
          v-if="data && options"
          ref="chart"
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
          <th scope="row">{{ monthLabel(row.period, { withYear: true, capitalize: true }) }}</th>
          <td>{{ format(row.income, currency) }}</td>
          <td>{{ format(row.expense, currency) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
