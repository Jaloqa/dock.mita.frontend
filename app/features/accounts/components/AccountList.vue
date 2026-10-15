<script setup lang="ts">
import type { AccountDto } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'

defineProps<{
  active: AccountDto[]
  archived: AccountDto[]
  baseCurrency: Currency
  baseAmountOf: (account: AccountDto) => number | undefined
  isPending: boolean
  isError: boolean
}>()
const emit = defineEmits<{ edit: [account: AccountDto]; add: []; retry: [] }>()
const { t } = useI18n()
const showArchived = ref(false)
const grid = 'grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4'
</script>

<template>
  <section :aria-label="t('accounts.list.label')" class="flex flex-col gap-4">
    <div v-if="isPending" :class="grid" aria-hidden="true">
      <Skeleton v-for="index in 3" :key="index" height="9.5rem" border-radius="16px" />
    </div>
    <ErrorState v-else-if="isError" @retry="emit('retry')" />
    <EmptyState
      v-else-if="active.length === 0 && archived.length === 0"
      :title="t('accounts.list.emptyTitle')"
      :description="t('accounts.list.emptyDescription')"
    >
      <template #action>
        <Button :label="t('accounts.actions.add')" @click="emit('add')" />
      </template>
    </EmptyState>
    <template v-else>
      <div v-if="active.length > 0" :class="grid">
        <AccountCard
          v-for="account in active"
          :key="account.id"
          :account="account"
          :base-currency="baseCurrency"
          :base-amount="baseAmountOf(account)"
          @edit="emit('edit', account)"
        />
      </div>
      <template v-if="archived.length > 0">
        <Button
          text
          class="min-h-11 self-start"
          :label="
            showArchived ? t('accounts.actions.hideArchived') : t('accounts.actions.showArchived', { count: archived.length })
          "
          :aria-expanded="showArchived"
          aria-controls="archived-accounts"
          @click="showArchived = !showArchived"
        />
        <div v-if="showArchived" id="archived-accounts" :class="grid">
          <AccountCard
            v-for="account in archived"
            :key="account.id"
            :account="account"
            :base-currency="baseCurrency"
            :base-amount="baseAmountOf(account)"
            @edit="emit('edit', account)"
          />
        </div>
      </template>
    </template>
  </section>
</template>
