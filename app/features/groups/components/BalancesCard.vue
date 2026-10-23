<script setup lang="ts">
import type { GroupDto, GroupTransferDto } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/currencies'
import { useUserSettings } from '~/shared/user/useUserSettings'
import { balancesIn, transfersIn } from '../utils/balances'
import { memberName } from '../utils/groupView'

const props = defineProps<{ group: GroupDto }>()
const emit = defineEmits<{ record: [transfer: GroupTransferDto] }>()
const { t } = useI18n()
const { baseCurrency } = useUserSettings()

const TITLE_ID = 'group-balances-title'
const CURRENCY_ID = 'group-balances-currency'

const viewCurrency = ref<Currency>(props.group.currency)
const main = useGroupBalances(() => props.group.currency)
const shown = useGroupBalances(viewCurrency)

watch(
  () => props.group.currency,
  (currency) => {
    viewCurrency.value = currency
  },
)

const pinnedCurrencies = computed(() => [props.group.currency, baseCurrency.value])
const isPending = computed(() => main.isPending.value || shown.isPending.value)
const viewFailed = computed(() => shown.isError.value && !main.isError.value)
const hasMembers = computed(() => props.group.members.length > 0)
const figures = computed(() => (viewFailed.value ? main.balances.value : shown.balances.value))
const figuresCurrency = computed(() => figures.value?.currency ?? props.group.currency)

const rows = computed(() =>
  balancesIn(main.balances.value?.members ?? [], figures.value?.members ?? []).map((entry) => ({
    ...entry,
    name: memberName(props.group, entry.memberId),
  })),
)

const transfers = computed(() =>
  transfersIn(main.balances.value?.transfers ?? [], figures.value?.transfers ?? []).map(({ transfer, amount }) => ({
    transfer,
    amount,
    from: memberName(props.group, transfer.fromMemberId),
    to: memberName(props.group, transfer.toMemberId),
  })),
)

function retry() {
  main.refetch()
  if (shown.isError.value) shown.refetch()
}
</script>

<template>
  <section :aria-labelledby="TITLE_ID" class="flex flex-col gap-4 rounded-(--radius-card) bg-surface p-4 lg:p-5.5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 :id="TITLE_ID" class="m-0 text-base font-semibold">{{ t('groups.balances.title') }}</h2>
      <div class="flex items-center gap-2">
        <label :id="`${CURRENCY_ID}-label`" :for="CURRENCY_ID" class="text-[13px] font-medium text-muted">
          {{ t('groups.balances.showIn') }}
        </label>
        <div class="w-32">
          <CurrencySelect
            v-model="viewCurrency"
            :input-id="CURRENCY_ID"
            :pinned="pinnedCurrencies"
            compact
            :label-id="`${CURRENCY_ID}-label`"
          />
        </div>
      </div>
    </div>
    <p v-if="!hasMembers" class="m-0 text-sm text-muted">{{ t('groups.balances.empty') }}</p>
    <div v-else-if="isPending" class="flex flex-col gap-3" aria-hidden="true">
      <Skeleton v-for="index in 4" :key="index" height="2.5rem" />
    </div>
    <ErrorState v-else-if="main.isError.value" compact @retry="retry" />
    <template v-else>
      <div
        v-if="viewFailed"
        role="alert"
        class="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-control) bg-track px-3 py-2"
      >
        <p class="m-0 min-w-0 flex-1 text-sm">
          {{ t('groups.balances.viewFailed', { currency: viewCurrency, main: group.currency }) }}
        </p>
        <Button
          :label="t('shared.actions.retry')"
          severity="secondary"
          outlined
          class="min-h-11 shrink-0"
          @click="shown.refetch()"
        />
      </div>
      <ul :aria-label="t('groups.balances.members')" class="m-0 flex list-none flex-col p-0">
        <li
          v-for="row in rows"
          :key="row.memberId"
          class="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0"
        >
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="text-sm font-semibold break-words">{{ row.name }}</span>
            <span class="text-xs text-muted">{{ t(`groups.balances.${row.kind}`) }}</span>
          </div>
          <MoneyText :amount="row.balance" :currency="figuresCurrency" signed class="text-sm" />
        </li>
      </ul>
      <div class="flex flex-col gap-1">
        <h3 class="m-0 text-sm font-semibold">{{ t('groups.balances.transfers') }}</h3>
        <p v-if="transfers.length === 0" class="m-0 py-2 text-sm text-muted">{{ t('groups.balances.settledUp') }}</p>
        <ul v-else :aria-label="t('groups.balances.transfers')" class="m-0 flex list-none flex-col p-0">
          <li
            v-for="row in transfers"
            :key="`${row.transfer.fromMemberId}-${row.transfer.toMemberId}`"
            class="flex items-center gap-3 border-t border-border py-1.5 first:border-t-0"
          >
            <span class="min-w-0 flex-auto text-sm break-words">
              {{ t('groups.balances.pays', { from: row.from, to: row.to }) }}
            </span>
            <MoneyText :amount="row.amount" :currency="figuresCurrency" tone="plain" class="text-sm" />
            <Button
              :label="t('groups.balances.record')"
              :aria-label="t('groups.balances.recordNamed', { from: row.from, to: row.to })"
              severity="secondary"
              outlined
              class="min-h-11 shrink-0"
              @click="emit('record', row.transfer)"
            />
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
