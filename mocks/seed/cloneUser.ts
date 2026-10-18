import type { MockState } from '../db'
import { newId } from '../ids'

export function cloneUserData(state: MockState, fromUserId: string, toUserId: string): boolean {
  if (state.users.some((user) => user.id === toUserId)) return false
  const ids = new Map<string, string>()
  const remap = (id: string): string => {
    const existing = ids.get(id)
    if (existing !== undefined) return existing
    const created = newId(id.split('_')[0] ?? 'id')
    ids.set(id, created)
    return created
  }
  const remapNullable = (id: string | null): string | null => (id === null ? null : remap(id))
  const owned = <T extends { userId: string }>(rows: T[]): T[] =>
    structuredClone(rows.filter((row) => row.userId === fromUserId))

  state.accounts.push(...owned(state.accounts).map((row) => ({ ...row, id: remap(row.id), userId: toUserId })))
  state.categories.push(...owned(state.categories).map((row) => ({ ...row, id: remap(row.id), userId: toUserId })))
  state.transfers.push(
    ...owned(state.transfers).map((row) => ({
      ...row,
      id: remap(row.id),
      userId: toUserId,
      fromAccountId: remap(row.fromAccountId),
      toAccountId: remap(row.toAccountId),
    })),
  )
  state.transactions.push(
    ...owned(state.transactions).map((row) => ({
      ...row,
      id: remap(row.id),
      userId: toUserId,
      accountId: remap(row.accountId),
      categoryId: remap(row.categoryId),
    })),
  )
  state.budgets.push(
    ...owned(state.budgets).map((row) => ({
      ...row,
      id: remap(row.id),
      userId: toUserId,
      categoryId: remap(row.categoryId),
    })),
  )
  state.goals.push(
    ...owned(state.goals).map((row) => ({
      ...row,
      id: remap(row.id),
      userId: toUserId,
      accountId: remapNullable(row.accountId),
    })),
  )
  state.goalContributions.push(
    ...owned(state.goalContributions).map((row) => ({
      ...row,
      id: remap(row.id),
      userId: toUserId,
      goalId: remap(row.goalId),
      fromAccountId: remapNullable(row.fromAccountId),
      transferId: remapNullable(row.transferId),
    })),
  )
  state.settings.push(...owned(state.settings).map((row) => ({ ...row, userId: toUserId })))
  state.users.push({
    id: toUserId,
    name: 'Demo user',
    email: `${toUserId}@demo.mita.app`,
    createdAt: new Date().toISOString(),
  })
  return true
}
