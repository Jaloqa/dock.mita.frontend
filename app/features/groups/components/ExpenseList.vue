<script setup lang="ts">
import type { GroupDto, GroupExpenseDto } from '~/shared/api/contract'
import { expenseTitle } from '../utils/groupView'
import { unlessMemberRefusal } from '../utils/scope'

type ExpenseView = 'active' | 'deleted'

const props = defineProps<{ group: GroupDto; canAdd: boolean; hintId?: string }>()
const emit = defineEmits<{ add: []; edit: [expense: GroupExpenseDto] }>()
const { t } = useI18n()
const notify = useNotify()
const { restore, isMissing, refresh } = useExpenseMutations()

const TITLE_ID = 'group-expenses-title'
const views: readonly ExpenseView[] = ['active', 'deleted']

const root = ref<HTMLElement | null>(null)
const view = ref<ExpenseView>('active')
const showsDeleted = computed(() => view.value === 'deleted')
const { items, hasMore, loadMore, isPending, isLoadingMore, isError, refetch } = useExpenses(showsDeleted)
const historyOpen = ref(false)
const historyTarget = ref<{ id: string; title: string }>()

const viewOptions = computed(() => views.map((value) => ({ value, label: t(`groups.expenses.${value}`) })))

function openHistory(expense: GroupExpenseDto) {
  historyTarget.value = { id: expense.id, title: expenseTitle(t, props.group, expense) }
  historyOpen.value = true
}

async function focusAfterRestore(neighbourId: string | undefined) {
  await nextTick()
  const neighbour = neighbourId ? root.value?.querySelector<HTMLElement>(`[data-restore="${neighbourId}"]`) : null
  const target = neighbour ?? root.value?.querySelector<HTMLElement>('[aria-pressed="true"]')
  target?.focus()
}

function restoreExpense(expense: GroupExpenseDto) {
  if (restore.isPending.value) return
  const index = items.value.findIndex((item) => item.id === expense.id)
  const neighbour = items.value[index + 1] ?? items.value[index - 1]
  restore.mutate(expense.id, {
    onSuccess: () => {
      notify.success(t('groups.expense.toast.restored'))
      focusAfterRestore(neighbour?.id)
    },
    onError: unlessMemberRefusal((error) => {
      notify.error(error)
      if (isMissing(error)) refresh()
    }),
  })
}
</script>

<template>
  <section ref="root" :aria-labelledby="TITLE_ID" class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 :id="TITLE_ID" class="m-0 text-base font-semibold">{{ t('groups.expenses.title') }}</h2>
      <SelectButton
        v-model="view"
        class="mita-segmented"
        :options="viewOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        :aria-label="t('groups.expenses.view')"
        :pt="{ pcToggleButton: { root: { class: 'min-h-11!' } } }"
      />
    </div>
    <div v-if="isPending" class="flex flex-col gap-3 rounded-(--radius-card) bg-surface p-4" aria-hidden="true">
      <Skeleton v-for="index in 3" :key="index" height="4rem" />
    </div>
    <ErrorState v-else-if="isError" @retry="refetch()" />
    <EmptyState v-else-if="items.length === 0 && !showsDeleted" :title="t('groups.expenses.empty')">
      <template #action>
        <Button
          :label="t('groups.actions.addExpense')"
          class="min-h-11"
          :disabled="!canAdd"
          :aria-describedby="canAdd ? undefined : hintId"
          @click="emit('add')"
        />
      </template>
    </EmptyState>
    <EmptyState v-else-if="items.length === 0" :title="t('groups.expenses.emptyDeleted')" />
    <div v-else class="flex flex-col gap-1 rounded-(--radius-card) bg-surface px-4 py-1 lg:px-5.5">
      <ExpenseRow
        v-for="expense in items"
        :key="expense.id"
        :group="group"
        :expense="expense"
        :restoring="restore.isPending.value"
        @edit="emit('edit', expense)"
        @history="openHistory(expense)"
        @restore="restoreExpense(expense)"
      />
      <Button
        v-if="hasMore"
        :label="t('groups.expenses.showMore')"
        text
        class="mb-2 min-h-11 self-start"
        :loading="isLoadingMore"
        @click="loadMore()"
      />
    </div>
    <EntryHistoryDialog
      v-model:visible="historyOpen"
      :group="group"
      kind="expenses"
      :entry-id="historyTarget?.id"
      :title="historyTarget?.title ?? ''"
    />
  </section>
</template>
