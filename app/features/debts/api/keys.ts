import type { DebtStatus } from '~/shared/api/contract'

export const debtKeys = {
  all: ['debts'],
  list: (status: DebtStatus) => ['debts', 'list', status] as const,
  groups: ['debts', 'groups'],
  repayments: (id: string) => ['debts', 'repayments', id] as const,
} as const
