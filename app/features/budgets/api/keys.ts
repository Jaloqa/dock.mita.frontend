export const budgetKeys = {
  all: ['budgets'],
  list: (period: string) => ['budgets', 'list', period] as const,
} as const
