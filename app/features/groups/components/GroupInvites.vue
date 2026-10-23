<script setup lang="ts">
import type { GroupInviteDto } from '~/shared/api/contract'
import { isApiError } from '~/shared/api/problem'

const emit = defineEmits<{ cleared: [] }>()
const { t } = useI18n()
const notify = useNotify()
const { items, isError, refetch } = useGroupInvites()
const { acceptInvite, declineInvite, refresh } = useGroupMutations()

const TITLE_ID = 'group-invites-title'

const root = ref<HTMLElement | null>(null)

const shown = computed(() => items.value.length > 0 || isError.value)
const busy = computed(() => acceptInvite.isPending.value || declineInvite.isPending.value)

const isStale = (error: unknown) => isApiError(error) && (error.status === 400 || error.status === 404)

async function focusAfter(neighbourId: string | undefined) {
  await nextTick()
  const next = neighbourId ? root.value?.querySelector<HTMLElement>(`[data-accept="${neighbourId}"]`) : null
  const target = next ?? root.value?.querySelector<HTMLElement>('[data-accept]')
  if (target) target.focus()
  else emit('cleared')
}

function answering(invite: GroupInviteDto, message: string) {
  const index = items.value.findIndex((item) => item.memberId === invite.memberId)
  const neighbourId = (items.value[index + 1] ?? items.value[index - 1])?.memberId
  return {
    onSuccess: () => {
      notify.success(message)
      focusAfter(neighbourId)
    },
    onError: async (error: unknown) => {
      notify.error(error)
      if (!isStale(error)) return
      await refresh()
      await focusAfter(neighbourId)
    },
  }
}

function accept(invite: GroupInviteDto) {
  if (busy.value) return
  acceptInvite.mutate(invite.memberId, answering(invite, t('groups.invites.toast.joined', { group: invite.groupName })))
}

function decline(invite: GroupInviteDto) {
  if (busy.value) return
  declineInvite.mutate(invite.memberId, answering(invite, t('groups.invites.toast.declined')))
}
</script>

<template>
  <section v-if="shown" ref="root" :aria-labelledby="TITLE_ID" class="flex flex-col gap-3">
    <h2 :id="TITLE_ID" class="m-0 text-base font-semibold">{{ t('groups.invites.title') }}</h2>
    <ul v-if="items.length > 0" class="m-0 flex list-none flex-col gap-3 p-0">
      <li
        v-for="invite in items"
        :key="invite.memberId"
        class="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-card) bg-surface p-4"
      >
        <p class="m-0 min-w-0 flex-1 basis-60 text-sm break-words">
          {{
            t('groups.invites.text', { owner: invite.ownerName, group: invite.groupName, member: invite.memberName })
          }}
        </p>
        <div class="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            :label="t('groups.invites.accept')"
            :aria-label="t('groups.invites.acceptFor', { group: invite.groupName })"
            :data-accept="invite.memberId"
            class="min-h-11"
            @click="accept(invite)"
          />
          <Button
            type="button"
            :label="t('groups.invites.decline')"
            :aria-label="t('groups.invites.declineFor', { group: invite.groupName })"
            severity="secondary"
            outlined
            class="min-h-11"
            @click="decline(invite)"
          />
        </div>
      </li>
    </ul>
    <div v-else class="rounded-(--radius-card) bg-surface px-4">
      <ErrorState compact @retry="refetch" />
    </div>
  </section>
</template>
