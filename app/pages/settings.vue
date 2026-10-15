<script setup lang="ts">
import { useCurrentUser } from '~/shared/user/useCurrentUser'

const { t } = useI18n()
const { user } = useCurrentUser()
const categoriesOpen = ref(false)

useHead({ title: () => t('navigation.settings') })
</script>

<template>
  <PageHeader :title="t('navigation.settings')" />
  <p v-if="user" class="m-0 text-sm text-muted" data-testid="current-user">{{ user.name }}</p>
  <section class="flex flex-col gap-5 rounded-(--radius-card) bg-surface p-5.5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span class="text-sm font-medium">{{ t('shared.language') }}</span>
      <LocaleSwitcher />
    </div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span class="text-sm font-medium">{{ t('shared.theme.label') }}</span>
      <ColorModeSwitcher />
    </div>
  </section>
  <section aria-labelledby="settings-data" class="flex flex-col gap-3 rounded-(--radius-card) bg-surface p-5.5">
    <h2 id="settings-data" class="m-0 mb-1 text-base font-semibold">{{ t('settings.data.title') }}</h2>
    <button
      type="button"
      class="flex min-h-12 items-center gap-2.5 rounded-(--radius-control) border border-border bg-surface px-4 text-left text-sm font-medium text-ink transition-colors hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      @click="categoriesOpen = true"
    >
      <AppIcon name="budgets" />
      {{ t('settings.data.manageCategories') }}
    </button>
  </section>
  <CategoryManagerDialog v-model:visible="categoriesOpen" />
</template>
