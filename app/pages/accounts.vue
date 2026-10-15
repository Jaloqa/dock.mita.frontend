<script setup lang="ts">
import type { AccountDto } from '~/shared/api/contract'

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
  settingsReady,
  accountsPending,
  accountsError,
  refetch,
} = useAccountsSummary()

const accountDialogOpen = ref(false)
const editing = ref<AccountDto>()

const allAccounts = computed(() => [...active.value, ...archived.value])
const totalLabel = computed(() =>
  total.value === undefined ? undefined : t('accounts.total', { amount: format(total.value, baseCurrency.value) }),
)

function openCreate() {
  if (!settingsReady.value) return
  editing.value = undefined
  accountDialogOpen.value = true
}

function openEdit(account: AccountDto) {
  editing.value = account
  accountDialogOpen.value = true
}

useHead({ title: () => t('navigation.accounts') })
</script>

<template>
  <PageHeader :title="t('navigation.accounts')">
    <template #eyebrow>
      <span v-if="totalLabel" data-testid="accounts-total">{{ totalLabel }}</span>
      <Skeleton v-else-if="isPending" width="10rem" height="1rem" />
    </template>
    <template #actions>
      <Button class="min-h-11" :disabled="!settingsReady" @click="openCreate">
        <AppIcon name="plus" :size="16" :stroke-width="2.2" />
        {{ t('accounts.actions.add') }}
      </Button>
    </template>
  </PageHeader>
  <AccountList
    :active="active"
    :archived="archived"
    :base-currency="baseCurrency"
    :base-amount-of="baseAmountOf"
    :is-pending="isPending"
    :is-error="isError"
    @edit="openEdit"
    @add="openCreate"
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
  <AccountDialog v-model:visible="accountDialogOpen" :account="editing" />
</template>
