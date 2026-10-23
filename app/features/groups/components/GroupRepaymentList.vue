<script setup lang="ts">
import type { GroupDto, GroupRepaymentDto } from '~/shared/api/contract'
import { repaymentTitle } from '../utils/groupView'

type RepaymentView = 'active' | 'deleted'

const props = defineProps<{ group: GroupDto; canRecord: boolean; hintId?: string }>()
const emit = defineEmits<{ record: []; edit: [repayment: GroupRepaymentDto] }>()
const { t } = useI18n()
const notify = useNotify()
const { restore, isMissing, refresh } = useGroupRepaymentMutations()

const TITLE_ID = 'group-repayments-title'
const views: readonly RepaymentView[] = ['active', 'deleted']

const root = ref<HTMLElement | null>(null)
const view = ref<RepaymentView>('active')
const showsDeleted = computed(() => view.value === 'deleted')
const { items, hasMore, loadMore, isPending, isLoadingMore, isError, refetch } = useGroupRepayments(showsDeleted)
const historyOpen = ref(false)
const historyTarget = ref<{ id: string; title: string }>()

const viewOptions = computed(() => views.map((value) => ({ value, label: t(`groups.repayments.${value}`) })))

function openHistory(repayment: GroupRepaymentDto) {
  historyTarget.value = { id: repayment.id, title: repaymentTitle(t, props.group, repayment) }
  historyOpen.value = true
}

async function focusAfterRestore(neighbourId: string | undefined) {
  await nextTick()
  const neighbour = neighbourId ? root.value?.querySelector<HTMLElement>(`[data-restore="${neighbourId}"]`) : null
  const target = neighbour ?? root.value?.querySelector<HTMLElement>('[aria-pressed="true"]')
  target?.focus()
}

function restoreRepayment(repayment: GroupRepaymentDto) {
  if (restore.isPending.value) return
  const index = items.value.findIndex((item) => item.id === repayment.id)
  const neighbour = items.value[index + 1] ?? items.value[index - 1]
  restore.mutate(repayment.id, {
    onSuccess: () => {
      notify.success(t('groups.repayment.toast.restored'))
      focusAfterRestore(neighbour?.id)
    },
    onError: (error) => {
      notify.error(error)
      if (isMissing(error)) refresh()
    },
  })
}
</script>

<template>
  <section ref="root" :aria-labelledby="TITLE_ID" class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 :id="TITLE_ID" class="m-0 text-base font-semibold">{{ t('groups.repayments.title') }}</h2>
      <SelectButton
        v-model="view"
        class="mita-segmented"
        :options="viewOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        :aria-label="t('groups.repayments.view')"
        :pt="{ pcToggleButton: { root: { class: 'min-h-11!' } } }"
      />
    </div>
    <div v-if="isPending" class="flex flex-col gap-3 rounded-(--radius-card) bg-surface p-4" aria-hidden="true">
      <Skeleton v-for="index in 3" :key="index" height="4rem" />
    </div>
    <ErrorState v-else-if="isError" @retry="refetch()" />
    <EmptyState v-else-if="items.length === 0 && !showsDeleted" :title="t('groups.repayments.empty')">
      <template #action>
        <Button
          :label="t('groups.actions.recordRepayment')"
          class="min-h-11"
          :disabled="!canRecord"
          :aria-describedby="canRecord ? undefined : hintId"
          @click="emit('record')"
        />
      </template>
    </EmptyState>
    <EmptyState v-else-if="items.length === 0" :title="t('groups.repayments.emptyDeleted')" />
    <div v-else class="flex flex-col gap-1 rounded-(--radius-card) bg-surface px-4 py-1 lg:px-5.5">
      <GroupRepaymentRow
        v-for="repayment in items"
        :key="repayment.id"
        :group="group"
        :repayment="repayment"
        :restoring="restore.isPending.value"
        @edit="emit('edit', repayment)"
        @history="openHistory(repayment)"
        @restore="restoreRepayment(repayment)"
      />
      <Button
        v-if="hasMore"
        :label="t('groups.repayments.showMore')"
        text
        class="mb-2 min-h-11 self-start"
        :loading="isLoadingMore"
        @click="loadMore()"
      />
    </div>
    <EntryHistoryDialog
      v-model:visible="historyOpen"
      :group="group"
      kind="repayments"
      :entry-id="historyTarget?.id"
      :title="historyTarget?.title ?? ''"
    />
  </section>
</template>
