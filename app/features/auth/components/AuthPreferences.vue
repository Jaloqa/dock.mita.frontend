<script setup lang="ts">
import { type Locale, type ThemePreference, themePreferences } from '~/shared/api/contract'

const { t, locale, locales, setLocale } = useI18n()
const { preference } = useColorMode()

const languages = computed(() => locales.value.map((item) => ({ value: item.code, label: item.name ?? item.code })))
const themes = computed(() => themePreferences.map((theme) => ({ value: theme, label: t(`shared.theme.${theme}`) })))

async function selectLocale(code: Locale) {
  if (code === locale.value) return
  await setLocale(code)
  await nextTick()
  document.getElementById('auth-language')?.focus()
}

function selectTheme(theme: ThemePreference) {
  preference.value = theme
}
</script>

<template>
  <section :aria-label="t('auth.preferences')" class="grid grid-cols-2 gap-3">
    <FormRow id="auth-language" :label="t('shared.language')">
      <template #default="{ labelId }">
        <Select
          :model-value="locale"
          input-id="auth-language"
          :options="languages"
          option-label="label"
          option-value="value"
          :aria-labelledby="labelId"
          class="min-h-11"
          fluid
          @update:model-value="selectLocale"
        />
      </template>
    </FormRow>
    <FormRow id="auth-theme" :label="t('shared.theme.label')">
      <template #default="{ labelId }">
        <Select
          :model-value="preference"
          input-id="auth-theme"
          :options="themes"
          option-label="label"
          option-value="value"
          :aria-labelledby="labelId"
          class="min-h-11"
          fluid
          @update:model-value="selectTheme"
        />
      </template>
    </FormRow>
  </section>
</template>
