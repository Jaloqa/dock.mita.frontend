import type { BudgetDto, BudgetStatus, CategoryDto } from '../../../shared/api/contract'
import { pickableCategories } from '../../../shared/categories/select'
import { isPeriodKey } from '../../../shared/period/period'

export const statusLabelKey: Record<BudgetStatus, string> = {
  on_track: 'budgets.status.onTrack',
  almost_spent: 'budgets.status.almostSpent',
  over_budget: 'budgets.status.overBudget',
}

export const statusBadgeClass: Record<BudgetStatus, string> = {
  on_track: 'bg-bg text-muted',
  almost_spent: 'bg-deep-muted text-deep',
  over_budget: 'bg-ink text-surface',
}

export const statusBarTone = (status: BudgetStatus): 'accent' | 'ink' => (status === 'over_budget' ? 'ink' : 'accent')

export const spentShare = (spent: number, limit: number): number => (limit > 0 ? spent / limit : 0)

export function budgetableCategories(
  categories: readonly CategoryDto[],
  budgets: readonly Pick<BudgetDto, 'categoryId'>[],
): CategoryDto[] {
  const taken = new Set(budgets.map((budget) => budget.categoryId))
  return pickableCategories(categories, 'expense').filter((category) => !taken.has(category.id))
}

export const resolvePeriodKey = (value: unknown, fallback: string): string => (isPeriodKey(value) ? value : fallback)
