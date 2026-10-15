<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import { type AccountDto, type AccountInput, accountTypes } from '~/shared/api/contract'
import { currencies, fromMinor, toMinor } from '~/shared/money/money'
import { useUserSettings } from '~/shared/user/useUserSettings'
import { type AccountForm, accountRules } from '../schemas/accountSchema'

const props = defineProps<{ account?: AccountDto }>()
const visible = defineModel<boolean>('visible', { required: true })
const { t, locale } = useI18n()
const notify = useNotify()
const confirm = useConfirm()
const server = useServerErrors()
const { baseCurrency } = useUserSettings()
const { create, update, remove } = useAccountMutations()

const fields = ['name', 'type', 'currency', 'openingBalance', 'cardLast4'] as const
type Field = (typeof fields)[number]

const form = reactive<AccountForm>({ name: '', type: 'card', currency: 'PLN', openingBalance: null, cardLast4: '' })
const v$ = useVuelidate(accountRules(t, form), form)
const formEl = ref<HTMLFormElement | null>(null)

const isEdit = computed(() => props.account !== undefined)
const currencyLocked = computed(() => props.account?.inUse === true)
const saving = computed(() => create.isPending.value || update.isPending.value || remove.isPending.value)
const typeOptions = computed(() => accountTypes.map((type) => ({ value: type, label: t(`accounts.type.${type}`) })))

const toInput = (account: AccountDto): AccountInput => ({
  name: account.name,
  type: account.type,
  currency: account.currency,
  openingBalance: account.openingBalance,
  cardLast4: account.cardLast4,
  archived: account.archived,
})

function reset() {
  const account = props.account
  Object.assign(
    form,
    account
      ? {
          name: account.name,
          type: account.type,
          currency: account.currency,
          openingBalance: fromMinor(account.openingBalance),
          cardLast4: account.cardLast4 ?? '',
        }
      : { name: '', type: 'card', currency: baseCurrency.value, openingBalance: null, cardLast4: '' },
  )
  server.clear()
  v$.value.$reset()
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
  const input: AccountInput = {
    name: form.name.trim(),
    type: form.type,
    currency: form.currency,
    openingBalance: toMinor(form.openingBalance ?? 0),
    cardLast4: form.type === 'card' && form.cardLast4 !== '' ? form.cardLast4 : null,
    archived: props.account?.archived ?? false,
  }
  const account = props.account
  if (account) {
    update.mutate(
      { id: account.id, input },
      { onSuccess: () => close(t('accounts.toast.updated')), onError: showServerErrors },
    )
  } else {
    create.mutate(input, { onSuccess: () => close(t('accounts.toast.created')), onError: showServerErrors })
  }
}

function setArchived(archived: boolean) {
  const account = props.account
  if (!account) return
  update.mutate(
    { id: account.id, input: { ...toInput(account), archived } },
    {
      onSuccess: () => close(t(archived ? 'accounts.toast.archived' : 'accounts.toast.restored')),
      onError: (error) => notify.error(error),
    },
  )
}

function confirmArchive() {
  const account = props.account
  if (!account) return
  confirm.require({
    header: t('accounts.confirm.archiveTitle'),
    message: t('accounts.confirm.archiveMessage', { name: account.name }),
    acceptLabel: t('accounts.actions.archive'),
    rejectLabel: t('shared.actions.cancel'),
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () => setArchived(true),
  })
}

function confirmDelete() {
  const account = props.account
  if (!account) return
  confirm.require({
    header: t('accounts.confirm.deleteTitle'),
    message: t('accounts.confirm.deleteMessage', { name: account.name }),
    acceptLabel: t('accounts.actions.delete'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      remove.mutate(account.id, {
        onSuccess: () => close(t('accounts.toast.deleted')),
        onError: (error) => notify.error(error),
      }),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="isEdit ? t('accounts.dialog.editTitle') : t('accounts.dialog.createTitle')"
    class="w-[calc(100vw-2rem)] max-w-[30rem]"
  >
    <form id="account-form" ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormRow id="account-name" :label="t('accounts.dialog.name')" :errors="errorsOf('name')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="account-name"
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
      <FormRow id="account-type" :label="t('accounts.dialog.type')" :errors="errorsOf('type')">
        <template #default="{ labelId }">
          <SelectButton
            id="account-type"
            v-model="form.type"
            :options="typeOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            :aria-labelledby="labelId"
          />
        </template>
      </FormRow>
      <FormRow
        id="account-currency"
        :label="t('accounts.dialog.currency')"
        :errors="errorsOf('currency')"
        :hint="currencyLocked ? t('accounts.dialog.currencyLocked') : undefined"
      >
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.currency"
            input-id="account-currency"
            :options="[...currencies]"
            :disabled="currencyLocked"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            fluid
          />
        </template>
      </FormRow>
      <FormRow id="account-opening" :label="t('accounts.dialog.openingBalance')" :errors="errorsOf('openingBalance')">
        <template #default="{ invalid, describedBy }">
          <InputNumber
            v-model="form.openingBalance"
            input-id="account-opening"
            mode="currency"
            :currency="form.currency"
            :locale="locale"
            :min-fraction-digits="2"
            :max-fraction-digits="2"
            :invalid="invalid"
            :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
            fluid
            @blur="touch('openingBalance')"
          />
        </template>
      </FormRow>
      <FormRow
        v-if="form.type === 'card'"
        id="account-card"
        :label="t('accounts.dialog.cardLast4')"
        :errors="errorsOf('cardLast4')"
      >
        <template #default="{ invalid, describedBy }">
          <InputText
            id="account-card"
            v-model="form.cardLast4"
            inputmode="numeric"
            maxlength="4"
            autocomplete="off"
            :invalid="invalid"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            fluid
            @blur="touch('cardLast4')"
          />
        </template>
      </FormRow>
    </form>
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <div class="flex gap-2">
          <template v-if="account">
            <Button
              v-if="account.archived"
              :label="t('accounts.actions.restore')"
              severity="secondary"
              text
              :disabled="saving"
              @click="setArchived(false)"
            />
            <Button
              v-else-if="account.inUse"
              :label="t('accounts.actions.archive')"
              severity="secondary"
              text
              :disabled="saving"
              @click="confirmArchive"
            />
            <Button
              v-else
              :label="t('accounts.actions.delete')"
              severity="danger"
              text
              :disabled="saving"
              @click="confirmDelete"
            />
          </template>
        </div>
        <div class="flex gap-2">
          <Button :label="t('shared.actions.cancel')" severity="secondary" outlined @click="visible = false" />
          <Button
            type="submit"
            form="account-form"
            :label="t('shared.actions.save')"
            :loading="saving"
            :disabled="saving"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>
