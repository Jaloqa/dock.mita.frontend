<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()

useHead({ title: () => t('auth.login.title') })
</script>

<template>
  <LoginForm />
</template>
