import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { TransactionInput } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { transactionsApi } from '../api/transactionsApi'

export function useTransactionMutations() {
  const api = transactionsApi(useApi())
  const queryClient = useQueryClient()
  const onSuccess = () => invalidateAfter(queryClient, 'transactions')

  return {
    create: useMutation({ mutationFn: api.create, onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: TransactionInput }) => api.update(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: api.remove, onSuccess }),
  }
}
