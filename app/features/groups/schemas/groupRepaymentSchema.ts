import { helpers, required } from '@vuelidate/validators'
import { GROUP_NOTE_MAX } from '../../../shared/api/contract'
import type { Currency } from '../../../shared/money/currencies'
import { withinAmountLimit, withinRateLimit } from '../../../shared/money/money'
import { trimmedWithin } from '../../../shared/utils/text'
import { isPositiveOrEmpty, notAfter, requiredWhen } from '../../../shared/utils/validation'

export type GroupRepaymentForm = {
  fromMemberId: string | null
  toMemberId: string | null
  amount: number | null
  currency: Currency
  date: Date | null
  rate: number | null
  note: string
}

type Translate = (key: string) => string

type Siblings = Partial<Pick<GroupRepaymentForm, 'fromMemberId'>> | undefined

export const groupRepaymentRules = (
  t: Translate,
  options: { crossCurrency: () => boolean; currency: () => Currency; maxDate: () => Date },
) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  const invalidValue = () => t('validation.invalidValue')
  const positive = helpers.withMessage(() => t('validation.positiveAmount'), isPositiveOrEmpty)
  return {
    fromMemberId: { required: requiredField },
    toMemberId: {
      required: requiredField,
      differentMember: helpers.withMessage(
        () => t('validation.sameMember'),
        (value: unknown, siblings: Siblings) =>
          typeof value !== 'string' || siblings?.fromMemberId == null || value !== siblings.fromMemberId,
      ),
    },
    amount: {
      required: requiredField,
      positive,
      max: helpers.withMessage(invalidValue, withinAmountLimit(options.currency)),
    },
    currency: { required: requiredField },
    date: {
      required: requiredField,
      notTooFar: helpers.withMessage(() => t('validation.dateTooFar'), notAfter(options.maxDate)),
    },
    rate: {
      required: helpers.withMessage(() => t('validation.required'), requiredWhen(options.crossCurrency)),
      positive,
      max: helpers.withMessage(invalidValue, withinRateLimit),
    },
    note: { maxLength: helpers.withMessage(() => t('validation.noteTooLong'), trimmedWithin(GROUP_NOTE_MAX)) },
  }
}
