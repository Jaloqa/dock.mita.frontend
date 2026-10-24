<script setup lang="ts">
import type { ToConfirmItemDto } from '~/shared/api/contract'
import { type ChangedField, changedFields, changeLabel, fieldValue, itemTitle } from '../utils/toConfirmView'

const emit = defineEmits<{ cleared: [] }>()

const TITLE_ID = 'to-confirm-title'

const { t, d } = useI18n()
const { format } = useMoney()
const notify = useNotify()
const confirm = useConfirm()
const { items, groups, groupsReady, hasMore, loadMore, isLoadingMore, isError, refetch } = useToConfirm()
const { reject, refresh } = useToConfirmMutations()

const dialogOpen = ref(false)
const target = ref<ToConfirmItemDto>()
const root = ref<HTMLElement | null>(null)
let neighbourKey: string | undefined

const shown = computed(() => (items.value.length > 0 && groupsReady.value) || isError.value)
const busy = computed(() => reject.isPending.value)

const keyOf = (item: ToConfirmItemDto) => `${item.kind}-${item.entryId}`
const titleOf = (item: ToConfirmItemDto) => itemTitle(t, item, groups.value.get(item.groupId))
const titleIdOf = (item: ToConfirmItemDto) => `to-confirm-${keyOf(item)}-title`
const termsOf = (item: ToConfirmItemDto) => item.current ?? item.previous
const formatDate = (date: string) =>
  d(new Date(`${date}T00:00:00Z`), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const dateOf = (item: ToConfirmItemDto) => {
  const date = termsOf(item)?.date
  return date === undefined ? '' : formatDate(date)
}

const targetGroup = computed(() => (target.value ? groups.value.get(target.value.groupId) : undefined))

function changesOf(item: ToConfirmItemDto): { field: ChangedField; text: string }[] {
  const { current, previous } = item
  if (current === null || previous === null) return []
  const view = { group: groups.value.get(item.groupId), groupCurrency: item.groupCurrency, formatDate }
  return changedFields(item).map((field) => ({
    field,
    text: t(`groups.toConfirm.changed.${field}`, {
      before: fieldValue(t, format, view, field, previous),
      after: fieldValue(t, format, view, field, current),
    }),
  }))
}

function neighbourOf(item: ToConfirmItemDto): string | undefined {
  const index = items.value.findIndex((row) => keyOf(row) === keyOf(item))
  const neighbour = items.value[index + 1] ?? items.value[index - 1]
  return neighbour ? keyOf(neighbour) : undefined
}

async function focusAfter(neighbour: string | undefined) {
  await nextTick()
  const next = neighbour ? root.value?.querySelector<HTMLElement>(`[data-confirm="${neighbour}"]`) : null
  const target = next ?? root.value?.querySelector<HTMLElement>('[data-confirm]')
  if (target) target.focus()
  else emit('cleared')
}

function open(item: ToConfirmItemDto) {
  neighbourKey = neighbourOf(item)
  target.value = item
  dialogOpen.value = true
}

function askReject(item: ToConfirmItemDto) {
  if (busy.value) return
  const neighbour = neighbourOf(item)
  confirm.require({
    header: t('groups.toConfirm.reject.title'),
    message: t('groups.toConfirm.reject.message'),
    acceptLabel: t('groups.toConfirm.reject.action'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      reject.mutate(item, {
        onSuccess: () => {
          notify.success(t('groups.toConfirm.toast.rejected'))
          focusAfter(neighbour)
        },
        onError: async (error) => {
          notify.error(error)
          await refresh()
          await focusAfter(neighbour)
        },
      }),
  })
}
</script>

<template>
  <section v-if="shown" ref="root" :aria-labelledby="TITLE_ID" class="flex flex-col gap-3">
    <h2 :id="TITLE_ID" class="m-0 text-base font-semibold">{{ t('groups.toConfirm.title') }}</h2>
    <div v-if="items.length > 0" class="flex flex-col gap-3">
      <article
        v-for="item in items"
        :key="keyOf(item)"
        :aria-labelledby="titleIdOf(item)"
        class="flex min-w-0 flex-col gap-2 rounded-(--radius-card) bg-surface p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 flex-col gap-0.5">
            <h3 :id="titleIdOf(item)" class="m-0 text-sm font-semibold break-words">{{ titleOf(item) }}</h3>
            <span class="text-xs text-muted break-words">
              {{ dateOf(item) }}
              · {{ item.groupName }} · {{ t('groups.toConfirm.by', { name: item.actor.name }) }}
            </span>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1">
            <MoneyText
              v-if="termsOf(item)"
              :amount="termsOf(item)?.amount ?? 0"
              :currency="termsOf(item)?.currency ?? item.groupCurrency"
              tone="plain"
              class="text-sm"
            />
            <span class="rounded-full bg-track px-2 py-0.5 text-xs font-medium text-muted">
              {{ changeLabel(t, item) }}
            </span>
          </div>
        </div>
        <p v-if="item.change === 'removed'" class="m-0 text-xs text-muted">{{ t('groups.toConfirm.deleted') }}</p>
        <ul
          v-if="changesOf(item).length > 0"
          :aria-label="t('groups.toConfirm.changes')"
          class="m-0 flex list-none flex-col gap-0.5 p-0 text-xs text-muted"
        >
          <li v-for="change in changesOf(item)" :key="change.field" class="break-words">{{ change.text }}</li>
        </ul>
        <div class="-mb-1 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            :label="t('groups.toConfirm.confirm')"
            :aria-label="t('groups.toConfirm.confirmItem', { title: titleOf(item) })"
            :data-confirm="keyOf(item)"
            class="min-h-11"
            @click="open(item)"
          />
          <Button
            type="button"
            :label="t('groups.toConfirm.reject.action')"
            :aria-label="t('groups.toConfirm.rejectItem', { title: titleOf(item) })"
            severity="secondary"
            outlined
            class="min-h-11"
            :disabled="busy"
            @click="askReject(item)"
          />
        </div>
      </article>
      <Button
        v-if="hasMore"
        :label="t('groups.toConfirm.showMore')"
        text
        class="min-h-11 self-start"
        :loading="isLoadingMore"
        @click="loadMore()"
      />
    </div>
    <div v-else class="rounded-(--radius-card) bg-surface px-4">
      <ErrorState compact @retry="refetch" />
    </div>
  </section>
  <!-- Outside the section: the section disappears when the last item is handled, and the dialog must outlive that refetch to finish its own callbacks. -->
  <ToConfirmDialog
    v-if="target"
    v-model:visible="dialogOpen"
    :item="target"
    :group="targetGroup"
    @handled="focusAfter(neighbourKey)"
  />
</template>
