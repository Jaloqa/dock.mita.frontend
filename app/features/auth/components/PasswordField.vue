<script setup lang="ts">
const model = defineModel<string>({ required: true })
defineProps<{
  id: string
  autocomplete: 'current-password' | 'new-password'
  invalid?: boolean
  describedBy?: string
}>()
const emit = defineEmits<{ blur: [] }>()
const { t } = useI18n()
const visible = ref(false)
</script>

<template>
  <div class="relative">
    <InputText
      :id="id"
      v-model="model"
      :type="visible ? 'text' : 'password'"
      :autocomplete="autocomplete"
      autocapitalize="off"
      spellcheck="false"
      :invalid="invalid"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedBy"
      class="pr-12!"
      fluid
      @blur="emit('blur')"
    />
    <button
      type="button"
      :aria-label="t('auth.password.show')"
      :aria-pressed="visible"
      :aria-controls="id"
      class="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-(--radius-control) border-0 bg-transparent text-muted hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      @click="visible = !visible"
    >
      <AppIcon :name="visible ? 'eyeOff' : 'eye'" :size="20" />
    </button>
  </div>
</template>
