<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { GroupDto, GroupMemberDto } from '~/shared/api/contract'
import { type InviteForm, inviteRules } from '../schemas/inviteSchema'

const props = defineProps<{ group: GroupDto; member: GroupMemberDto }>()
const { t } = useI18n()
const notify = useNotify()
const confirm = useConfirm()
const { linkMe, unlinkMember, invite, cancelInvite, refresh, isMissing } = useGroupMutations()
const server = useServerErrors()

const root = ref<HTMLElement | null>(null)
const inviting = ref(false)
const form = reactive<InviteForm>({ email: '' })
const v$ = useVuelidate(inviteRules(t), form, { $stopPropagation: true })

const emailId = computed(() => `group-member-email-${props.member.id}`)
const panelId = computed(() => `group-member-invite-${props.member.id}`)

const isMe = computed(() => props.member.id === props.group.myMemberId)
const status = computed(() => {
  if (isMe.value) return t('groups.members.account.you')
  if (props.member.linkedName) return t('groups.members.account.linkedTo', { name: props.member.linkedName })
  if (props.member.invitedEmail) return t('groups.members.account.invited', { email: props.member.invitedEmail })
  return undefined
})
const canLinkMe = computed(() => props.group.myMemberId === null && !props.member.linked)
const canInvite = computed(() => !props.member.linked)
const showsInviteForm = computed(() => inviting.value && canInvite.value)
const busy = computed(
  () =>
    linkMe.isPending.value || unlinkMember.isPending.value || invite.isPending.value || cancelInvite.isPending.value,
)
const emailErrors = computed(() => [
  ...v$.value.email.$errors.map((error) => String(unref(error.$message))),
  ...server.messages('email'),
])
const accountError = computed(() => server.messages('memberId')[0])

const find = <T extends HTMLElement>(selector: string) => root.value?.querySelector<T>(selector)

async function focusFirstAction() {
  await nextTick()
  find('button')?.focus()
}

function resetInvite() {
  form.email = ''
  server.clear()
  v$.value.$reset()
}

watch(canInvite, (can) => {
  if (can) return
  inviting.value = false
  form.email = ''
  server.clear('email')
  v$.value.$reset()
})

async function openInvite() {
  resetInvite()
  inviting.value = true
  await nextTick()
  find<HTMLInputElement>(`#${emailId.value}`)?.focus()
}

async function closeInvite() {
  inviting.value = false
  resetInvite()
  await nextTick()
  find('[data-invite-toggle]')?.focus()
}

const toggleInvite = () => (inviting.value ? closeInvite() : openInvite())

const touchEmail = () => {
  v$.value.email.$touch()
  server.clear('email')
}

function begin(): boolean {
  if (busy.value) return false
  server.clear()
  return true
}

function fail(error: unknown) {
  notify.error(error)
  if (isMissing(error)) refresh()
}

async function showAccountError(error: unknown) {
  if (!server.apply(error, ['memberId'])) {
    fail(error)
    return
  }
  await refresh()
  await focusFirstAction()
}

function link() {
  if (!begin()) return
  linkMe.mutate(
    { id: props.group.id, memberId: props.member.id },
    {
      onSuccess: () => {
        notify.success(t('groups.members.toast.linked'))
        focusFirstAction()
      },
      onError: showAccountError,
    },
  )
}

function unlink() {
  if (!begin()) return
  unlinkMember.mutate(
    { id: props.group.id, memberId: props.member.id },
    {
      onSuccess: () => {
        notify.success(t('groups.members.toast.unlinked'))
        focusFirstAction()
      },
      onError: fail,
    },
  )
}

function confirmUnlink() {
  confirm.require({
    header: t(isMe.value ? 'groups.members.account.unlinkSelfTitle' : 'groups.members.account.unlinkTitle', {
      name: props.member.name,
    }),
    message: t(isMe.value ? 'groups.members.account.unlinkSelfMessage' : 'groups.members.account.unlinkMessage'),
    acceptLabel: t('groups.members.account.unlink'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: unlink,
  })
}

function cancelInvitation() {
  if (!begin()) return
  cancelInvite.mutate(
    { id: props.group.id, memberId: props.member.id },
    {
      onSuccess: () => {
        notify.success(t('groups.members.toast.inviteCancelled'))
        focusFirstAction()
      },
      onError: fail,
    },
  )
}

async function showInviteErrors(error: unknown) {
  if (!server.apply(error, ['email', 'memberId'])) {
    fail(error)
    return
  }
  if (server.messages('memberId').length > 0) {
    await refresh()
    await focusFirstAction()
    return
  }
  await nextTick()
  focusFirstInvalid(find('form'))
}

async function submit() {
  if (busy.value) return
  server.clear()
  if (!(await v$.value.$validate())) {
    await nextTick()
    focusFirstInvalid(find('form'))
    return
  }
  invite.mutate(
    { id: props.group.id, memberId: props.member.id, input: { email: form.email.trim() } },
    {
      onSuccess: () => {
        notify.success(t('groups.members.toast.invited'))
        closeInvite()
      },
      onError: showInviteErrors,
    },
  )
}
</script>

<template>
  <div ref="root" class="flex flex-col gap-1">
    <p v-if="status" class="m-0 text-xs text-muted">{{ status }}</p>
    <div class="-ml-3 flex flex-wrap items-center">
      <Button
        v-if="canLinkMe"
        type="button"
        severity="secondary"
        text
        size="small"
        class="min-h-11"
        :label="t('groups.members.account.thisIsMe')"
        :aria-label="t('groups.members.account.thisIsMeFor', { name: member.name })"
        @click="link"
      />
      <Button
        v-if="canInvite"
        type="button"
        severity="secondary"
        text
        size="small"
        class="min-h-11"
        data-invite-toggle
        :label="t('groups.members.account.invite')"
        :aria-label="t('groups.members.account.inviteFor', { name: member.name })"
        :aria-expanded="showsInviteForm"
        :aria-controls="showsInviteForm ? panelId : undefined"
        @click="toggleInvite"
      />
      <Button
        v-if="member.invitedEmail !== null"
        type="button"
        severity="secondary"
        text
        size="small"
        class="min-h-11"
        :label="t('groups.members.account.cancelInvite')"
        :aria-label="t('groups.members.account.cancelInviteFor', { name: member.name })"
        @click="cancelInvitation"
      />
      <Button
        v-if="member.linked"
        type="button"
        severity="danger"
        text
        size="small"
        class="min-h-11"
        :label="t('groups.members.account.unlink')"
        :aria-label="t('groups.members.account.unlinkFor', { name: member.name })"
        @click="confirmUnlink"
      />
    </div>
    <form
      v-if="showsInviteForm"
      :id="panelId"
      novalidate
      class="flex flex-col gap-3 rounded-(--radius-control) border border-border bg-bg p-3"
      @submit.prevent="submit"
      @keydown.esc.stop.prevent="closeInvite"
    >
      <FormRow
        :id="emailId"
        :label="t('groups.members.account.emailField', { name: member.name })"
        :errors="emailErrors"
      >
        <template #default="{ invalid, describedBy }">
          <InputText
            :id="emailId"
            v-model="form.email"
            type="email"
            autocomplete="off"
            :invalid="invalid"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            class="min-h-11"
            fluid
            @blur="touchEmail"
          />
        </template>
      </FormRow>
      <div class="flex justify-end gap-2">
        <Button
          type="button"
          :label="t('shared.actions.cancel')"
          severity="secondary"
          outlined
          class="min-h-11"
          @click="closeInvite"
        />
        <Button
          type="submit"
          :label="t('groups.members.account.send')"
          class="min-h-11"
          :loading="invite.isPending.value"
          :disabled="invite.isPending.value"
        />
      </div>
    </form>
    <p v-if="accountError" role="alert" class="m-0 text-xs font-medium text-accent">{{ accountError }}</p>
  </div>
</template>
