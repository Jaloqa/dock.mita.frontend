<script setup lang="ts">
import type { GroupDto, GroupRepaymentDto } from '~/shared/api/contract'
import { actorName, memberName } from '../utils/groupView'

const props = defineProps<{ group: GroupDto; repayment: GroupRepaymentDto }>()
const emit = defineEmits<{ edit: [] }>()
const { t, d } = useI18n()
const { format } = useMoney()

const titleId = computed(() => `group-repayment-${props.repayment.id}-title`)
const from = computed(() => memberName(props.group, props.repayment.fromMemberId))
const to = computed(() => memberName(props.group, props.repayment.toMemberId))
const title = computed(() => t('groups.repayment.title', { from: from.value, to: to.value }))
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
const editedBy = computed(() =>
  props.repayment.updatedBy
    ? t('groups.repayment.editedBy', { name: actorName(props.repayment.updatedBy) })
    : undefined,
)
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
      <Button
        v-if="!repayment.deleted"
        severity="secondary"
        text
        class="-my-1.5 -mr-2 size-11 shrink-0"
        :aria-label="t('groups.repayment.edit', { from, to })"
        @click="emit('edit')"
      >
        <AppIcon name="edit" />
      </Button>
    </div>
    <p v-if="repayment.note" class="m-0 text-xs break-words text-muted">{{ repayment.note }}</p>
    <p class="m-0 text-xs text-muted">
      {{ addedBy }}<template v-if="editedBy"> · {{ editedBy }}</template>
    </p>
  </article>
</template>
