import { helpers, required } from '@vuelidate/validators'

export const BUDGET_LIMIT_MAX = 1_000_000_000

export type BudgetForm = { categoryId: string | null; limit: number | null }

type Translate = (key: string) => string

export const isPositiveLimit = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'number' && value > 0)

export const isWithinLimitMax = (value: unknown): boolean => typeof value !== 'number' || value <= BUDGET_LIMIT_MAX

export const budgetRules = (t: Translate) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  return {
    categoryId: { required: requiredField },
    limit: {
      required: requiredField,
      positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveLimit),
      max: helpers.withMessage(() => t('validation.invalidValue'), isWithinLimitMax),
    },
  }
}
