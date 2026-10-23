import { errorMessageKey } from '~/shared/api/errorMessage'

export function useNotify() {
  const toast = useToast()
  const { t } = useI18n()
  const failure = (detail: string) =>
    toast.add({ severity: 'error', summary: t('shared.error.title'), detail, life: 6000 })

  return {
    success: (summary: string) => toast.add({ severity: 'success', summary, life: 3000 }),
    info: (summary: string) => toast.add({ severity: 'info', summary, life: 3000 }),
    failure,
    error: (error: unknown) => failure(t(errorMessageKey(error))),
  }
}
