<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import { useCurrentUser } from '~/shared/user/useCurrentUser'
import { type ProfileForm, profileRules } from '../schemas/profileSchema'

const { t } = useI18n()
const notify = useNotify()
const server = useServerErrors()
const { user, isPending, isError, refetch } = useCurrentUser()
const update = useProfileUpdate()

const fields = ['name', 'email'] as const
type Field = (typeof fields)[number]

const form = reactive<ProfileForm>({ name: '', email: '' })
const v$ = useVuelidate(profileRules(t), form)
const formEl = ref<HTMLFormElement | null>(null)

watch(
  user,
  (current) => {
    if (!current) return
    form.name = current.name
    form.email = current.email
    server.clear()
    v$.value.$reset()
  },
  { immediate: true },
)

const errorsOf = (field: Field) => [
  ...v$.value[field].$errors.map((error) => String(unref(error.$message))),
  ...server.messages(field),
]

function touch(field: Field) {
  v$.value[field].$touch()
  server.clear(field)
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
  update.mutate(
    { name: form.name.trim(), email: form.email.trim() },
    { onSuccess: () => notify.success(t('settings.profile.saved')), onError: showServerErrors },
  )
}
</script>

<template>
  <SettingsCard id="settings-profile" :title="t('settings.profile.title')">
    <ErrorState v-if="isError && !user" compact @retry="refetch()" />
    <div v-else-if="isPending || !user" class="flex flex-col gap-4" aria-hidden="true">
      <Skeleton v-for="index in 2" :key="index" height="4.25rem" border-radius="var(--radius-control)" />
      <Skeleton width="7rem" height="2.75rem" border-radius="var(--radius-control)" />
    </div>
    <form v-else ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormRow id="profile-name" :label="t('settings.profile.name')" :errors="errorsOf('name')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="profile-name"
            v-model="form.name"
            autocomplete="name"
            :invalid="invalid"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            fluid
            @blur="touch('name')"
          />
        </template>
      </FormRow>
      <FormRow id="profile-email" :label="t('settings.profile.email')" :errors="errorsOf('email')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="profile-email"
            v-model="form.email"
            type="email"
            autocomplete="email"
            spellcheck="false"
            :invalid="invalid"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            fluid
            @blur="touch('email')"
          />
        </template>
      </FormRow>
      <Button
        type="submit"
        :label="t('shared.actions.save')"
        class="min-h-11 self-start"
        :loading="update.isPending.value"
        :disabled="update.isPending.value"
      />
    </form>
  </SettingsCard>
</template>
