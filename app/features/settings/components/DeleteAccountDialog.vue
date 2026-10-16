<script setup lang="ts">
import { useCurrentUser } from '~/shared/user/useCurrentUser'

const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const notify = useNotify()
const localePath = useLocalePath()
const { user } = useCurrentUser()
const { reset } = useDemoMutations()

const typed = ref('')
const email = computed(() => user.value?.email ?? '')
const matches = computed(() => email.value !== '' && typed.value.trim().toLowerCase() === email.value.toLowerCase())

watch(visible, (open) => {
  if (open) typed.value = ''
})

function deleteAccount() {
  if (!matches.value || reset.isPending.value) return
  reset.mutate(undefined, {
    onSuccess: async () => {
      visible.value = false
      notify.success(t('settings.delete.done'))
      await navigateTo(localePath('/'))
    },
    onError: (error) => notify.error(error),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('settings.delete.title')"
    class="w-[calc(100vw-2rem)] max-w-[30rem]"
  >
    <form id="delete-account-form" class="flex flex-col gap-4" novalidate @submit.prevent="deleteAccount">
      <p class="m-0 text-sm">{{ t('settings.delete.description') }}</p>
      <FormRow id="delete-account-email" :label="t('settings.delete.confirmLabel', { email })">
        <!-- biome-ignore-start lint/a11y/noAutofocus: PrimeVue Dialog is a modal that moves focus to its [autofocus] element on open -->
        <InputText
          id="delete-account-email"
          v-model="typed"
          type="email"
          autocomplete="off"
          spellcheck="false"
          autofocus
          fluid
        />
        <!-- biome-ignore-end lint/a11y/noAutofocus: end -->
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
          :loading="reset.isPending.value"
          :disabled="!matches || reset.isPending.value"
        />
      </div>
    </template>
  </Dialog>
</template>
