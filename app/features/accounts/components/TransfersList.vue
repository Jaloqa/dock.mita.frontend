<script setup lang="ts">
import type { AccountDto } from '~/shared/api/contract'

const props = defineProps<{ accounts: AccountDto[]; accountsPending: boolean; accountsError: boolean }>()
const emit = defineEmits<{ transfer: []; retry: [] }>()
const { t, d } = useI18n()
const { format } = useMoney()
const transfers = useTransfers()
const { items, isPending, isError, hasNextPage, isFetchingNextPage } = transfers

const byId = computed(() => new Map(props.accounts.map((account) => [account.id, account])))
const rows = computed(() =>
  items.value.flatMap((transfer) => {
    const from = byId.value.get(transfer.fromAccountId)
    const to = byId.value.get(transfer.toAccountId)
    if (!from || !to) return []
    return [{ transfer, from, to, route: t('accounts.transfers.route', { from: from.name, to: to.name }) }]
  }),
)
const retry = () => {
  transfers.refetch()
  emit('retry')
}
const day = (iso: string) => d(new Date(`${iso}T00:00:00Z`), 'dayMonth')
</script>

<template>
  <section
    aria-labelledby="accounts-transfers"
    class="flex min-w-0 flex-[2_1_420px] flex-col gap-1.5 rounded-(--radius-card) bg-surface p-5.5"
  >
    <h2 id="accounts-transfers" class="m-0 mb-2 text-base font-semibold">{{ t('accounts.transfers.title') }}</h2>
    <div v-if="isPending || accountsPending" class="flex flex-col gap-3" aria-hidden="true">
      <Skeleton v-for="index in 3" :key="index" height="3rem" />
    </div>
    <ErrorState v-else-if="isError || accountsError" @retry="retry" />
    <div v-else-if="items.length === 0" class="flex flex-col items-start gap-3 py-2">
      <p class="m-0 text-sm text-muted">{{ t('accounts.transfers.empty') }}</p>
      <Button :label="t('accounts.actions.transfer')" severity="secondary" outlined @click="emit('transfer')" />
    </div>
    <template v-else>
      <ul class="m-0 list-none p-0">
        <li v-for="row in rows" :key="row.transfer.id" class="flex items-center gap-3 border-t border-bg py-3">
          <span class="flex size-9 flex-none items-center justify-center rounded-(--radius-control) bg-track text-ink">
            <AppIcon name="transfer" />
          </span>
          <span class="flex min-w-0 flex-auto flex-col gap-0.5">
            <span class="break-words text-sm font-medium">{{ row.route }}</span>
            <span class="text-xs text-muted">{{ day(row.transfer.date) }}</span>
          </span>
          <span class="flex flex-none flex-col items-end gap-0.5">
            <MoneyText :amount="row.transfer.fromAmount" :currency="row.from.currency" tone="plain" class="text-sm" />
            <span v-if="row.from.currency !== row.to.currency" class="font-mono text-xs text-muted">
              {{ t('accounts.transfers.received', { amount: format(row.transfer.toAmount, row.to.currency) }) }}
            </span>
          </span>
        </li>
      </ul>
      <Button
        v-if="hasNextPage"
        :label="t('accounts.transfers.showMore')"
        text
        class="min-h-11 self-start"
        :loading="isFetchingNextPage"
        @click="transfers.fetchNextPage()"
      />
    </template>
  </section>
</template>
