<script setup lang="ts">
definePageMeta({ layout: 'focus' })

const { t } = useI18n()
const router = useRouter()
const localePath = useLocalePath()

function leave(fallback: string) {
  if (window.history.state?.back) router.back()
  else navigateTo(localePath(fallback))
}

useHead({ title: () => t('navigation.addTransaction') })
</script>

<template>
  <QuickAddForm @close="leave('/')" @done="leave('/transactions')" />
</template>
