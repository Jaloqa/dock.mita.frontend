<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import { useAccounts } from '~/shared/accounts/useAccounts'
import type { GoalDto, GoalInput } from '~/shared/api/contract'
import { type Currency, fromMinor, toMinor } from '~/shared/money/money'
import { todayIso } from '~/shared/period/period'
import { GOAL_DEADLINE_MAX_MONTHS, GOAL_TARGET_MAX, type GoalForm, goalRules } from '../schemas/goalSchema'
import { dateOfMonthKey, linkableAccounts, monthKeyOfDate } from '../utils/goalView'

const props = defineProps<{ goal?: GoalDto; currency: Currency }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ deleted: [] }>()
const { t, locale } = useI18n()
const notify = useNotify()
const confirm = useConfirm()
const server = useServerErrors()
const accounts = useAccounts()
const { create, update, remove } = useGoalMutations()

const fields = ['name', 'target', 'deadline', 'accountId'] as const
type Field = (typeof fields)[number]

const currentMonth = () => todayIso().slice(0, 7)
const form = reactive<GoalForm>({ name: '', target: null, deadline: null, accountId: null })
const v$ = useVuelidate(
  goalRules(t, { minMonth: currentMonth, originalDeadline: () => props.goal?.deadline ?? null }),
  form,
)
const formEl = ref<HTMLFormElement | null>(null)
const deleted = ref(false)

const isEdit = computed(() => props.goal !== undefined)
const saving = computed(() => create.isPending.value || update.isPending.value || remove.isPending.value)
const minDate = computed(() => dateOfMonthKey(currentMonth()))
const maxDate = computed(
  () => new Date(minDate.value.getFullYear(), minDate.value.getMonth() + GOAL_DEADLINE_MAX_MONTHS, 1),
)
const accountOptions = computed(() =>
  linkableAccounts(accounts.accounts.value, props.goal?.accountId ?? null).map((account) => ({
    value: account.id,
    label: `${account.name} · ${account.currency}`,
  })),
)

function reset() {
  const goal = props.goal
  Object.assign(
    form,
    goal
      ? {
          name: goal.name,
          target: fromMinor(goal.target),
          deadline: goal.deadline ? dateOfMonthKey(goal.deadline) : null,
          accountId: goal.accountId,
        }
      : { name: '', target: null, deadline: null, accountId: null },
  )
  deleted.value = false
  server.clear()
  v$.value.$reset()
}

function onAfterHide() {
  if (!deleted.value) return
  deleted.value = false
  emit('deleted')
}

watch(visible, (open) => {
  if (open) reset()
})

const errorsOf = (field: Field) => [
  ...v$.value[field].$errors.map((error) => String(unref(error.$message))),
  ...server.messages(field),
]

function touch(field: Field) {
  v$.value[field].$touch()
  server.clear(field)
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
  const input: GoalInput = {
    name: form.name.trim(),
    target: toMinor(form.target ?? 0),
    deadline: form.deadline ? monthKeyOfDate(form.deadline) : null,
    accountId: form.accountId,
  }
  const goal = props.goal
  if (goal) {
    update.mutate(
      { id: goal.id, input },
      { onSuccess: () => close(t('goals.toast.updated')), onError: showServerErrors },
    )
  } else {
    create.mutate(input, { onSuccess: () => close(t('goals.toast.created')), onError: showServerErrors })
  }
}

function confirmDelete() {
  const goal = props.goal
  if (!goal) return
  confirm.require({
    header: t('goals.confirm.deleteTitle'),
    message: t('goals.confirm.deleteMessage', { name: goal.name }),
    acceptLabel: t('goals.actions.delete'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      remove.mutate(goal.id, {
        onSuccess: () => {
          deleted.value = true
          close(t('goals.toast.deleted'))
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
    :header="isEdit ? t('goals.dialog.editTitle') : t('goals.dialog.createTitle')"
    class="w-[calc(100vw-2rem)] max-w-[30rem]"
    @after-hide="onAfterHide"
  >
    <form id="goal-form" ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormRow id="goal-name" :label="t('goals.dialog.name')" :errors="errorsOf('name')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="goal-name"
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
      <FormRow id="goal-target" :label="t('goals.dialog.target')" :errors="errorsOf('target')">
        <template #default="{ invalid, describedBy }">
          <InputNumber
            v-model="form.target"
            input-id="goal-target"
            mode="currency"
            :currency="currency"
            :locale="locale"
            :min-fraction-digits="2"
            :max-fraction-digits="2"
            :max="GOAL_TARGET_MAX"
            :invalid="invalid"
            :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
            fluid
            @blur="touch('target')"
          />
        </template>
      </FormRow>
      <FormRow
        id="goal-deadline"
        :label="t('goals.dialog.deadline')"
        :errors="errorsOf('deadline')"
        :hint="t('goals.dialog.deadlineHint')"
      >
        <template #default="{ invalid, describedBy }">
          <DatePicker
            v-model="form.deadline"
            input-id="goal-deadline"
            view="month"
            :date-format="t('shared.monthInputFormat')"
            :min-date="minDate"
            :max-date="maxDate"
            :invalid="invalid"
            :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
            show-clear
            show-icon
            fluid
            @blur="touch('deadline')"
          />
        </template>
      </FormRow>
      <FormRow
        id="goal-account"
        :label="t('goals.dialog.account')"
        :errors="errorsOf('accountId')"
        :hint="t('goals.dialog.accountHint')"
      >
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.accountId"
            input-id="goal-account"
            :options="accountOptions"
            option-label="label"
            option-value="value"
            :placeholder="t('goals.dialog.accountPlaceholder')"
            :loading="accounts.isPending.value"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            show-clear
            fluid
            @change="touch('accountId')"
          />
        </template>
      </FormRow>
    </form>
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <div>
          <Button
            v-if="goal"
            :label="t('goals.actions.delete')"
            severity="danger"
            text
            :disabled="saving"
            @click="confirmDelete"
          />
        </div>
        <div class="flex gap-2">
          <Button :label="t('shared.actions.cancel')" severity="secondary" outlined @click="visible = false" />
          <Button
            type="submit"
            form="goal-form"
            :label="t('shared.actions.save')"
            :loading="saving"
            :disabled="saving"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>
