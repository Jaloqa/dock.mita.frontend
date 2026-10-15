<script setup lang="ts">
import { type CategoryColor, categoryColors } from '~/shared/api/contract'
import { categorySwatchClass } from '~/shared/categories/colors'

defineProps<{ labelledBy: string }>()
const model = defineModel<CategoryColor>({ required: true })
const { t } = useI18n()
</script>

<template>
  <div role="radiogroup" :aria-labelledby="labelledBy" class="flex flex-wrap gap-1">
    <input
      v-for="(color, index) in categoryColors"
      :key="color"
      v-model="model"
      type="radio"
      name="category-color"
      :value="color"
      :aria-label="t('categories.form.colorOption', { index: index + 1 })"
      class="size-11 cursor-pointer appearance-none rounded-full border-8 border-transparent bg-clip-padding inset-ring inset-ring-border outline-offset-[-2px] checked:outline-2 checked:outline-ink focus-visible:outline-2 focus-visible:outline-accent"
      :class="categorySwatchClass(color)"
    >
  </div>
</template>
