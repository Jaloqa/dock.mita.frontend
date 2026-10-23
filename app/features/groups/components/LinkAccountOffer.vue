<script setup lang="ts">
import type { GroupDto, GroupMemberDto } from '~/shared/api/contract'
import { useSession } from '~/shared/auth/useSession'
import { unlessMemberRefusal } from '../utils/scope'

const props = defineProps<{ group: GroupDto; member: GroupMemberDto }>()
const { t } = useI18n()
const notify = useNotify()
const { status } = useSession()
const scope = useGroupScope()
const { linkThroughShare, isMissing, refresh } = useGroupMutations()
const server = useServerErrors()

const TEXT_ID = 'link-offer-text'

const outcome = ref<HTMLElement | null>(null)
const done = ref(false)

const busy = computed(() => linkThroughShare.isPending.value)
const offered = computed(() => status.value === 'authenticated' && !props.member.linked)
const message = computed(() => server.messages('memberId')[0])
const shown = computed(() => done.value || busy.value || offered.value || message.value !== undefined)
const groupPath = computed(() => `/tools/groups/${encodeURIComponent(props.group.id)}`)

async function focusOutcome() {
  await nextTick()
  outcome.value?.focus()
}

async function showError(error: unknown) {
  if (!server.apply(error, ['memberId'])) {
    notify.error(error)
    if (isMissing(error)) refresh()
    return
  }
  await refresh()
  await focusOutcome()
}

function link() {
  const current = scope.value
  if (current.kind !== 'link' || busy.value) return
  server.clear()
  linkThroughShare.mutate(
    { token: current.token, memberId: props.member.id },
    {
      onSuccess: () => {
        done.value = true
        focusOutcome()
      },
      onError: unlessMemberRefusal(showError),
    },
  )
}
</script>

<template>
  <div v-if="shown" class="flex flex-col gap-2 rounded-(--radius-card) bg-surface p-4">
    <div v-if="done" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <p ref="outcome" tabindex="-1" class="m-0 min-w-0 text-sm font-medium break-words outline-none">
        {{ t('groups.link.offer.done', { name: member.name }) }}
      </p>
      <NuxtLinkLocale
        :to="groupPath"
        class="inline-flex min-h-11 items-center text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {{ t('groups.link.offer.open') }}
      </NuxtLinkLocale>
    </div>
    <template v-else>
      <div v-if="offered || busy" class="flex flex-wrap items-center justify-between gap-3">
        <p :id="TEXT_ID" class="m-0 min-w-0 flex-1 basis-60 text-sm break-words">
          {{ t('groups.link.offer.text', { name: member.name }) }}
        </p>
        <Button
          type="button"
          :label="t('groups.link.offer.action')"
          :aria-describedby="TEXT_ID"
          :loading="busy"
          :disabled="busy"
          class="min-h-11 shrink-0"
          @click="link"
        />
      </div>
      <p
        v-if="message"
        ref="outcome"
        role="alert"
        tabindex="-1"
        class="m-0 text-sm font-medium text-accent outline-none"
      >
        {{ message }}
      </p>
    </template>
  </div>
</template>
