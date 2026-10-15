import { useAccounts } from '~/shared/accounts/useAccounts'
import type { TransactionQuery } from '~/shared/api/contract'
import { useCategories } from '~/shared/categories/useCategories'
import { todayIso } from '~/shared/period/period'
import { transactionsApi } from '../api/transactionsApi'
import { collectPages, transactionsCsv } from '../utils/csv'
import { downloadText } from '../utils/download'

export const EXPORT_PAGE_SIZE = 100

export function useTransactionExport() {
  const api = transactionsApi(useApi())
  const { t } = useI18n()
  const notify = useNotify()
  const { nameOf } = useCategories()
  const { accounts } = useAccounts()
  const exporting = ref(false)

  async function exportCsv(query: TransactionQuery) {
    if (exporting.value) return
    exporting.value = true
    try {
      const pages = await collectPages((page) => api.list({ ...query, page, pageSize: EXPORT_PAGE_SIZE }))
      const items = pages.flatMap((page) => page.items)
      const byId = new Map(accounts.value.map((account) => [account.id, account]))
      const csv = transactionsCsv(items, {
        header: (column) => t(`transactions.csv.${column}`),
        kind: (kind) => t(`transactions.kindSingle.${kind}`),
        categoryName: (id) => nameOf(id) ?? '',
        account: (id) => byId.get(id),
        baseCurrency: pages[0]?.currency ?? 'PLN',
      })
      downloadText(`mita-transactions-${todayIso()}.csv`, csv, 'text/csv;charset=utf-8')
      notify.success(t('transactions.toast.exported', { count: items.length }, items.length))
    } catch (error) {
      notify.error(error)
    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportCsv }
}
