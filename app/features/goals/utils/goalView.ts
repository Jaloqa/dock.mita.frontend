import type { AccountDto, GoalDto } from '../../../shared/api/contract'
import { type Currency, convertMinor, toMinor } from '../../../shared/money/money'

export type GoalHint = { key: string; amount: number | null }

export function goalHint(goal: Pick<GoalDto, 'status' | 'remaining' | 'monthly'>): GoalHint {
  if (goal.status === 'reached') return { key: 'goals.hint.reached', amount: null }
  if (goal.status === 'overdue') return { key: 'goals.hint.overdue', amount: goal.remaining }
  if (goal.monthly !== null) return { key: 'goals.hint.monthly', amount: goal.monthly }
  return { key: 'goals.hint.noDeadline', amount: null }
}

export const savedShare = (saved: number, target: number): number => (target > 0 ? Math.min(saved / target, 1) : 0)

export const monthKeyOfDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export const dateOfMonthKey = (key: string): Date => {
  const [year, month] = key.split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, 1)
}

export const linkableAccounts = (accounts: readonly AccountDto[], currentId: string | null): AccountDto[] =>
  accounts.filter((account) => account.id === currentId || (account.type === 'savings' && !account.archived))

export const contributionSources = (accounts: readonly AccountDto[], linkedId: string | null): AccountDto[] =>
  accounts.filter((account) => !account.archived && account.id !== linkedId)

export function receivedAmount(
  amount: number | null,
  rate: number | null,
  from: Currency,
  to: Currency,
): number | undefined {
  if (amount === null || amount <= 0 || rate === null || rate <= 0) return undefined
  return convertMinor(toMinor(amount, from), rate, from, to)
}
