import type { GroupMemberBalanceDto, GroupTransferDto } from '../../../shared/api/contract'

export type BalanceKind = 'getsBack' | 'owes' | 'settled'

export type ShownBalance = { memberId: string; balance: number; kind: BalanceKind }

export type ShownTransfer = { transfer: GroupTransferDto; amount: number }

export const balanceKind = (balance: number): BalanceKind => {
  if (balance > 0) return 'getsBack'
  return balance < 0 ? 'owes' : 'settled'
}

export function balancesIn(
  main: readonly GroupMemberBalanceDto[],
  shown: readonly GroupMemberBalanceDto[],
): ShownBalance[] {
  return main.flatMap((entry) => {
    const match = shown.find((candidate) => candidate.memberId === entry.memberId)
    return match ? [{ memberId: entry.memberId, balance: match.balance, kind: balanceKind(entry.balance) }] : []
  })
}

export function transfersIn(main: readonly GroupTransferDto[], shown: readonly GroupTransferDto[]): ShownTransfer[] {
  const left = [...shown]
  return main.flatMap((transfer) => {
    const index = left.findIndex(
      (candidate) => candidate.fromMemberId === transfer.fromMemberId && candidate.toMemberId === transfer.toMemberId,
    )
    if (index < 0) return []
    const [match] = left.splice(index, 1)
    return match ? [{ transfer, amount: match.amount }] : []
  })
}
