<script setup lang="ts">
import type { AccountDto } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'

const props = defineProps<{ account: AccountDto; baseCurrency: Currency; baseAmount?: number }>()
const emit = defineEmits<{ edit: [] }>()
const { t } = useI18n()
const { format } = useMoney()

const isDeep = computed(() => props.account.type === 'savings' && !props.account.archived)
const headingId = computed(() => `account-${props.account.id}`)
const meta = computed(() => {
  const parts: string[] = []
  if (props.account.type === 'card' && props.account.cardLast4) {
    parts.push(t('accounts.meta.card', { last4: props.account.cardLast4 }))
  }
  if (props.account.type === 'savings' && props.account.linkedGoals > 0) {
    parts.push(t('accounts.meta.linkedToGoals'))
  }
  if (props.account.currency !== props.baseCurrency && props.baseAmount !== undefined) {
    parts.push(t('accounts.meta.converted', { amount: format(props.baseAmount, props.baseCurrency) }))
  }
  return parts.length > 0 ? parts.join(' · ') : t(`accounts.meta.${props.account.type}`)
})
</script>

<template>
  <article
    :aria-labelledby="headingId"
    class="flex min-w-0 flex-col gap-4.5 rounded-(--radius-card) p-5.5"
    :class="[isDeep ? 'bg-deep text-on-deep' : 'bg-surface text-ink', { 'opacity-75': account.archived }]"
  >
    <div class="flex items-center justify-between gap-2">
      <h2 :id="headingId" class="m-0 truncate text-base font-semibold">{{ account.name }}</h2>
      <div class="flex shrink-0 items-center gap-1">
        <span
          class="rounded-full px-2.5 py-1 text-xs font-semibold"
          :class="isDeep ? 'bg-on-deep/15 text-on-deep' : 'bg-track text-ink'"
        >
          {{ account.archived ? t('accounts.archivedBadge') : t(`accounts.type.${account.type}`) }}
        </span>
        <button
          type="button"
          class="-mr-2 flex size-11 items-center justify-center rounded-(--radius-control) opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100"
          :aria-label="t('accounts.actions.edit', { name: account.name })"
          @click="emit('edit')"
        >
          <AppIcon name="edit" />
        </button>
      </div>
    </div>
    <MoneyText :amount="account.balance" :currency="account.currency" tone="plain" class="text-[28px] tracking-tight" />
    <span class="text-[13px]" :class="isDeep ? 'text-deep-muted' : 'text-muted'">{{ meta }}</span>
  </article>
</template>
