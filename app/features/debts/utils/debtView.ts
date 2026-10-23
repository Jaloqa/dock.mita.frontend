import type { DebtDto } from '../../../shared/api/contract'
import { type Currency, convertMinor, toMinor } from '../../../shared/money/money'

export const repaidShare = (debt: Pick<DebtDto, 'amount' | 'repaid'>): number =>
  debt.amount > 0 ? Math.min(Math.max(debt.repaid / debt.amount, 0), 1) : 0

export type GroupDebtKind = 'getsBack' | 'owes' | 'settled'

export function groupDebtKind(balance: number): GroupDebtKind {
  if (balance > 0) return 'getsBack'
  return balance < 0 ? 'owes' : 'settled'
}

export function convertedPreview(
  amount: number | null,
  rate: number | null,
  from: Currency,
  to: Currency,
): number | undefined {
  if (amount === null || amount <= 0 || rate === null || rate <= 0) return undefined
  return convertMinor(toMinor(amount, from), rate, from, to)
}
