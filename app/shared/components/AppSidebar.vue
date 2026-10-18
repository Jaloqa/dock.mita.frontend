<script setup lang="ts">
import { useSession } from '~/shared/auth/useSession'

const emit = defineEmits<{ addTransaction: [] }>()
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { user, logout } = useSession()
const signingOut = ref(false)

async function signOut() {
  signingOut.value = true
  try {
    await logout()
  } finally {
    signingOut.value = false
  }
}

const isActive = (to: string) => route.path === localePath(to)

const linkClass = (to: string) => [
  'flex min-h-11 items-center gap-3 rounded-(--radius-control) px-3 text-sm no-underline transition-colors',
  isActive(to) ? 'bg-surface font-semibold text-ink' : 'font-medium text-muted hover:bg-surface/60 hover:text-ink',
]
</script>

<template>
  <nav
    :aria-label="t('navigation.label')"
    class="sticky top-0 hidden h-dvh w-58 shrink-0 flex-col gap-7 px-5 py-7 lg:flex print:hidden!"
  >
    <NuxtLinkLocale to="/" class="px-2 no-underline">
      <AppLogo />
    </NuxtLinkLocale>
    <Button class="min-h-11 w-full justify-center" @click="emit('addTransaction')">
      <AppIcon name="plus" :size="16" :stroke-width="2.2" />
      {{ t('navigation.addTransaction') }}
    </Button>
    <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
      <li v-for="item in primaryNavigation" :key="item.key">
        <NuxtLinkLocale
          :to="item.to"
          :class="linkClass(item.to)"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <AppIcon :name="item.icon" />
          {{ t(`navigation.${item.key}`) }}
        </NuxtLinkLocale>
      </li>
    </ul>
    <NuxtLinkLocale
      :to="settingsNavigation.to"
      :class="linkClass(settingsNavigation.to)"
      :aria-current="isActive(settingsNavigation.to) ? 'page' : undefined"
    >
      <AppIcon :name="settingsNavigation.icon" />
      {{ t('navigation.settings') }}
    </NuxtLinkLocale>
    <div class="mt-auto flex items-center gap-1 border-t border-border pt-4">
      <p class="m-0 min-w-0 flex-1 truncate px-2 text-sm font-semibold" data-testid="sidebar-user">
        {{ user?.name }}
      </p>
      <button
        type="button"
        :aria-label="t('auth.logout')"
        :title="t('auth.logout')"
        :disabled="signingOut"
        class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-(--radius-control) border-0 bg-transparent text-muted hover:bg-surface/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
        @click="signOut"
      >
        <AppIcon name="logout" />
      </button>
    </div>
  </nav>
</template>
