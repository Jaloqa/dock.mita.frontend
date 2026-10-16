import { useIsMutating, useQueryClient } from '@tanstack/vue-query'
import type { Locale, SettingsDto } from '~/shared/api/contract'
import { userKeys } from '~/shared/user/keys'
import { useUpdateSettings, useUserSettings } from '~/shared/user/useUserSettings'

export function useSettingsChange() {
  const { t, locale } = useI18n()
  const { preference } = useColorMode()
  const notify = useNotify()
  const queryClient = useQueryClient()
  const { settings, isPending, isError, refetch } = useUserSettings()
  const update = useUpdateSettings()
  const mutating = useIsMutating({ mutationKey: userKeys.settings })
  const saving = computed(() => mutating.value > 0)
  const draft = ref<Partial<SettingsDto>>({})

  function change(patch: Partial<SettingsDto>, apply?: () => unknown) {
    const stored = queryClient.getQueryData<SettingsDto>(userKeys.settings)
    if (saving.value || !stored) return
    draft.value = patch
    update.mutate(
      { ...stored, locale: locale.value as Locale, theme: preference.value, ...patch },
      {
        onSuccess: async () => {
          try {
            await apply?.()
            notify.success(t('settings.saved'))
          } catch (error) {
            notify.error(error)
          } finally {
            draft.value = {}
          }
        },
        onError: (error) => {
          draft.value = {}
          notify.error(error)
        },
      },
    )
  }

  return { settings, isPending, isError, refetch, draft, saving, change }
}
