<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import { GROUP_MEMBERS_MAX, type GroupDto } from '~/shared/api/contract'
import { useCurrentUser } from '~/shared/user/useCurrentUser'
import { useUserSettings } from '~/shared/user/useUserSettings'
import { faultyMemberRows, type GroupForm, groupRules } from '../schemas/groupSchema'

const props = defineProps<{ group?: GroupDto }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ created: [group: GroupDto]; deleted: [] }>()
const { t } = useI18n()
const notify = useNotify()
const confirm = useConfirm()
const server = useServerErrors()
const { user } = useCurrentUser()
const { baseCurrency } = useUserSettings()
const { create, update, remove } = useGroupMutations()

const fields = ['name', 'currency', 'members'] as const
type Field = (typeof fields)[number]

const CURRENCY_HINT_ID = 'group-currency-locked'
const MEMBERS_ERROR_ID = 'group-members-error'

const emptyForm = (): GroupForm => ({ name: '', currency: baseCurrency.value, members: [user.value?.name ?? ''] })

const form = reactive<GroupForm>(emptyForm())
const formEl = ref<HTMLFormElement | null>(null)
const rowKeys = ref<number[]>([])
const deleted = ref(false)
const createdGroup = ref<GroupDto>()
let lastRowKey = 0

const isEdit = computed(() => props.group !== undefined)
const saving = computed(() => create.isPending.value || update.isPending.value || remove.isPending.value)
const currencyLocked = computed(() => props.group?.currencyLocked ?? false)
const pinnedCurrencies = computed(() => [baseCurrency.value])

const v$ = useVuelidate(groupRules(t, { creating: () => !isEdit.value }), form)

const errorsOf = (field: Field) => [
  ...v$.value[field].$errors.map((error) => String(unref(error.$message))),
  ...server.messages(field),
]

const memberErrors = computed(() => errorsOf('members'))
const invalidRows = computed(() => {
  if (memberErrors.value.length === 0) return new Set<number>()
  const faulty = faultyMemberRows(form.members)
  return faulty.size > 0 ? faulty : new Set([0])
})

const newRowKey = () => {
  lastRowKey += 1
  return lastRowKey
}

function reset() {
  const group = props.group
  Object.assign(form, group ? { name: group.name, currency: group.currency, members: [] } : emptyForm())
  rowKeys.value = form.members.map(newRowKey)
  deleted.value = false
  createdGroup.value = undefined
  server.clear()
  v$.value.$reset()
}

watch(visible, (open) => {
  if (open) reset()
})

function onAfterHide() {
  const group = createdGroup.value
  createdGroup.value = undefined
  if (deleted.value) {
    deleted.value = false
    emit('deleted')
  } else if (group) emit('created', group)
}

function touch(field: Field) {
  v$.value[field].$touch()
  server.clear(field)
}

const currencyDescribedBy = (describedBy: string | undefined) =>
  [describedBy, currencyLocked.value ? CURRENCY_HINT_ID : undefined].filter(Boolean).join(' ') || undefined

const memberInput = (index: number) => formEl.value?.querySelector<HTMLInputElement>(`#group-member-${index}`)

async function addMember() {
  form.members.push('')
  rowKeys.value.push(newRowKey())
  await nextTick()
  memberInput(form.members.length - 1)?.focus()
}

async function removeMember(index: number) {
  form.members.splice(index, 1)
  rowKeys.value.splice(index, 1)
  server.clear('members')
  await nextTick()
  memberInput(Math.min(index, form.members.length - 1))?.focus()
}

const close = (message: string) => {
  notify.success(message)
  visible.value = false
}

async function showServerErrors(error: unknown) {
  if (server.apply(error, fields)) {
    await nextTick()
    focusFirstInvalid(formEl.value)
  } else notify.error(error)
}

async function submit() {
  server.clear()
  if (!(await v$.value.$validate())) {
    await nextTick()
    focusFirstInvalid(formEl.value)
    return
  }
  const name = form.name.trim()
  const group = props.group
  if (group) {
    update.mutate(
      { id: group.id, input: { name, currency: form.currency } },
      { onSuccess: () => close(t('groups.toast.updated')), onError: showServerErrors },
    )
  } else {
    const members = form.members.map((member) => member.trim()).filter((member) => member !== '')
    create.mutate(
      { name, currency: form.currency, members },
      {
        onSuccess: (created) => {
          createdGroup.value = created
          close(t('groups.toast.created'))
        },
        onError: showServerErrors,
      },
    )
  }
}

function confirmDelete() {
  const group = props.group
  if (!group) return
  confirm.require({
    header: t('groups.confirm.deleteTitle'),
    message: t('groups.confirm.deleteMessage', { name: group.name }),
    acceptLabel: t('groups.actions.delete'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      remove.mutate(group.id, {
        onSuccess: () => {
          deleted.value = true
          close(t('groups.toast.deleted'))
        },
        onError: (error) => notify.error(error),
      }),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="isEdit ? t('groups.dialog.editTitle') : t('groups.dialog.createTitle')"
    class="w-[calc(100vw-2rem)] max-w-[32rem]"
    @after-hide="onAfterHide"
  >
    <form id="group-form" ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormRow id="group-name" :label="t('groups.dialog.name')" :errors="errorsOf('name')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="group-name"
            v-model="form.name"
            autocomplete="off"
            :invalid="invalid"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            fluid
            @blur="touch('name')"
          />
        </template>
      </FormRow>
      <div class="flex flex-col gap-1.5">
        <FormRow
          id="group-currency"
          :label="t('groups.dialog.currency')"
          :errors="errorsOf('currency')"
          :hint="t('groups.dialog.currencyHint')"
        >
          <template #default="{ invalid, describedBy, labelId }">
            <CurrencySelect
              v-model="form.currency"
              input-id="group-currency"
              :pinned="pinnedCurrencies"
              :disabled="currencyLocked"
              :invalid="invalid"
              :label-id="labelId"
              :described-by="currencyDescribedBy(describedBy)"
              @change="touch('currency')"
            />
          </template>
        </FormRow>
        <p v-if="currencyLocked" :id="CURRENCY_HINT_ID" class="m-0 text-xs text-muted">
          {{ t('groups.dialog.currencyLocked') }}
        </p>
      </div>
      <fieldset v-if="!isEdit" class="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend class="mb-1.5 p-0 text-[13px] font-medium text-muted">{{ t('groups.dialog.members') }}</legend>
        <div v-for="(key, index) in rowKeys" :key="key" class="flex items-center gap-2">
          <InputText
            :id="`group-member-${index}`"
            v-model="form.members[index]"
            autocomplete="off"
            :aria-label="t('groups.dialog.member', { number: index + 1 })"
            :invalid="invalidRows.has(index)"
            :aria-invalid="invalidRows.has(index) || undefined"
            :aria-describedby="invalidRows.has(index) ? MEMBERS_ERROR_ID : undefined"
            class="min-w-0 flex-1"
            fluid
            @blur="touch('members')"
          />
          <Button
            v-if="rowKeys.length > 1"
            severity="secondary"
            text
            class="size-11 shrink-0"
            :aria-label="t('groups.dialog.removeMember', { number: index + 1 })"
            @click="removeMember(index)"
          >
            <AppIcon name="close" :size="18" />
          </Button>
        </div>
        <p v-if="memberErrors.length > 0" :id="MEMBERS_ERROR_ID" class="m-0 text-xs font-medium text-accent">
          {{ memberErrors[0] }}
        </p>
        <Button
          v-if="rowKeys.length < GROUP_MEMBERS_MAX"
          severity="secondary"
          outlined
          class="min-h-11 self-start"
          @click="addMember"
        >
          <AppIcon name="plus" :size="16" :stroke-width="2.2" />
          {{ t('groups.dialog.addMember') }}
        </Button>
      </fieldset>
    </form>
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <div>
          <Button
            v-if="group"
            :label="t('groups.actions.delete')"
            severity="danger"
            text
            class="min-h-11"
            :disabled="saving"
            @click="confirmDelete"
          />
        </div>
        <div class="flex gap-2">
          <Button
            :label="t('shared.actions.cancel')"
            severity="secondary"
            outlined
            class="min-h-11"
            @click="visible = false"
          />
          <Button
            type="submit"
            form="group-form"
            :label="t('shared.actions.save')"
            class="min-h-11"
            :loading="saving"
            :disabled="saving"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>
