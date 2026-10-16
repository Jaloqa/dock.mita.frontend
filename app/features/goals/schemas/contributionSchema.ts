import { helpers, required } from '@vuelidate/validators'
import { isPositiveAmount, isWithinMax } from './goalSchema'

export const CONTRIBUTION_AMOUNT_MAX = 1_000_000_000

export type ContributionForm = {
  amount: number | null
  fromAccountId: string | null
  date: Date | null
  rate: number | null
}

type Translate = (key: string) => string

export const requiredWhen =
  (condition: () => boolean) =>
  (value: unknown): boolean =>
    !condition() || (value !== null && value !== undefined && value !== '')

export const contributionRules = (t: Translate, options: { linked: () => boolean; crossCurrency: () => boolean }) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  return {
    amount: {
      required: requiredField,
      positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveAmount),
      max: helpers.withMessage(() => t('validation.invalidValue'), isWithinMax(CONTRIBUTION_AMOUNT_MAX)),
    },
    fromAccountId: { required: helpers.withMessage(() => t('validation.required'), requiredWhen(options.linked)) },
    date: { required: requiredField },
    rate: {
      required: helpers.withMessage(() => t('validation.required'), requiredWhen(options.crossCurrency)),
      positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveAmount),
    },
  }
}
