import { helpers, required } from '@vuelidate/validators'
import type { Currency } from '../../../shared/money/currencies'
import { withinAmountLimit, withinRateLimit } from '../../../shared/money/money'
import { isPositiveOrEmpty, requiredWhen } from '../../../shared/utils/validation'

export type ContributionForm = {
  amount: number | null
  fromAccountId: string | null
  date: Date | null
  rate: number | null
}

type Translate = (key: string) => string

export const contributionRules = (
  t: Translate,
  options: { linked: () => boolean; crossCurrency: () => boolean; currency: () => Currency },
) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  const invalidValue = () => t('validation.invalidValue')
  return {
    amount: {
      required: requiredField,
      positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveOrEmpty),
      max: helpers.withMessage(invalidValue, withinAmountLimit(options.currency)),
    },
    fromAccountId: { required: helpers.withMessage(() => t('validation.required'), requiredWhen(options.linked)) },
    date: { required: requiredField },
    rate: {
      required: helpers.withMessage(() => t('validation.required'), requiredWhen(options.crossCurrency)),
      positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveOrEmpty),
      max: helpers.withMessage(invalidValue, withinRateLimit),
    },
  }
}
