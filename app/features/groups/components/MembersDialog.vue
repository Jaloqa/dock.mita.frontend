<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import { GROUP_MEMBERS_MAX, type GroupDto, type GroupMemberDto } from '~/shared/api/contract'
import { type MemberNameForm, memberNameRules } from '../schemas/memberSchema'

const props = defineProps<{ group: GroupDto }>()
const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const notify = useNotify()
const { addMember, renameMember, removeMember, refresh, isMissing } = useGroupMutations()
const addServer = useServerErrors()
const renameServer = useServerErrors()
const removeServer = useServerErrors()

const NEW_MEMBER_ID = 'group-new-member'

const root = ref<HTMLElement | null>(null)
const editingId = ref<string>()
const removingId = ref<string>()
const renameForm = reactive<MemberNameForm>({ name: '' })
const addForm = reactive<MemberNameForm>({ name: '' })

const namesExcept = (id?: string) =>
  props.group.members.filter((member) => member.id !== id).map((member) => member.name)

const renameV$ = useVuelidate(
  memberNameRules(t, () => namesExcept(editingId.value)),
  renameForm,
)
const addV$ = useVuelidate(
  memberNameRules(t, () => namesExcept()),
  addForm,
)

const isFull = computed(() => props.group.members.length >= GROUP_MEMBERS_MAX)
const renameErrors = computed(() => [
  ...renameV$.value.name.$errors.map((error) => String(unref(error.$message))),
  ...renameServer.messages('name'),
])
const addErrors = computed(() => [
  ...addV$.value.name.$errors.map((error) => String(unref(error.$message))),
  ...addServer.messages('name'),
])
const removeErrors = computed(() => removeServer.messages('memberId'))

const renameId = (id: string) => `group-member-name-${id}`
const hintId = (id: string) => `group-member-hint-${id}`
const errorId = (id: string) => `group-member-error-${id}`
const showsRemoveError = (member: GroupMemberDto) => removingId.value === member.id && removeErrors.value.length > 0
const removeDescribedBy = (member: GroupMemberDto) =>
  [member.inUse ? hintId(member.id) : undefined, showsRemoveError(member) ? errorId(member.id) : undefined]
    .filter(Boolean)
    .join(' ') || undefined

const find = <T extends HTMLElement>(selector: string) => root.value?.querySelector<T>(selector)

function reset() {
  editingId.value = undefined
  removingId.value = undefined
  renameForm.name = ''
  addForm.name = ''
  for (const server of [addServer, renameServer, removeServer]) server.clear()
  renameV$.value.$reset()
  addV$.value.$reset()
}

watch(visible, (open) => {
  if (open) reset()
})

async function focusRename(id: string) {
  await nextTick()
  find(`[data-member-rename="${id}"]`)?.focus()
}

async function focusNewMember() {
  await nextTick()
  const field = find(`#${NEW_MEMBER_ID}`)
  if (field) field.focus()
  else root.value?.closest('[role="dialog"]')?.querySelector<HTMLElement>('.p-dialog-close-button')?.focus()
}

function fail(error: unknown) {
  notify.error(error)
  if (isMissing(error)) refresh()
}

async function startRename(member: GroupMemberDto) {
  renameForm.name = member.name
  for (const server of [addServer, renameServer, removeServer]) server.clear()
  renameV$.value.$reset()
  addV$.value.$reset()
  editingId.value = member.id
  await nextTick()
  find<HTMLInputElement>(`#${renameId(member.id)}`)?.focus()
}

async function stopRename() {
  const id = editingId.value
  editingId.value = undefined
  renameServer.clear()
  if (id) await focusRename(id)
}

const touchRename = () => {
  renameV$.value.name.$touch()
  renameServer.clear('name')
}

const touchAdd = () => {
  addV$.value.name.$touch()
  addServer.clear('name')
}

async function showRenameErrors(error: unknown) {
  if (!renameServer.apply(error, ['name'])) {
    fail(error)
    return
  }
  await nextTick()
  focusFirstInvalid(find('form[data-member-form]'))
}

async function showAddErrors(error: unknown) {
  if (!addServer.apply(error, ['name'])) {
    fail(error)
    return
  }
  await nextTick()
  focusFirstInvalid(find('form[data-new-member-form]'))
}

async function submitRename() {
  const memberId = editingId.value
  if (!memberId) return
  renameServer.clear()
  if (!(await renameV$.value.$validate())) {
    await nextTick()
    focusFirstInvalid(find('form[data-member-form]'))
    return
  }
  renameMember.mutate(
    { id: props.group.id, memberId, input: { name: renameForm.name.trim() } },
    {
      onSuccess: () => {
        notify.success(t('groups.members.toast.renamed'))
        if (editingId.value === memberId) stopRename()
      },
      onError: (error) => {
        if (editingId.value === memberId) showRenameErrors(error)
        else fail(error)
      },
    },
  )
}

async function submitAdd() {
  addServer.clear()
  if (!(await addV$.value.$validate())) {
    await nextTick()
    focusFirstInvalid(find('form[data-new-member-form]'))
    return
  }
  addMember.mutate(
    { id: props.group.id, input: { name: addForm.name.trim() } },
    {
      onSuccess: () => {
        notify.success(t('groups.members.toast.added'))
        addForm.name = ''
        addV$.value.$reset()
        focusNewMember()
      },
      onError: showAddErrors,
    },
  )
}

function remove(member: GroupMemberDto) {
  if (removeMember.isPending.value) return
  const index = props.group.members.findIndex((item) => item.id === member.id)
  const neighbour = props.group.members[index + 1] ?? props.group.members[index - 1]
  removeServer.clear()
  removingId.value = member.id
  removeMember.mutate(
    { id: props.group.id, memberId: member.id },
    {
      onSuccess: () => {
        removingId.value = undefined
        notify.success(t('groups.members.toast.removed'))
        if (neighbour) focusRename(neighbour.id)
        else focusNewMember()
      },
      onError: async (error) => {
        if (!removeServer.apply(error, ['memberId'])) {
          fail(error)
          return
        }
        await refresh()
        focusRename(member.id)
      },
    },
  )
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('groups.members.title')"
    class="w-[calc(100vw-2rem)] max-w-[30rem]"
  >
    <div ref="root" class="flex flex-col gap-4">
      <ul
        v-if="group.members.length > 0"
        :aria-label="t('groups.members.list')"
        class="m-0 flex max-h-[50vh] list-none flex-col overflow-y-auto p-0"
      >
        <li
          v-for="member in group.members"
          :key="member.id"
          class="flex min-h-12 flex-col justify-center gap-1 border-b border-border py-1 last:border-b-0"
        >
          <form
            v-if="editingId === member.id"
            data-member-form
            :aria-label="t('groups.members.rename', { name: member.name })"
            class="flex w-full flex-col gap-3 rounded-(--radius-control) border border-border bg-bg p-3"
            novalidate
            @submit.prevent="submitRename"
            @keydown.esc.stop.prevent="stopRename"
          >
            <FormRow
              :id="renameId(member.id)"
              :label="t('groups.members.renameField', { name: member.name })"
              :errors="renameErrors"
            >
              <template #default="{ invalid, describedBy }">
                <InputText
                  :id="renameId(member.id)"
                  v-model="renameForm.name"
                  autocomplete="off"
                  :invalid="invalid"
                  :aria-invalid="invalid || undefined"
                  :aria-describedby="describedBy"
                  fluid
                  @blur="touchRename"
                />
              </template>
            </FormRow>
            <div class="flex justify-end gap-2">
              <Button
                :label="t('shared.actions.cancel')"
                severity="secondary"
                outlined
                class="min-h-11"
                @click="stopRename"
              />
              <Button
                type="submit"
                :label="t('shared.actions.save')"
                class="min-h-11"
                :loading="renameMember.isPending.value"
                :disabled="renameMember.isPending.value"
              />
            </div>
          </form>
          <template v-else>
            <div class="flex items-center gap-3">
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="text-sm font-medium break-words">{{ member.name }}</span>
                <span v-if="member.inUse" :id="hintId(member.id)" class="text-xs text-muted">
                  {{ t('groups.members.inUse') }}
                </span>
              </div>
              <div class="-mr-2 flex shrink-0">
                <Button
                  severity="secondary"
                  text
                  class="size-11"
                  :data-member-rename="member.id"
                  :aria-label="t('groups.members.rename', { name: member.name })"
                  @click="startRename(member)"
                >
                  <AppIcon name="edit" />
                </Button>
                <Button
                  severity="secondary"
                  text
                  class="size-11"
                  :disabled="member.inUse"
                  :aria-label="t('groups.members.remove', { name: member.name })"
                  :aria-describedby="removeDescribedBy(member)"
                  @click="remove(member)"
                >
                  <AppIcon name="trash" />
                </Button>
              </div>
            </div>
            <p
              v-if="showsRemoveError(member)"
              :id="errorId(member.id)"
              role="alert"
              class="m-0 text-xs font-medium text-accent"
            >
              {{ removeErrors[0] }}
            </p>
          </template>
        </li>
      </ul>
      <p v-else class="m-0 text-sm text-muted">{{ t('groups.members.empty') }}</p>
      <form v-if="!isFull" data-new-member-form novalidate @submit.prevent="submitAdd">
        <FormRow :id="NEW_MEMBER_ID" :label="t('groups.members.newMember')" :errors="addErrors">
          <template #default="{ invalid, describedBy }">
            <div class="flex items-start gap-2">
              <InputText
                :id="NEW_MEMBER_ID"
                v-model="addForm.name"
                autocomplete="off"
                :invalid="invalid"
                :aria-invalid="invalid || undefined"
                :aria-describedby="describedBy"
                class="min-h-11 min-w-0 flex-1"
                fluid
                @blur="touchAdd"
              />
              <Button
                type="submit"
                :label="t('groups.members.add')"
                class="min-h-11 shrink-0"
                :loading="addMember.isPending.value"
                :disabled="addMember.isPending.value"
              />
            </div>
          </template>
        </FormRow>
      </form>
      <p v-else class="m-0 text-xs text-muted">{{ t('validation.tooManyMembers') }}</p>
    </div>
  </Dialog>
</template>
