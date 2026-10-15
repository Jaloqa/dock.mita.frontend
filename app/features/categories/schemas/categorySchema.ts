import { helpers, required } from '@vuelidate/validators'
import { type CategoryColor, categoryColors } from '../../../shared/api/contract'

export const CATEGORY_NAME_MAX = 40

export type CategoryForm = { name: string; color: CategoryColor }

type Translate = (key: string) => string

const normalized = (name: string): string => name.trim().toLocaleLowerCase()

export const isUniqueName =
  (takenNames: () => readonly string[]) =>
  (value: unknown): boolean =>
    typeof value !== 'string' || !takenNames().some((name) => normalized(name) === normalized(value))

const fitsTrimmed = (value: unknown): boolean => typeof value !== 'string' || value.trim().length <= CATEGORY_NAME_MAX

export const categoryRules = (t: Translate, takenNames: () => readonly string[]) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  return {
    name: {
      required: requiredField,
      maxLength: helpers.withMessage(() => t('validation.nameTooLong'), fitsTrimmed),
      unique: helpers.withMessage(() => t('validation.categoryNameTaken'), isUniqueName(takenNames)),
    },
    color: { required: requiredField },
  }
}

export function suggestColor(categories: readonly { color: CategoryColor }[]): CategoryColor {
  const usage = (color: CategoryColor) => categories.filter((category) => category.color === color).length
  return categoryColors.reduce<CategoryColor>((best, color) => (usage(color) < usage(best) ? color : best), 'chart-1')
}
