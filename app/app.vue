<script setup lang="ts">
const head = useLocaleHead()
const { t } = useI18n()

useHead({
  htmlAttrs: { lang: () => head.value.htmlAttrs.lang },
  titleTemplate: (title) => (title ? `${title} · Mita` : 'Mita'),
  meta: [{ name: 'description', content: () => t('app.description') }],
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
