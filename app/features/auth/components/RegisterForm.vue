<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import { useSession } from '~/shared/auth/useSession'
import { type RegisterFields, registerRules } from '../schemas/authSchema'
import { authMessageKey } from '../utils/authMessage'

const { t } = useI18n()
const session = useSession()
const server = useServerErrors()
const { linkTo, continueToApp } = useAuthRedirect()

const fields = ['name', 'email', 'password'] as const
type Field = (typeof fields)[number]

const form = reactive<RegisterFields>({ name: '', email: '', password: '' })
const v$ = useVuelidate(registerRules(t), form)
const formEl = ref<HTMLFormElement | null>(null)
const pending = ref(false)
const hydrated = ref(false)
const messageKey = ref<string>()

// Until hydration a click would submit the native form as a GET to the same page and drop what was typed.
onMounted(() => {
  hydrated.value = true
})

const errorsOf = (field: Field) => [
  ...v$.value[field].$errors.map((error) => String(unref(error.$message))),
  ...server.messages(field),
]

for (const field of fields)
  watch(
    () => form[field],
    () => server.clear(field),
  )

function touch(field: Field) {
  v$.value[field].$touch()
}

async function focusInvalid() {
  await nextTick()
  focusFirstInvalid(formEl.value)
}

async function submit() {
  if (pending.value) return
  messageKey.value = undefined
  server.clear()
  if (!(await v$.value.$validate())) return focusInvalid()
  pending.value = true
  try {
    await session.register({ name: form.name.trim(), email: form.email.trim(), password: form.password })
    await continueToApp()
  } catch (error) {
    if (server.apply(error, fields)) await focusInvalid()
    else messageKey.value = authMessageKey(error)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <form ref="formEl" class="flex flex-col gap-5" novalidate :aria-busy="pending" @submit.prevent="submit">
    <header class="flex flex-col gap-1.5">
      <h1 class="m-0 text-2xl font-bold tracking-tight">{{ t('auth.register.title') }}</h1>
      <p class="m-0 text-sm text-muted">{{ t('auth.register.subtitle') }}</p>
    </header>
    <AuthAlert v-if="messageKey" :message="t(messageKey)" />
    <FormRow id="register-name" :label="t('auth.fields.name')" :errors="errorsOf('name')">
      <template #default="{ invalid, describedBy }">
        <InputText
          id="register-name"
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
    <FormRow id="register-email" :label="t('auth.fields.email')" :errors="errorsOf('email')">
      <template #default="{ invalid, describedBy }">
        <InputText
          id="register-email"
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
    <FormRow
      id="register-password"
      :label="t('auth.fields.password')"
      :hint="t('auth.register.passwordHint')"
      :errors="errorsOf('password')"
    >
      <template #default="{ invalid, describedBy }">
        <PasswordField
          id="register-password"
          v-model="form.password"
          autocomplete="new-password"
          :invalid="invalid"
          :described-by="describedBy"
          @blur="touch('password')"
        />
      </template>
    </FormRow>
    <Button
      type="submit"
      :label="t('auth.register.submit')"
      class="min-h-11"
      fluid
      :loading="pending"
      :disabled="pending || !hydrated"
    />
    <p class="m-0 text-center text-sm text-muted">
      {{ t('auth.register.hasAccount') }}
      <NuxtLink :to="linkTo('login')" class="inline-flex min-h-11 items-center font-semibold text-accent">
        {{ t('auth.register.loginLink') }}
      </NuxtLink>
    </p>
  </form>
</template>
