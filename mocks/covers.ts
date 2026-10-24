import type { GroupCoverDto, GroupRepaymentCoverDto, OpenShareDto } from '../app/shared/api/contract'
import { sumMinor } from '../app/shared/money/money'
import type { GroupRepaymentRow, MockState } from './db'

export type OpenAmount = Pick<OpenShareDto, 'expenseId' | 'open'>

type CoverState = Pick<MockState, 'groupExpenses' | 'groupRepayments' | 'groupRepaymentCovers'>

function take(amount: number, ordered: readonly OpenAmount[]): GroupCoverDto[] {
  const covers: GroupCoverDto[] = []
  let left = amount
  for (const { expenseId, open } of ordered) {
    const groupAmount = Math.min(left, open)
    if (groupAmount <= 0) continue
    covers.push({ expenseId, groupAmount })
    left -= groupAmount
  }
  return covers
}

export function allocateCovers(
  amount: number,
  shares: readonly OpenAmount[],
  requested: readonly string[],
): GroupCoverDto[] {
  const first = new Set(requested)
  return take(amount, [
    ...shares.filter((share) => first.has(share.expenseId)),
    ...shares.filter((share) => !first.has(share.expenseId)),
  ])
}

export function reallocateCovers(
  amount: number,
  shares: readonly OpenAmount[],
  previous: readonly string[],
): GroupCoverDto[] {
  const open = new Map(shares.map((share) => [share.expenseId, share.open]))
  const first = new Set(previous)
  return take(amount, [
    ...previous.flatMap((expenseId) => {
      const amountOpen = open.get(expenseId)
      return amountOpen === undefined ? [] : [{ expenseId, open: amountOpen }]
    }),
    ...shares.filter((share) => !first.has(share.expenseId)),
  ])
}

export const coversOf = (state: Pick<MockState, 'groupRepaymentCovers'>, repaymentId: string): GroupCoverDto[] =>
  state.groupRepaymentCovers
    .filter((row) => row.repaymentId === repaymentId)
    .sort((a, b) => a.position - b.position)
    .map(({ expenseId, groupAmount }) => ({ expenseId, groupAmount }))

export const coverViews = (state: MockState, repaymentId: string): GroupRepaymentCoverDto[] =>
  coversOf(state, repaymentId).flatMap((cover) => {
    const expense = state.groupExpenses.find((row) => row.id === cover.expenseId)
    return expense ? [{ ...cover, description: expense.description, categoryId: expense.categoryId }] : []
  })

export function replaceCovers(
  state: Pick<MockState, 'groupRepaymentCovers'>,
  repayment: Pick<GroupRepaymentRow, 'id' | 'groupId'>,
  covers: readonly GroupCoverDto[],
): void {
  state.groupRepaymentCovers = [
    ...state.groupRepaymentCovers.filter((row) => row.repaymentId !== repayment.id),
    ...covers.map((cover, position) => ({
      repaymentId: repayment.id,
      expenseId: cover.expenseId,
      groupId: repayment.groupId,
      groupAmount: cover.groupAmount,
      position,
    })),
  ]
}

export function openShares(
  state: CoverState,
  groupId: string,
  debtorId: string,
  creditorId?: string,
  excludedRepaymentId?: string,
): OpenShareDto[] {
  const counted = new Set(
    state.groupRepayments
      .filter(
        (row) =>
          row.groupId === groupId && !row.deleted && row.fromMemberId === debtorId && row.id !== excludedRepaymentId,
      )
      .map((row) => row.id),
  )
  const covered = (expenseId: string): number =>
    sumMinor(
      state.groupRepaymentCovers
        .filter((row) => row.expenseId === expenseId && counted.has(row.repaymentId))
        .map((row) => row.groupAmount),
    )
  return state.groupExpenses
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        row.groupId === groupId &&
        !row.deleted &&
        row.payerId !== debtorId &&
        (creditorId === undefined || row.payerId === creditorId),
    )
    .sort((a, b) => a.row.date.localeCompare(b.row.date) || a.index - b.index)
    .flatMap(({ row }) => {
      const share = row.shares.find((item) => item.memberId === debtorId)
      if (!share) return []
      const open = Math.max(0, share.groupAmount - covered(row.id))
      if (open <= 0) return []
      return [
        {
          expenseId: row.id,
          payerId: row.payerId,
          date: row.date,
          description: row.description,
          categoryId: row.categoryId,
          share: share.groupAmount,
          open,
        },
      ]
    })
}
