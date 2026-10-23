<script setup lang="ts">
import type { GroupDto, GroupExpenseDto } from '~/shared/api/contract'

type ExpenseView = 'active' | 'deleted'

defineProps<{ group: GroupDto }>()
const emit = defineEmits<{ add: []; edit: [expense: GroupExpenseDto] }>()
const { t } = useI18n()

const TITLE_ID = 'group-expenses-title'
const views: readonly ExpenseView[] = ['active', 'deleted']

const view = ref<ExpenseView>('active')
const showsDeleted = computed(() => view.value === 'deleted')
const { items, hasMore, loadMore, isPending, isLoadingMore, isError, refetch } = useExpenses(showsDeleted)

const viewOptions = computed(() => views.map((value) => ({ value, label: t(`groups.expenses.${value}`) })))
</script>

<template>
  <section :aria-labelledby="TITLE_ID" class="flex flex-col gap-4">
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
        <Button :label="t('groups.actions.addExpense')" class="min-h-11" @click="emit('add')" />
      </template>
    </EmptyState>
    <EmptyState v-else-if="items.length === 0" :title="t('groups.expenses.emptyDeleted')" />
    <div v-else class="flex flex-col gap-1 rounded-(--radius-card) bg-surface px-4 py-1 lg:px-5.5">
      <ExpenseRow
        v-for="expense in items"
        :key="expense.id"
        :group="group"
        :expense="expense"
        @edit="emit('edit', expense)"
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
  </section>
</template>
