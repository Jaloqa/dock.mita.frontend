<script setup lang="ts">
import type { GroupDto, GroupExpenseDto } from '~/shared/api/contract'
import { actorName, categoryLabel, memberName, splitSummary } from '../utils/groupView'

const props = defineProps<{ group: GroupDto; expense: GroupExpenseDto }>()
const emit = defineEmits<{ edit: [] }>()
const { t, d } = useI18n()
const { format } = useMoney()

const titleId = computed(() => `expense-${props.expense.id}-title`)
const category = computed(() => categoryLabel(t, props.group, props.expense.categoryId))
const title = computed(() => props.expense.description ?? category.value)
const date = computed(() =>
  d(new Date(`${props.expense.date}T00:00:00Z`), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
)
const paidBy = computed(() => t('groups.expense.paidBy', { name: memberName(props.group, props.expense.payerId) }))
const converted = computed(() =>
  props.expense.currency === props.group.currency
    ? undefined
    : t('groups.expense.groupAmount', { amount: format(props.expense.groupAmount, props.group.currency) }),
)
const split = computed(() => splitSummary(t, props.group, props.expense))
const addedBy = computed(() => t('groups.expense.addedBy', { name: actorName(props.expense.createdBy) }))
const editedBy = computed(() =>
  props.expense.updatedBy ? t('groups.expense.editedBy', { name: actorName(props.expense.updatedBy) }) : undefined,
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
        <span class="text-xs text-muted">{{ date }} · {{ paidBy }}</span>
      </div>
      <div class="flex shrink-0 flex-col items-end gap-0.5">
        <MoneyText :amount="expense.amount" :currency="expense.currency" tone="plain" class="text-sm" />
        <span v-if="converted" class="font-mono text-xs whitespace-nowrap text-muted">{{ converted }}</span>
      </div>
      <Button
        v-if="!expense.deleted"
        severity="secondary"
        text
        class="-my-1.5 -mr-2 size-11 shrink-0"
        :aria-label="t('groups.expense.edit', { title })"
        @click="emit('edit')"
      >
        <AppIcon name="edit" />
      </Button>
    </div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span>{{ category }}</span>
      <span>{{ split }}</span>
      <ul
        v-if="expense.tags.length > 0"
        :aria-label="t('groups.expense.tags')"
        class="m-0 flex list-none flex-wrap gap-1 p-0"
      >
        <li
          v-for="tag in expense.tags"
          :key="tag"
          class="max-w-40 truncate rounded-full bg-track px-2 py-0.5 font-medium text-muted"
        >
          {{ tag }}
        </li>
      </ul>
    </div>
    <p class="m-0 text-xs text-muted">
      {{ addedBy }}<template v-if="editedBy"> · {{ editedBy }}</template>
    </p>
  </article>
</template>
