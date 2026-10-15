import type { CategoryKind, TransactionDto } from '~/shared/api/contract'

type DialogState = { open: boolean; kind: CategoryKind; transaction?: TransactionDto }

export function useTransactionDialog() {
  const state = useState<DialogState>('transaction-dialog', () => ({ open: false, kind: 'expense' }))

  return {
    state,
    openCreate: (kind: CategoryKind = 'expense') => {
      state.value = { open: true, kind }
    },
    openEdit: (transaction: TransactionDto) => {
      state.value = { open: true, kind: transaction.kind, transaction }
    },
    close: () => {
      state.value = { ...state.value, open: false }
    },
  }
}
