<script setup lang="ts">
const head = useLocaleHead()
const { t } = useI18n()
const { isDark } = useColorMode()

useHead({
  htmlAttrs: {
    lang: () => head.value.htmlAttrs.lang,
    class: () => (isDark.value ? 'dark' : undefined),
  },
  titleTemplate: (title) => (title ? `${title} · Mita` : 'Mita'),
  meta: [{ name: 'description', content: () => t('app.description') }],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
