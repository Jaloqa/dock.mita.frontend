<script setup lang="ts">
import type { GroupDto, GroupRepaymentDto } from '~/shared/api/contract'
import { actorName, memberName, repaymentTitle } from '../utils/groupView'

const props = defineProps<{ group: GroupDto; repayment: GroupRepaymentDto; restoring?: boolean }>()
const emit = defineEmits<{ edit: []; history: []; restore: [] }>()
const { t, d } = useI18n()
const { format } = useMoney()

const titleId = computed(() => `group-repayment-${props.repayment.id}-title`)
const from = computed(() => memberName(props.group, props.repayment.fromMemberId))
const to = computed(() => memberName(props.group, props.repayment.toMemberId))
const title = computed(() => repaymentTitle(t, props.group, props.repayment))
const date = computed(() =>
  d(new Date(`${props.repayment.date}T00:00:00Z`), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }),
)
const converted = computed(() =>
  props.repayment.currency === props.group.currency
    ? undefined
    : t('groups.repayment.groupAmount', { amount: format(props.repayment.groupAmount, props.group.currency) }),
)
const addedBy = computed(() => t('groups.repayment.addedBy', { name: actorName(props.repayment.createdBy) }))
const changedBy = computed(() => {
  const { updatedBy, deleted } = props.repayment
  if (!updatedBy) return undefined
  return deleted
    ? t('groups.history.actions.deleted', { name: actorName(updatedBy) })
    : t('groups.repayment.editedBy', { name: actorName(updatedBy) })
})
</script>

<template>
  <article
    :aria-labelledby="titleId"
    class="flex min-w-0 flex-col gap-1.5 border-t border-border py-3 first:border-t-0"
  >
    <div class="flex items-start gap-3">
      <div class="flex min-w-0 flex-auto flex-col gap-0.5">
        <h3 :id="titleId" class="m-0 text-sm font-semibold break-words">{{ title }}</h3>
        <span class="text-xs text-muted">{{ date }}</span>
      </div>
      <div class="flex shrink-0 flex-col items-end gap-0.5">
        <MoneyText :amount="repayment.amount" :currency="repayment.currency" tone="plain" class="text-sm" />
        <span v-if="converted" class="font-mono text-xs whitespace-nowrap text-muted">{{ converted }}</span>
      </div>
      <div class="-my-1.5 -mr-2 flex shrink-0">
        <Button
          severity="secondary"
          text
          class="size-11"
          :aria-label="t('groups.history.title', { title })"
          @click="emit('history')"
        >
          <AppIcon name="history" />
        </Button>
        <Button
          v-if="!repayment.deleted"
          severity="secondary"
          text
          class="size-11"
          :aria-label="t('groups.repayment.edit', { from, to })"
          @click="emit('edit')"
        >
          <AppIcon name="edit" />
        </Button>
      </div>
    </div>
    <p v-if="repayment.note" class="m-0 text-xs break-words text-muted">{{ repayment.note }}</p>
    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <p class="m-0 text-xs text-muted">
        {{ addedBy }}<template v-if="changedBy"> · {{ changedBy }}</template>
      </p>
      <Button
        v-if="repayment.deleted"
        :label="t('groups.history.restore')"
        :aria-label="t('groups.history.restoreNamed', { title })"
        :data-restore="repayment.id"
        severity="secondary"
        outlined
        class="min-h-11"
        :disabled="restoring"
        @click="emit('restore')"
      />
    </div>
  </article>
</template>
