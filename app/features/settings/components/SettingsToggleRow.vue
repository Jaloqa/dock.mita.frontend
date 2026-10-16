<script setup lang="ts">
defineProps<{ id: string; title: string; description: string; checked: boolean; disabled?: boolean }>()
const emit = defineEmits<{ toggle: [checked: boolean] }>()
</script>

<template>
  <div class="relative flex min-h-11 items-center justify-between gap-4 border-t border-bg py-3.5">
    <div class="flex min-w-0 flex-col gap-0.5">
      <label :for="id" class="cursor-pointer text-sm font-medium after:absolute after:inset-0">{{ title }}</label>
      <p :id="`${id}-hint`" class="m-0 text-[13px] text-muted">{{ description }}</p>
    </div>
    <ToggleSwitch
      :input-id="id"
      :model-value="checked"
      :disabled="disabled"
      class="relative z-1 shrink-0"
      :pt="{ input: { 'aria-describedby': `${id}-hint` } }"
      @update:model-value="(value: boolean) => emit('toggle', value)"
    />
  </div>
</template>
