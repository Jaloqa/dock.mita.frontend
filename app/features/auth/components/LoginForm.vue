<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import { useSession } from '~/shared/auth/useSession'
import { type LoginFields, loginRules } from '../schemas/authSchema'
import { authMessageKey } from '../utils/authMessage'
import { demoAccounts } from '../utils/demoAccounts'

const { t } = useI18n()
const route = useRoute()
const session = useSession()
const server = useServerErrors()
const { linkTo, continueToApp } = useAuthRedirect()

const fields = ['email', 'password'] as const
type Field = (typeof fields)[number]

const form = reactive<LoginFields>({ email: '', password: '' })
const v$ = useVuelidate(loginRules(t), form)
const formEl = ref<HTMLFormElement | null>(null)
const pending = ref(false)
const hydrated = ref(false)
const messageKey = ref(route.query.expired === '1' ? 'auth.errors.sessionExpired' : undefined)
const pureMocks = useApiMode() === 'mock'
const [annaEmail, olehEmail] = demoAccounts.emails

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
    await session.login({ email: form.email.trim(), password: form.password })
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
      <h1 class="m-0 text-2xl font-bold tracking-tight">{{ t('auth.login.title') }}</h1>
      <p class="m-0 text-sm text-muted">{{ t('auth.login.subtitle') }}</p>
    </header>
    <AuthAlert v-if="messageKey" :message="t(messageKey)" />
    <FormRow id="login-email" :label="t('auth.fields.email')" :errors="errorsOf('email')">
      <template #default="{ invalid, describedBy }">
        <InputText
          id="login-email"
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
    <FormRow id="login-password" :label="t('auth.fields.password')" :errors="errorsOf('password')">
      <template #default="{ invalid, describedBy }">
        <PasswordField
          id="login-password"
          v-model="form.password"
          autocomplete="current-password"
          :invalid="invalid"
          :described-by="describedBy"
          @blur="touch('password')"
        />
      </template>
    </FormRow>
    <Button
      type="submit"
      :label="t('auth.login.submit')"
      class="min-h-11"
      fluid
      :loading="pending"
      :disabled="pending || !hydrated"
    />
    <p class="m-0 text-center text-sm text-muted">
      {{ t('auth.login.noAccount') }}
      <NuxtLink :to="linkTo('register')" class="inline-flex min-h-11 items-center font-semibold text-accent">
        {{ t('auth.login.registerLink') }}
      </NuxtLink>
    </p>
    <p v-if="pureMocks" class="m-0 rounded-(--radius-control) bg-bg px-3.5 py-3 text-[13px] text-muted">
      {{ t('auth.login.demoHint', { anna: annaEmail, oleh: olehEmail, password: demoAccounts.password }) }}
    </p>
  </form>
</template>
