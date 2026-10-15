<script setup lang="ts">
const { t } = useI18n()
const { format } = useMoney()
const {
  active,
  archived,
  total,
  shares,
  baseCurrency,
  baseAmountOf,
  isPending,
  isError,
  accountsPending,
  accountsError,
  refetch,
} = useAccountsSummary()

const allAccounts = computed(() => [...active.value, ...archived.value])
const totalLabel = computed(() =>
  total.value === undefined ? undefined : t('accounts.total', { amount: format(total.value, baseCurrency.value) }),
)

useHead({ title: () => t('navigation.accounts') })
</script>

<template>
  <PageHeader :title="t('navigation.accounts')">
    <template #eyebrow>
      <span v-if="totalLabel" data-testid="accounts-total">{{ totalLabel }}</span>
      <Skeleton v-else-if="isPending" width="10rem" height="1rem" />
    </template>
  </PageHeader>
  <AccountList
    :active="active"
    :archived="archived"
    :base-currency="baseCurrency"
    :base-amount-of="baseAmountOf"
    :is-pending="isPending"
    :is-error="isError"
    @retry="refetch"
  />
  <div class="flex flex-wrap items-start gap-4">
    <AccountsDistribution :shares="shares" :is-pending="isPending" :is-error="isError" />
    <TransfersList
      :accounts="allAccounts"
      :accounts-pending="accountsPending"
      :accounts-error="accountsError"
      @retry="refetch"
    />
  </div>
</template>
