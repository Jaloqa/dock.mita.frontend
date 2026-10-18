<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()

useHead({ title: () => t('auth.register.title') })
</script>

<template>
  <RegisterForm />
</template>
