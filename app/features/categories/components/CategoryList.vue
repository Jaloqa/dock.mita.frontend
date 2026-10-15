<script setup lang="ts">
import type { CategoryDto } from '~/shared/api/contract'
import { categorySwatchClass } from '~/shared/categories/colors'

defineProps<{ categories: CategoryDto[]; label: string; isPending: boolean; isError: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <div v-if="isPending" class="flex flex-col gap-2" aria-hidden="true">
    <Skeleton v-for="index in 5" :key="index" height="2.75rem" border-radius="10px" />
  </div>
  <ErrorState v-else-if="isError" @retry="emit('retry')" />
  <EmptyState v-else-if="categories.length === 0" :title="t('categories.list.empty')" />
  <ul v-else :aria-label="label" class="m-0 flex list-none flex-col p-0">
    <li
      v-for="category in categories"
      :key="category.id"
      class="flex min-h-12 items-center gap-3 border-b border-border py-1 last:border-b-0"
    >
      <span class="size-3.5 shrink-0 rounded-full" :class="categorySwatchClass(category.color)" aria-hidden="true" />
      <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ category.name }}</span>
      <span v-if="category.system" class="shrink-0 rounded-full bg-track px-2.5 py-1 text-xs font-semibold text-muted">
        {{ t('categories.system') }}
      </span>
    </li>
  </ul>
</template>
