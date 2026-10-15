<script setup lang="ts">
const props = defineProps<{ id: string; label: string; errors?: string[]; hint?: string }>()

const errorId = computed(() => `${props.id}-error`)
const hintId = computed(() => `${props.id}-hint`)
const invalid = computed(() => (props.errors?.length ?? 0) > 0)
const describedBy = computed(
  () =>
    [invalid.value ? errorId.value : undefined, props.hint ? hintId.value : undefined].filter(Boolean).join(' ') ||
    undefined,
)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :id="`${id}-label`" :for="id" class="text-[13px] font-medium text-muted">{{ label }}</label>
    <slot :invalid="invalid" :described-by="describedBy" :label-id="`${id}-label`" />
    <p v-if="hint" :id="hintId" class="m-0 text-xs text-muted">{{ hint }}</p>
    <p v-if="invalid" :id="errorId" class="m-0 text-xs font-medium text-accent">{{ errors?.[0] }}</p>
  </div>
</template>
