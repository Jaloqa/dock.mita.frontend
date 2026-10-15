<script setup lang="ts">
import type { CategoryDto } from '~/shared/api/contract'
import { categorySwatchClass } from '~/shared/categories/colors'

defineProps<{
  categories: CategoryDto[]
  label: string
  isPending: boolean
  isError: boolean
  editingId?: string
}>()
const emit = defineEmits<{ retry: []; edit: [category: CategoryDto]; remove: [category: CategoryDto] }>()
const { t } = useI18n()
const iconButton =
  'flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) text-muted transition-colors hover:text-ink focus-visible:text-ink'
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
      <slot v-if="category.id === editingId" name="editor" />
      <template v-else>
        <span
          class="size-3.5 shrink-0 rounded-full inset-ring inset-ring-border"
          :class="categorySwatchClass(category.color)"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ category.name }}</span>
        <span
          v-if="category.system"
          class="shrink-0 rounded-full bg-track px-2.5 py-1 text-xs font-semibold text-muted"
        >
          {{ t('categories.system') }}
        </span>
        <div class="-mr-2 flex shrink-0">
          <button
            type="button"
            :class="iconButton"
            :data-category-edit="category.id"
            :aria-label="t('categories.actions.edit', { name: category.name })"
            @click="emit('edit', category)"
          >
            <AppIcon name="edit" />
          </button>
          <button
            v-if="!category.system"
            type="button"
            :class="iconButton"
            :aria-label="t('categories.actions.delete', { name: category.name })"
            @click="emit('remove', category)"
          >
            <AppIcon name="trash" />
          </button>
        </div>
      </template>
    </li>
  </ul>
</template>
