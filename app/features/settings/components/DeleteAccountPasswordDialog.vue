<script setup lang="ts">
import { isApiError } from '~/shared/api/problem'
import { useSession } from '~/shared/auth/useSession'

const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const notify = useNotify()
const server = useServerErrors()
const session = useSession()

const password = ref('')
const pending = ref(false)
const rateLimited = ref(false)
const formEl = ref<HTMLFormElement | null>(null)
const empty = computed(() => password.value === '')

watch(visible, (open) => {
  if (!open) return
  password.value = ''
  rateLimited.value = false
  server.clear()
})

watch(password, () => {
  rateLimited.value = false
  server.clear('password')
})

async function deleteAccount() {
  if (empty.value || pending.value) return
  pending.value = true
  rateLimited.value = false
  server.clear()
  try {
    await session.deleteAccount(password.value)
    visible.value = false
  } catch (error) {
    if (server.apply(error, ['password'])) {
      await nextTick()
      focusFirstInvalid(formEl.value)
    } else if (isApiError(error) && error.status === 429) rateLimited.value = true
    else notify.error(error)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('settings.delete.title')"
    class="w-[calc(100vw-2rem)] max-w-[30rem]"
  >
    <form id="delete-account-form" ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="deleteAccount">
      <p class="m-0 text-sm">{{ t('settings.delete.realDescription') }}</p>
      <p
        v-if="rateLimited"
        role="alert"
        class="m-0 rounded-(--radius-control) border border-accent/40 bg-accent/10 px-3.5 py-3 text-sm font-medium text-ink"
      >
        {{ t('auth.errors.tooManyAttempts') }}
      </p>
      <FormRow
        id="delete-account-password"
        :label="t('settings.delete.passwordLabel')"
        :errors="server.messages('password')"
      >
        <template #default="{ invalid, describedBy }">
          <PasswordField
            id="delete-account-password"
            v-model="password"
            autocomplete="current-password"
            :invalid="invalid"
            :described-by="describedBy"
          />
        </template>
      </FormRow>
    </form>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <Button :label="t('shared.actions.cancel')" severity="secondary" outlined @click="visible = false" />
        <Button
          type="submit"
          form="delete-account-form"
          severity="danger"
          :label="t('settings.delete.confirm')"
          :loading="pending"
          :disabled="empty || pending"
        />
      </div>
    </template>
  </Dialog>
</template>
