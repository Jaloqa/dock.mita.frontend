<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const isActive = (to: string) => route.path === localePath(to)

const linkClass = (to: string) => [
  'flex min-h-12 flex-col items-center justify-center gap-1 text-[11px] no-underline',
  isActive(to) ? 'font-semibold text-ink' : 'font-medium text-muted',
]
</script>

<template>
  <nav
    :aria-label="t('navigation.label')"
    class="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 items-center border-t border-border bg-surface px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] lg:hidden"
  >
    <NuxtLinkLocale
      v-for="item in mobileNavigation.start"
      :key="item.key"
      :to="item.to"
      :class="linkClass(item.to)"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      <AppIcon :name="item.icon" :size="22" />
      {{ t(`navigation.${item.key}`) }}
    </NuxtLinkLocale>
    <NuxtLinkLocale
      to="/transactions/new"
      :aria-label="t('navigation.addTransaction')"
      class="flex size-14 items-center justify-center justify-self-center rounded-[18px] bg-accent text-on-accent"
    >
      <AppIcon name="plus" :size="24" :stroke-width="2.2" />
    </NuxtLinkLocale>
    <NuxtLinkLocale
      v-for="item in mobileNavigation.end"
      :key="item.key"
      :to="item.to"
      :class="linkClass(item.to)"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      <AppIcon :name="item.icon" :size="22" />
      {{ t(`navigation.${item.key}`) }}
    </NuxtLinkLocale>
  </nav>
</template>
