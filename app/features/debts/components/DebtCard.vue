<script setup lang="ts">
import type { DebtDto } from '~/shared/api/contract'
import { repaidShare } from '../utils/debtView'

const props = defineProps<{ debt: DebtDto; accountName?: string }>()
const emit = defineEmits<{ edit: []; repay: [] }>()
const { t, d } = useI18n()
const { format } = useMoney()

const day = (iso: string) =>
  d(new Date(`${iso}T00:00:00Z`), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const headingId = computed(() => `debt-${props.debt.id}`)
const name = computed(() => props.debt.counterparty)
const directionLabel = computed(() => t(`debts.card.${props.debt.direction}`))
const total = computed(() => t('debts.card.of', { amount: format(props.debt.amount, props.debt.currency) }))
const since = computed(() => t('debts.card.since', { date: day(props.debt.date) }))
const due = computed(() => (props.debt.dueDate ? day(props.debt.dueDate) : undefined))
const editLabel = computed(() => t('debts.actions.editNamed', { name: name.value }))
const repayLabel = computed(() => t('debts.actions.repayNamed', { name: name.value }))
const historyLabel = computed(() => t('debts.actions.historyNamed', { name: name.value }))
const historyId = computed(() => `debt-history-${props.debt.id}`)
const hasHistory = computed(() => props.debt.repayments > 0)
const showHistory = ref(false)
const historyShown = computed(() => showHistory.value && hasHistory.value)
const actions = ref<HTMLElement | null>(null)

watch(hasHistory, async (has) => {
  if (has || !showHistory.value) return
  showHistory.value = false
  await nextTick()
  if (!document.activeElement || document.activeElement === document.body) {
    actions.value?.querySelector<HTMLElement>('button')?.focus()
  }
})
</script>

<template>
  <article
    :aria-labelledby="headingId"
    class="flex min-w-0 flex-col gap-3 rounded-(--radius-card) bg-surface p-4 lg:gap-4 lg:p-5.5"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 flex-col gap-0.5">
        <span class="text-xs font-medium text-muted lg:text-[13px]">{{ directionLabel }}</span>
        <h3 :id="headingId" class="m-0 text-base font-semibold break-words lg:text-lg">{{ name }}</h3>
      </div>
      <div class="flex shrink-0 flex-col items-end gap-0.5">
        <MoneyText :amount="debt.remaining" :currency="debt.currency" class="text-lg lg:text-[22px]" />
        <span v-if="debt.repaid > 0" class="font-mono text-xs whitespace-nowrap text-muted">{{ total }}</span>
      </div>
    </div>
    <ProgressBar :value="repaidShare(debt)" :label="t('debts.card.progress', { name })" />
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted lg:text-[13px]">
      <span>{{ since }}</span>
      <span
        v-if="debt.overdue && due"
        data-overdue
        class="rounded-full bg-accent/10 px-2.5 py-0.5 font-semibold text-accent"
      >
        {{ t('debts.card.overdue', { date: due }) }}
      </span>
      <span v-else-if="due">{{ t('debts.card.due', { date: due }) }}</span>
      <span v-if="accountName" class="flex min-w-0 items-center gap-1">
        <AppIcon name="accounts" :size="14" />
        <span class="truncate">{{ accountName }}</span>
      </span>
    </div>
    <p v-if="debt.note" class="m-0 text-[13px] break-words text-muted">{{ debt.note }}</p>
    <div v-if="hasHistory" class="flex flex-col">
      <Button
        :label="t('debts.actions.history')"
        :aria-label="historyLabel"
        :aria-expanded="historyShown"
        :aria-controls="historyId"
        text
        class="-ml-3 min-h-11 self-start"
        @click="showHistory = !showHistory"
      />
      <RepaymentList v-if="historyShown" :id="historyId" :debt="debt" />
    </div>
    <div ref="actions" class="mt-auto flex gap-2.5">
      <Button
        v-if="debt.status === 'open'"
        :label="t('debts.actions.repay')"
        :aria-label="repayLabel"
        class="min-h-11 flex-auto"
        @click="emit('repay')"
      />
      <Button
        :label="t('debts.actions.edit')"
        :aria-label="editLabel"
        severity="secondary"
        outlined
        class="min-h-11"
        :class="{ 'flex-auto': debt.status !== 'open' }"
        @click="emit('edit')"
      />
    </div>
  </article>
</template>
