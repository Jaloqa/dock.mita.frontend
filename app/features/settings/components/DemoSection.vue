<script setup lang="ts">
const { t } = useI18n()
const notify = useNotify()
const confirm = useConfirm()
const { state, isPending, isError, refetch } = useDemoState()
const { switchUser, reset, simulateErrors } = useDemoMutations()

const requestedUser = ref<string>()
const requestedErrors = ref<boolean>()

const users = computed(() => (state.value?.users ?? []).map((user) => ({ value: user.id, label: user.name })))
const activeUser = computed(() => requestedUser.value ?? state.value?.activeUserId)
const errorsSimulated = computed(() => requestedErrors.value ?? state.value?.simulateErrors ?? false)

function selectUser(userId: string) {
  if (switchUser.isPending.value || userId === state.value?.activeUserId) return
  const name = users.value.find((user) => user.value === userId)?.label ?? ''
  requestedUser.value = userId
  switchUser.mutate(userId, {
    onSuccess: () => notify.success(t('settings.demo.switched', { name })),
    onError: (error) => notify.error(error),
    onSettled: () => {
      requestedUser.value = undefined
    },
  })
}

function confirmReset() {
  confirm.require({
    header: t('settings.demo.resetTitle'),
    message: t('settings.demo.resetMessage'),
    acceptLabel: t('settings.demo.reset'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      reset.mutate(undefined, {
        onSuccess: () => notify.success(t('settings.demo.resetDone')),
        onError: (error) => notify.error(error),
      }),
  })
}

function setSimulateErrors(enabled: boolean) {
  if (simulateErrors.isPending.value) return
  requestedErrors.value = enabled
  simulateErrors.mutate(enabled, {
    onSuccess: () => notify.success(t('settings.saved')),
    onError: (error) => notify.error(error),
    onSettled: () => {
      requestedErrors.value = undefined
    },
  })
}
</script>

<template>
  <SettingsCard id="settings-demo" :title="t('settings.demo.title')">
    <p class="m-0 -mt-2 text-[13px] text-muted">{{ t('settings.demo.caption') }}</p>
    <ErrorState v-if="isError && !state" compact @retry="refetch()" />
    <div v-else-if="isPending || !state" class="flex flex-col gap-4" aria-hidden="true">
      <Skeleton height="4.25rem" border-radius="var(--radius-control)" />
      <Skeleton width="10rem" height="2.75rem" border-radius="var(--radius-control)" />
      <Skeleton height="3.5rem" border-radius="var(--radius-control)" />
    </div>
    <template v-else>
      <FormRow id="demo-user" :label="t('settings.demo.user')">
        <template #default="{ labelId }">
          <Select
            :model-value="activeUser"
            input-id="demo-user"
            :options="users"
            option-label="label"
            option-value="value"
            :loading="switchUser.isPending.value"
            :aria-labelledby="labelId"
            class="min-h-11"
            fluid
            @update:model-value="selectUser"
          />
        </template>
      </FormRow>
      <Button
        :label="t('settings.demo.reset')"
        severity="secondary"
        outlined
        class="min-h-11 self-start"
        :loading="reset.isPending.value"
        :disabled="reset.isPending.value"
        @click="confirmReset"
      />
      <SettingsToggleRow
        id="demo-simulate-errors"
        :title="t('settings.demo.simulateErrors')"
        :description="t('settings.demo.simulateErrorsHint')"
        :checked="errorsSimulated"
        :disabled="simulateErrors.isPending.value"
        @toggle="setSimulateErrors"
      />
    </template>
  </SettingsCard>
</template>
