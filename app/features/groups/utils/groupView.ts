import {
  type GroupActorDto,
  type GroupDto,
  type GroupExpenseDto,
  type GroupRepaymentDto,
  type StandardGroupCategory,
  standardGroupCategories,
} from '../../../shared/api/contract'

type Translate = (key: string, named?: Record<string, unknown>) => string

const isStandardCategory = (id: string): id is StandardGroupCategory =>
  standardGroupCategories.includes(id as StandardGroupCategory)

export const memberName = (group: Pick<GroupDto, 'members'>, id: string): string =>
  group.members.find((member) => member.id === id)?.name ?? ''

export function categoryLabel(t: Translate, group: Pick<GroupDto, 'categories'>, categoryId: string): string {
  if (isStandardCategory(categoryId)) return t(`groups.categories.${categoryId}`)
  return group.categories.find((category) => category.id === categoryId)?.name ?? t('groups.categories.other')
}

export const actorName = (actor: GroupActorDto): string => actor.name

export const expenseTitle = (
  t: Translate,
  group: Pick<GroupDto, 'categories'>,
  expense: Pick<GroupExpenseDto, 'description' | 'categoryId'>,
): string => expense.description ?? categoryLabel(t, group, expense.categoryId)

export const repaymentTitle = (
  t: Translate,
  group: Pick<GroupDto, 'members'>,
  repayment: Pick<GroupRepaymentDto, 'fromMemberId' | 'toMemberId'>,
): string =>
  t('groups.repayment.title', {
    from: memberName(group, repayment.fromMemberId),
    to: memberName(group, repayment.toMemberId),
  })

export function entryAccess(group: Pick<GroupDto, 'members'>): {
  canAddExpense: boolean
  canRecordRepayment: boolean
  hint: 'noMembers' | 'oneMember' | undefined
} {
  const count = group.members.length
  const hint = count === 0 ? 'noMembers' : count === 1 ? 'oneMember' : undefined
  return { canAddExpense: count >= 1, canRecordRepayment: count >= 2, hint }
}

export function sharingMembers(
  group: Pick<GroupDto, 'members'>,
  expense: Pick<GroupExpenseDto, 'shares'>,
): { everyone: boolean; names: string[] } {
  const sharing = new Set(expense.shares.map((share) => share.memberId))
  const everyone =
    group.members.length > 0 &&
    sharing.size === group.members.length &&
    group.members.every((member) => sharing.has(member.id))
  return { everyone, names: group.members.filter((member) => sharing.has(member.id)).map((member) => member.name) }
}

export function splitSummary(
  t: Translate,
  group: Pick<GroupDto, 'members'>,
  expense: Pick<GroupExpenseDto, 'split' | 'shares'>,
): string {
  if (expense.split === 'exact') return t('groups.expense.summary.exact')
  const { everyone, names } = sharingMembers(group, expense)
  if (everyone) return t('groups.expense.summary.everyone')
  return t('groups.expense.summary.some', { names: names.join(', ') })
}
