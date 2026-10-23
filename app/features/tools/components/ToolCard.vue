<script setup lang="ts">
import type { ToolEntry } from '../utils/tools'

const props = defineProps<{ entry: ToolEntry }>()
const { t } = useI18n()

const titleId = computed(() => `tool-${props.entry.key}-title`)
const descriptionId = computed(() => `tool-${props.entry.key}-description`)
</script>

<template>
  <NuxtLinkLocale
    :to="entry.to"
    :aria-labelledby="titleId"
    :aria-describedby="descriptionId"
    class="flex min-h-11 w-full min-w-0 items-center gap-4 rounded-(--radius-card) bg-surface p-4 text-ink no-underline transition-colors hover:bg-surface/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:p-5.5"
  >
    <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-bg text-accent">
      <AppIcon :name="entry.icon" :size="22" />
    </span>
    <span class="flex min-w-0 flex-col gap-0.5">
      <span :id="titleId" class="text-base font-semibold break-words lg:text-lg">
        {{ t(`tools.entries.${entry.key}.title`) }}
      </span>
      <span :id="descriptionId" class="text-[13px] text-muted">
        {{ t(`tools.entries.${entry.key}.description`) }}
      </span>
    </span>
  </NuxtLinkLocale>
</template>
