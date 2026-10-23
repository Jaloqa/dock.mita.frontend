<script setup lang="ts">
import { useAccounts } from '~/shared/accounts/useAccounts'
import type { DebtDto, DebtRepaymentDto } from '~/shared/api/contract'

const props = defineProps<{ debt: DebtDto }>()
const { t, d } = useI18n()
const { format } = useMoney()
const notify = useNotify()
const confirm = useConfirm()
const { accounts } = useAccounts()
const { items, isPending, isError, refetch } = useRepayments(
  () => props.debt.id,
  () => props.debt.repayments > 0,
)
const { removeRepayment } = useDebtMutations()
const focusNewDebt = useNewDebtFocus()

const listEl = ref<HTMLElement | null>(null)
const iconButton =
  '-mr-2 flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) text-muted transition-colors hover:text-ink focus-visible:text-ink'

const day = (iso: string) =>
  d(new Date(`${iso}T00:00:00Z`), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const rows = computed(() =>
  items.value.map((repayment) => ({
    repayment,
    date: day(repayment.date),
    account: repayment.accountId ? accounts.value.find((row) => row.id === repayment.accountId)?.name : undefined,
    converted:
      repayment.currency === props.debt.currency
        ? undefined
        : t('debts.history.converted', { amount: format(repayment.debtAmount, props.debt.currency) }),
  })),
)

async function remove(repayment: DebtRepaymentDto, neighbour: DebtRepaymentDto | undefined, card: HTMLElement | null) {
  try {
    await removeRepayment.mutateAsync({ id: props.debt.id, repaymentId: repayment.id })
  } catch (error) {
    notify.error(error)
    return
  }
  notify.success(t('debts.toast.repaymentDeleted'))
  await nextTick()
  if (card && !card.isConnected) focusNewDebt()
  else if (neighbour) listEl.value?.querySelector<HTMLElement>(`[data-repayment-delete="${neighbour.id}"]`)?.focus()
}

function confirmDelete(repayment: DebtRepaymentDto, index: number) {
  const neighbour = items.value[index + 1] ?? items.value[index - 1]
  const card = listEl.value?.closest('article') ?? null
  confirm.require({
    header: t('debts.confirm.deleteRepaymentTitle'),
    message: t('debts.confirm.deleteRepaymentMessage'),
    acceptLabel: t('debts.actions.delete'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () => remove(repayment, neighbour, card),
  })
}
</script>

<template>
  <div>
    <div v-if="isPending" class="flex flex-col gap-2" aria-hidden="true">
      <Skeleton v-for="index in Math.min(debt.repayments, 3)" :key="index" height="2.75rem" />
    </div>
    <ErrorState v-else-if="isError" compact @retry="refetch()" />
    <ul v-else ref="listEl" :aria-label="t('debts.history.label')" class="m-0 list-none p-0">
      <li
        v-for="(row, index) in rows"
        :key="row.repayment.id"
        class="flex items-center gap-3 border-t border-border py-1.5"
      >
        <div class="flex min-w-0 flex-auto flex-col gap-0.5">
          <span class="text-sm font-medium">{{ row.date }}</span>
          <span v-if="row.account" class="flex min-w-0 items-center gap-1 text-xs text-muted">
            <AppIcon name="accounts" :size="14" />
            <span class="truncate">{{ row.account }}</span>
          </span>
          <span v-if="row.repayment.note" class="text-xs break-words text-muted">{{ row.repayment.note }}</span>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-0.5">
          <MoneyText :amount="row.repayment.amount" :currency="row.repayment.currency" tone="plain" class="text-sm" />
          <span v-if="row.converted" class="font-mono text-xs whitespace-nowrap text-muted">{{ row.converted }}</span>
        </div>
        <button
          type="button"
          :class="iconButton"
          :data-repayment-delete="row.repayment.id"
          :aria-label="t('debts.history.delete', { date: row.date })"
          @click="confirmDelete(row.repayment, index)"
        >
          <AppIcon name="trash" />
        </button>
      </li>
    </ul>
  </div>
</template>
