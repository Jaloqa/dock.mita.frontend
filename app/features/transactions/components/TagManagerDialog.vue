<script setup lang="ts">
import type { TagDto } from '~/shared/api/contract'

const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const notify = useNotify()
const confirm = useConfirm()
const { tags, isPending, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = useTagList(visible)
const { remove, isMissing, refresh } = useTagMutations()

const root = ref<HTMLElement | null>(null)

const takenNames = (tag: TagDto) => tags.value.filter((other) => other.id !== tag.id).map((other) => other.name)

async function focusRename(id: string) {
  await nextTick()
  root.value?.querySelector<HTMLElement>(`[data-tag-rename="${id}"]`)?.focus()
}

async function focusClose() {
  await nextTick()
  root.value?.closest('[role="dialog"]')?.querySelector<HTMLElement>('.p-dialog-close-button')?.focus()
}

function confirmDelete(tag: TagDto) {
  const index = tags.value.findIndex((item) => item.id === tag.id)
  const neighbour = tags.value[index + 1] ?? tags.value[index - 1]
  confirm.require({
    header: t('transactions.tagManager.deleteTitle'),
    message:
      tag.usage > 0
        ? t('transactions.tagManager.deleteMessage', { name: tag.name, count: tag.usage }, tag.usage)
        : t('transactions.tagManager.deleteUnusedMessage', { name: tag.name }),
    acceptLabel: t('transactions.tagManager.confirmDelete'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      remove.mutate(tag.id, {
        onSuccess: () => {
          if (neighbour) focusRename(neighbour.id)
          else focusClose()
          notify.success(t('transactions.tagManager.toast.deleted'))
        },
        onError: (error) => {
          notify.error(error)
          if (isMissing(error)) refresh()
        },
      }),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('transactions.tagManager.title')"
    class="w-[calc(100vw-2rem)] max-w-[30rem]"
    :pt="{ content: { class: 'pb-2' } }"
  >
    <div ref="root" class="max-h-[60vh] overflow-y-auto">
      <div v-if="isPending" class="flex flex-col gap-2" aria-hidden="true">
        <Skeleton v-for="index in 5" :key="index" height="2.75rem" border-radius="10px" />
      </div>
      <ErrorState v-else-if="isError" @retry="refetch" />
      <EmptyState v-else-if="tags.length === 0" :title="t('transactions.tagManager.empty')" />
      <template v-else>
        <ul :aria-label="t('transactions.tags.label')" class="m-0 flex list-none flex-col p-0">
          <TagManagerRow
            v-for="tag in tags"
            :key="tag.id"
            :tag="tag"
            :taken-names="takenNames(tag)"
            @remove="confirmDelete"
            @missing="refresh"
          />
        </ul>
        <Button
          v-if="hasNextPage"
          :label="t('transactions.actions.showMore')"
          severity="secondary"
          outlined
          class="mt-3 min-h-11"
          :loading="isFetchingNextPage"
          @click="fetchNextPage"
        />
      </template>
    </div>
  </Dialog>
</template>
