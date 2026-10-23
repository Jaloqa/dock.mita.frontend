<script setup lang="ts">
defineProps<{ name: string }>()
const emit = defineEmits<{ change: [] }>()
const { t } = useI18n()

const MEMBER_ID = 'link-bar-member'

const changeButton = ref<{ $el: HTMLElement } | null>(null)

defineExpose({ focus: () => changeButton.value?.$el.focus() })
</script>

<template>
  <div class="flex items-center justify-between gap-3 rounded-(--radius-card) bg-surface py-1 ps-4 pe-1">
    <p :id="MEMBER_ID" class="m-0 min-w-0 text-sm font-medium break-words">{{ t('groups.link.youAre', { name }) }}</p>
    <Button
      ref="changeButton"
      :label="t('groups.link.change')"
      :aria-describedby="MEMBER_ID"
      severity="secondary"
      text
      class="min-h-11 min-w-11 shrink-0"
      @click="emit('change')"
    />
  </div>
</template>
