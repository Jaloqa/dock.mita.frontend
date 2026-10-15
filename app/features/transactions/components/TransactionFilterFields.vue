<script setup lang="ts">
import { type AccountDto, type CategoryDto, categoryKinds } from '~/shared/api/contract'
import { type PeriodPreset, periodPresets } from '../utils/filters'

const props = defineProps<{ idPrefix: string; categories: CategoryDto[]; accounts: AccountDto[] }>()
const categoryId = defineModel<string | null>('categoryId', { required: true })
const accountId = defineModel<string | null>('accountId', { required: true })
const period = defineModel<PeriodPreset>('period', { required: true })
const { t } = useI18n()

const categoryGroups = computed(() =>
  categoryKinds
    .map((kind) => ({
      label: t(`transactions.kind.${kind}`),
      items: props.categories.filter((category) => category.kind === kind && category.system !== 'transfer'),
    }))
    .filter((group) => group.items.length > 0),
)
const accountOptions = computed(() => props.accounts.map((account) => ({ value: account.id, label: account.name })))
const periodOptions = computed(() =>
  periodPresets.map((preset) => ({ value: preset, label: t(`transactions.period.${preset}`) })),
)
</script>

<template>
  <FormRow :id="`${idPrefix}-category`" :label="t('transactions.filters.category')" class="min-w-0 flex-[1_1_150px]">
    <template #default="{ labelId }">
      <Select
        v-model="categoryId"
        :input-id="`${idPrefix}-category`"
        :options="categoryGroups"
        option-group-label="label"
        option-group-children="items"
        option-label="name"
        option-value="id"
        :placeholder="t('transactions.filters.allCategories')"
        show-clear
        :aria-labelledby="labelId"
        fluid
      />
    </template>
  </FormRow>
  <FormRow :id="`${idPrefix}-account`" :label="t('transactions.filters.account')" class="min-w-0 flex-[1_1_150px]">
    <template #default="{ labelId }">
      <Select
        v-model="accountId"
        :input-id="`${idPrefix}-account`"
        :options="accountOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('transactions.filters.allAccounts')"
        show-clear
        :aria-labelledby="labelId"
        fluid
      />
    </template>
  </FormRow>
  <FormRow :id="`${idPrefix}-period`" :label="t('transactions.filters.period')" class="min-w-0 flex-[1_1_150px]">
    <template #default="{ labelId }">
      <Select
        v-model="period"
        :input-id="`${idPrefix}-period`"
        :options="periodOptions"
        option-label="label"
        option-value="value"
        :aria-labelledby="labelId"
        fluid
      />
    </template>
  </FormRow>
</template>
