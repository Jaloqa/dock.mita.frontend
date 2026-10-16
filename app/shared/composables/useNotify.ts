import { errorMessageKey } from '~/shared/api/errorMessage'

export function useNotify() {
  const toast = useToast()
  const { t } = useI18n()

  return {
    success: (summary: string) => toast.add({ severity: 'success', summary, life: 3000 }),
    info: (summary: string) => toast.add({ severity: 'info', summary, life: 3000 }),
    error: (error: unknown) =>
      toast.add({ severity: 'error', summary: t('shared.error.title'), detail: t(errorMessageKey(error)), life: 6000 }),
  }
}
