import { allocateMinor, sumMinor } from '../../../shared/money/money'

export function equalPreview(
  amount: number,
  memberIds: readonly string[],
  payerId: string | null,
  order: readonly string[],
): Record<string, number> {
  const chosen = new Set(memberIds)
  const sharing = [...order.filter((id) => chosen.has(id)), ...[...chosen].filter((id) => !order.includes(id))]
  if (sharing.length === 0) return {}
  const payer = payerId === null ? -1 : sharing.indexOf(payerId)
  const others = sharing.map((_, index) => index).filter((index) => index !== payer)
  const shares = allocateMinor(
    Math.max(amount, 0),
    sharing.map(() => 1),
    payer < 0 ? others : [payer, ...others],
  )
  return Object.fromEntries(sharing.map((id, index) => [id, shares[index] ?? 0]))
}

export const exactLeft = (amount: number, shares: readonly number[]): number => amount - sumMinor(shares)
