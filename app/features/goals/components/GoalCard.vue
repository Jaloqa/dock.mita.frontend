<script setup lang="ts">
import type { GoalDto } from '~/shared/api/contract'
import { currencyDigits } from '~/shared/money/currencies'
import { type Currency, fromMinor } from '~/shared/money/money'
import { goalHint, savedShare } from '../utils/goalView'

const props = defineProps<{ goal: GoalDto; currency: Currency }>()
const emit = defineEmits<{ contribute: []; edit: [] }>()
const { t, n } = useI18n()
const { format } = useMoney()
const monthLabel = useMonthLabel()

const headingId = computed(() => `goal-${props.goal.id}`)
const percent = computed(() => n(props.goal.percent / 100, 'percent'))
const deadline = computed(() =>
  props.goal.deadline
    ? t('goals.card.deadline', { month: monthLabel(props.goal.deadline, { withYear: true }) })
    : t('goals.card.noDeadline'),
)
const saved = computed(() => format(props.goal.saved, props.currency))
const target = computed(() => format(props.goal.target, props.currency))
const wholeDigits = (minor: number) => {
  const fraction = currencyDigits(props.currency)
  const digits = minor % 10 ** fraction === 0 ? 0 : fraction
  return { minimumFractionDigits: digits, maximumFractionDigits: digits }
}
const compactAmounts = computed(() =>
  t('goals.card.amounts', {
    saved: n(fromMinor(props.goal.saved, props.currency), wholeDigits(props.goal.saved)),
    target: n(fromMinor(props.goal.target, props.currency), {
      key: 'currency',
      currency: props.currency,
      ...wholeDigits(props.goal.target),
    }),
  }),
)
const hint = computed(() => {
  const { key, amount } = goalHint(props.goal)
  return amount === null ? t(key) : t(key, { amount: format(amount, props.currency) })
})
const editLabel = computed(() => t('goals.actions.editNamed', { name: props.goal.name }))
const contributeLabel = computed(() => t('goals.actions.contributeNamed', { name: props.goal.name }))
</script>

<template>
  <article
    :aria-labelledby="headingId"
    class="flex min-w-0 flex-col gap-3 rounded-(--radius-card) bg-surface p-4 lg:gap-4.5 lg:p-5.5"
  >
    <div class="flex items-start justify-between gap-2 lg:gap-3">
      <div class="flex min-w-0 flex-col gap-0.5 lg:gap-1">
        <div class="flex flex-wrap items-center gap-2">
          <h2 :id="headingId" class="m-0 text-base font-semibold break-words lg:text-lg">{{ goal.name }}</h2>
          <span
            v-if="goal.status === 'reached'"
            class="rounded-full bg-deep-muted px-2.5 py-0.5 text-xs font-semibold text-deep"
          >
            {{ t('goals.card.reached') }}
          </span>
          <span
            v-else-if="goal.status === 'overdue'"
            class="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-on-accent"
          >
            {{ t('goals.card.overdue') }}
          </span>
        </div>
        <span class="text-xs text-muted lg:text-[13px]">{{ deadline }}</span>
      </div>
      <span class="font-mono text-lg font-medium whitespace-nowrap text-accent lg:text-[22px]">{{ percent }}</span>
    </div>
    <ProgressBar
      :value="savedShare(goal.saved, goal.target)"
      :label="t('goals.card.progress', { name: goal.name })"
      class="lg:h-2.5"
    />
    <dl class="m-0 hidden grid-cols-2 gap-3 lg:grid">
      <div class="flex min-w-0 flex-col gap-0.5">
        <dt class="text-xs text-muted">{{ t('goals.card.saved') }}</dt>
        <dd class="m-0 font-mono text-[15px] whitespace-nowrap">{{ saved }}</dd>
      </div>
      <div class="flex min-w-0 flex-col gap-0.5">
        <dt class="text-xs text-muted">{{ t('goals.card.target') }}</dt>
        <dd class="m-0 font-mono text-[15px] whitespace-nowrap">{{ target }}</dd>
      </div>
    </dl>
    <p class="m-0 hidden rounded-(--radius-control) bg-bg px-3.5 py-3 text-[13px] text-muted lg:block">{{ hint }}</p>
    <div class="hidden gap-2.5 lg:flex">
      <Button
        :label="t('goals.actions.contribute')"
        :aria-label="contributeLabel"
        class="min-h-11 flex-auto"
        @click="emit('contribute')"
      />
      <Button
        :label="t('goals.actions.edit')"
        :aria-label="editLabel"
        severity="secondary"
        outlined
        class="min-h-11"
        @click="emit('edit')"
      />
    </div>
    <div class="flex items-center justify-between gap-2 lg:hidden">
      <span class="min-w-0 font-mono text-[13px] whitespace-nowrap text-muted">{{ compactAmounts }}</span>
      <div class="flex shrink-0 items-center gap-1">
        <Button text rounded severity="secondary" class="size-11" :aria-label="editLabel" @click="emit('edit')">
          <AppIcon name="edit" :size="18" />
        </Button>
        <Button
          :label="t('goals.actions.contribute')"
          :aria-label="contributeLabel"
          severity="secondary"
          class="min-h-11"
          @click="emit('contribute')"
        />
      </div>
    </div>
  </article>
</template>
