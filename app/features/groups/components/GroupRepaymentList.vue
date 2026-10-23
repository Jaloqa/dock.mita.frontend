<script setup lang="ts">
import type { GroupDto, GroupRepaymentDto } from '~/shared/api/contract'

type RepaymentView = 'active' | 'deleted'

defineProps<{ group: GroupDto; canRecord: boolean; hintId?: string }>()
const emit = defineEmits<{ record: []; edit: [repayment: GroupRepaymentDto] }>()
const { t } = useI18n()

const TITLE_ID = 'group-repayments-title'
const views: readonly RepaymentView[] = ['active', 'deleted']

const view = ref<RepaymentView>('active')
const showsDeleted = computed(() => view.value === 'deleted')
const { items, hasMore, loadMore, isPending, isLoadingMore, isError, refetch } = useGroupRepayments(showsDeleted)

const viewOptions = computed(() => views.map((value) => ({ value, label: t(`groups.repayments.${value}`) })))
</script>

<template>
  <section :aria-labelledby="TITLE_ID" class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 :id="TITLE_ID" class="m-0 text-base font-semibold">{{ t('groups.repayments.title') }}</h2>
      <SelectButton
        v-model="view"
        class="mita-segmented"
        :options="viewOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        :aria-label="t('groups.repayments.view')"
        :pt="{ pcToggleButton: { root: { class: 'min-h-11!' } } }"
      />
    </div>
    <div v-if="isPending" class="flex flex-col gap-3 rounded-(--radius-card) bg-surface p-4" aria-hidden="true">
      <Skeleton v-for="index in 3" :key="index" height="4rem" />
    </div>
    <ErrorState v-else-if="isError" @retry="refetch()" />
    <EmptyState v-else-if="items.length === 0 && !showsDeleted" :title="t('groups.repayments.empty')">
      <template #action>
        <Button
          :label="t('groups.actions.recordRepayment')"
          class="min-h-11"
          :disabled="!canRecord"
          :aria-describedby="canRecord ? undefined : hintId"
          @click="emit('record')"
        />
      </template>
    </EmptyState>
    <EmptyState v-else-if="items.length === 0" :title="t('groups.repayments.emptyDeleted')" />
    <div v-else class="flex flex-col gap-1 rounded-(--radius-card) bg-surface px-4 py-1 lg:px-5.5">
      <GroupRepaymentRow
        v-for="repayment in items"
        :key="repayment.id"
        :group="group"
        :repayment="repayment"
        @edit="emit('edit', repayment)"
      />
      <Button
        v-if="hasMore"
        :label="t('groups.repayments.showMore')"
        text
        class="mb-2 min-h-11 self-start"
        :loading="isLoadingMore"
        @click="loadMore()"
      />
    </div>
  </section>
</template>
