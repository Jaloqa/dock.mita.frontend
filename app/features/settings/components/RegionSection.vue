<script setup lang="ts">
import { type Locale, type ThemePreference, themePreferences } from '~/shared/api/contract'
import type { BaseCurrency } from '~/shared/money/currencies'
import type { MonthStart } from '~/shared/period/period'
import { currencyOptions, monthStartOptions } from '../utils/options'

const { t, locale, locales, setLocale } = useI18n()
const { preference } = useColorMode()
const { settings, isPending, isError, hasData, refetch, draft, saving, change } = useSettingsChange()

const currencies = computed(() => currencyOptions(locale.value))
const languages = computed(() => locales.value.map((item) => ({ value: item.code, label: item.name ?? item.code })))
const monthStarts = computed(() =>
  monthStartOptions((day) => t('settings.region.monthStartDay', { day }), t('settings.region.lastWorkingDay')),
)
const themes = computed(() => themePreferences.map((theme) => ({ value: theme, label: t(`shared.theme.${theme}`) })))

const shown = computed(() => ({
  baseCurrency: draft.value.baseCurrency ?? settings.value.baseCurrency,
  locale: draft.value.locale ?? locale.value,
  monthStartDay: draft.value.monthStartDay ?? settings.value.monthStartDay,
  theme: draft.value.theme ?? preference.value,
}))

function selectCurrency(baseCurrency: BaseCurrency) {
  if (baseCurrency !== shown.value.baseCurrency) change({ baseCurrency })
}

function selectLocale(code: Locale) {
  if (code === shown.value.locale) return
  change({ locale: code }, async () => {
    await setLocale(code)
    await nextTick()
    document.getElementById('settings-language')?.focus()
  })
}

function selectMonthStart(monthStartDay: MonthStart) {
  if (monthStartDay !== shown.value.monthStartDay) change({ monthStartDay })
}

function selectTheme(theme: ThemePreference) {
  if (theme === shown.value.theme) return
  change({ theme }, () => {
    preference.value = theme
  })
}
</script>

<template>
  <SettingsCard id="settings-region" :title="t('settings.region.title')">
    <ErrorState v-if="isError && !hasData" compact @retry="refetch()" />
    <div v-else-if="isPending" class="flex flex-col gap-4" aria-hidden="true">
      <Skeleton v-for="index in 3" :key="index" height="4.25rem" border-radius="var(--radius-control)" />
    </div>
    <template v-else>
      <div class="grid grid-cols-2 gap-3">
        <FormRow id="settings-currency" :label="t('settings.region.baseCurrency')">
          <template #default="{ labelId }">
            <Select
              :model-value="shown.baseCurrency"
              input-id="settings-currency"
              :options="currencies"
              option-label="label"
              option-value="value"
              :disabled="saving"
              :aria-labelledby="labelId"
              class="min-h-11"
              fluid
              @update:model-value="selectCurrency"
            />
          </template>
        </FormRow>
        <FormRow id="settings-language" :label="t('shared.language')">
          <template #default="{ labelId }">
            <Select
              :model-value="shown.locale"
              input-id="settings-language"
              :options="languages"
              option-label="label"
              option-value="value"
              :disabled="saving"
              :aria-labelledby="labelId"
              class="min-h-11"
              fluid
              @update:model-value="selectLocale"
            />
          </template>
        </FormRow>
      </div>
      <FormRow id="settings-month-start" :label="t('settings.region.monthStart')">
        <template #default="{ labelId }">
          <Select
            :model-value="shown.monthStartDay"
            input-id="settings-month-start"
            :options="monthStarts"
            option-label="label"
            option-value="value"
            :disabled="saving"
            :aria-labelledby="labelId"
            class="min-h-11"
            fluid
            @update:model-value="selectMonthStart"
          />
        </template>
      </FormRow>
      <FormRow id="settings-theme" :label="t('shared.theme.label')">
        <template #default="{ labelId }">
          <Select
            :model-value="shown.theme"
            input-id="settings-theme"
            :options="themes"
            option-label="label"
            option-value="value"
            :disabled="saving"
            :aria-labelledby="labelId"
            class="min-h-11"
            fluid
            @update:model-value="selectTheme"
          />
        </template>
      </FormRow>
    </template>
  </SettingsCard>
</template>
