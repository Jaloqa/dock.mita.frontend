<script setup lang="ts">
import { useCurrentUser } from '~/shared/user/useCurrentUser'

const { t } = useI18n()
const { user } = useCurrentUser()

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
</template>
