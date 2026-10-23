<script setup lang="ts">
import type { GroupDto, GroupExpenseState, GroupRepaymentState } from '~/shared/api/contract'
import type { EntryKind } from '../composables/useEntryHistory'
import { actorName, categoryLabel, memberName, sharingMembers } from '../utils/groupView'
import {
  type ExpenseField,
  expenseChanges,
  isExpenseState,
  type RepaymentField,
  repaymentChanges,
} from '../utils/history'

type EntryState = GroupExpenseState | GroupRepaymentState

type ChangeLine = { field: string; text: string }

const props = defineProps<{ group: GroupDto; kind: EntryKind; entryId: string | undefined; title: string }>()
const visible = defineModel<boolean>('visible', { required: true })
const { t, d, n } = useI18n()
const { format } = useMoney()
const { events, hasMore, loadMore, isPending, isLoadingMore, isError, refetch } = useEntryHistory(
  () => props.kind,
  () => props.entryId,
)

const none = computed(() => t('groups.history.none'))

const date = (iso: string) =>
  d(new Date(`${iso}T00:00:00Z`), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

const rate = (state: { rate: number; rateManual: boolean }) => {
  const text = n(state.rate, { minimumFractionDigits: 2, maximumFractionDigits: 12 })
  return state.rateManual ? t('groups.history.manualRate', { rate: text }) : text
}

const split = (state: GroupExpenseState) => {
  if (state.split === 'exact') {
    const shares = state.shares
      .map((share) => `${memberName(props.group, share.memberId)} ${format(share.amount, state.currency)}`)
      .join(', ')
    return t('groups.history.split.exact', { shares })
  }
  const { everyone, names } = sharingMembers(props.group, state)
  return everyone ? t('groups.history.split.everyone') : t('groups.history.split.some', { names: names.join(', ') })
}

const expenseValues: Record<ExpenseField, (state: GroupExpenseState) => string> = {
  payer: (state) => memberName(props.group, state.payerId),
  amount: (state) => format(state.amount, state.currency),
  date: (state) => date(state.date),
  category: (state) => categoryLabel(t, props.group, state.categoryId),
  tags: (state) => (state.tags.length > 0 ? state.tags.join(', ') : none.value),
  description: (state) => state.description ?? none.value,
  rate,
  split,
}

const repaymentValues: Record<RepaymentField, (state: GroupRepaymentState) => string> = {
  from: (state) => memberName(props.group, state.fromMemberId),
  to: (state) => memberName(props.group, state.toMemberId),
  amount: (state) => format(state.amount, state.currency),
  date: (state) => date(state.date),
  rate,
  note: (state) => state.note ?? none.value,
}

const line = (field: string, before: string, after: string): ChangeLine => ({
  field,
  text: t('groups.history.change', { label: t(`groups.history.fields.${field}`), before, after }),
})

function changeLines(previous: EntryState, current: EntryState): ChangeLine[] {
  if (isExpenseState(previous) && isExpenseState(current)) {
    return expenseChanges(previous, current).map((field) =>
      line(field, expenseValues[field](previous), expenseValues[field](current)),
    )
  }
  if (!isExpenseState(previous) && !isExpenseState(current)) {
    return repaymentChanges(previous, current).map((field) =>
      line(field, repaymentValues[field](previous), repaymentValues[field](current)),
    )
  }
  return []
}

const when = (at: string) =>
  t('groups.history.when', {
    date: d(new Date(at), 'long'),
    time: d(new Date(at), { hour: '2-digit', minute: '2-digit' }),
  })

const entries = computed(() =>
  events.value.map((event, index) => {
    const previous = events.value[index + 1]
    const compared = event.action === 'updated' && previous !== undefined
    const lines = compared ? changeLines(previous.state, event.state) : []
    return {
      id: event.id,
      at: event.at,
      label: t(`groups.history.actions.${event.action}`, { name: actorName(event.actor) }),
      when: when(event.at),
      lines,
      unchanged: compared && lines.length === 0,
    }
  }),
)
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('groups.history.title', { title })"
    class="w-[calc(100vw-2rem)] max-w-[34rem]"
  >
    <div v-if="isPending" class="flex flex-col gap-3" aria-hidden="true">
      <Skeleton v-for="index in 3" :key="index" height="3.5rem" />
    </div>
    <ErrorState v-else-if="isError" compact @retry="refetch()" />
    <div v-else class="flex flex-col gap-2">
      <ol :aria-label="t('groups.history.events')" class="m-0 flex list-none flex-col p-0">
        <li
          v-for="entry in entries"
          :key="entry.id"
          class="flex flex-col gap-1 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0"
        >
          <p class="m-0 text-sm font-semibold break-words">{{ entry.label }}</p>
          <time :datetime="entry.at" class="text-xs text-muted">{{ entry.when }}</time>
          <ul v-if="entry.lines.length > 0" class="m-0 flex list-none flex-col gap-0.5 p-0 text-sm">
            <li v-for="item in entry.lines" :key="item.field" class="break-words">{{ item.text }}</li>
          </ul>
          <p v-else-if="entry.unchanged" class="m-0 text-xs text-muted">{{ t('groups.history.noChanges') }}</p>
        </li>
      </ol>
      <Button
        v-if="hasMore"
        :label="t('groups.history.showMore')"
        text
        class="min-h-11 self-start"
        :loading="isLoadingMore"
        @click="loadMore()"
      />
    </div>
  </Dialog>
</template>
