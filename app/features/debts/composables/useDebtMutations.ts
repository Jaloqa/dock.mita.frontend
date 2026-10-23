import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { DebtInput, DebtRepaymentInput } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { debtsApi } from '../api/debtsApi'

export function useDebtMutations() {
  const api = debtsApi(useApi())
  const queryClient = useQueryClient()
  const onSuccess = () => invalidateAfter(queryClient, 'debts')

  return {
    create: useMutation({ mutationFn: api.create, onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: DebtInput }) => api.update(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: api.remove, onSuccess }),
    repay: useMutation({
      mutationFn: ({ id, input }: { id: string; input: DebtRepaymentInput }) => api.repay(id, input),
      onSuccess,
    }),
    removeRepayment: useMutation({
      mutationFn: ({ id, repaymentId }: { id: string; repaymentId: string }) => api.removeRepayment(id, repaymentId),
      onSuccess,
    }),
  }
}
