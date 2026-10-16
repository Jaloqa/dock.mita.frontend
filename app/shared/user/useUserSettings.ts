import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { SettingsDto } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { userKeys } from './keys'
import { userApi } from './userApi'

export const DEFAULT_SETTINGS: SettingsDto = {
  baseCurrency: 'PLN',
  locale: 'en',
  monthStartDay: 1,
  theme: 'system',
  notifications: { budgetLimit: true, dailyReminder: true, weeklyReport: false, goals: true },
}

export function useUserSettings() {
  const api = userApi(useApi())
  const query = useQuery({ queryKey: userKeys.settings, queryFn: api.settings })
  const settings = computed(() => query.data.value ?? DEFAULT_SETTINGS)

  return {
    settings,
    baseCurrency: computed(() => settings.value.baseCurrency),
    monthStart: computed(() => settings.value.monthStartDay),
    isPending: query.isPending,
    isError: query.isError,
    hasData: computed(() => query.data.value !== undefined),
    refetch: query.refetch,
  }
}

export function useUpdateSettings() {
  const api = userApi(useApi())
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: userKeys.settings,
    mutationFn: api.updateSettings,
    onSuccess: async (settings) => {
      queryClient.setQueryData(userKeys.settings, settings)
      await invalidateAfter(queryClient, 'settings')
    },
  })
}
