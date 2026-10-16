import { helpers, required } from '@vuelidate/validators'
import { monthKeyOfDate } from '../utils/goalView'

export const GOAL_NAME_MAX = 40

export const GOAL_TARGET_MAX = 1_000_000_000

export type GoalForm = { name: string; target: number | null; deadline: Date | null; accountId: string | null }

type Translate = (key: string) => string

export const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim() !== ''

export const isNameWithinMax = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim().length <= GOAL_NAME_MAX

export const isPositiveAmount = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'number' && value > 0)

export const isWithinMax =
  (max: number) =>
  (value: unknown): boolean =>
    typeof value !== 'number' || value <= max

export const isDeadlineAllowed =
  (minMonth: () => string, original: () => string | null) =>
  (value: unknown): boolean => {
    if (!(value instanceof Date)) return true
    const key = monthKeyOfDate(value)
    return key >= minMonth() || key === original()
  }

export const goalRules = (
  t: Translate,
  options: { minMonth: () => string; originalDeadline: () => string | null },
) => ({
  name: {
    required: helpers.withMessage(() => t('validation.required'), hasText),
    maxLength: helpers.withMessage(() => t('validation.nameTooLong'), isNameWithinMax),
  },
  target: {
    required: helpers.withMessage(() => t('validation.required'), required),
    positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveAmount),
    max: helpers.withMessage(() => t('validation.invalidValue'), isWithinMax(GOAL_TARGET_MAX)),
  },
  deadline: {
    notPast: helpers.withMessage(
      () => t('validation.deadlinePast'),
      isDeadlineAllowed(options.minMonth, options.originalDeadline),
    ),
  },
  accountId: {},
})
