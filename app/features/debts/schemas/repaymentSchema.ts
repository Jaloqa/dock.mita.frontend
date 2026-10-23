import { helpers, required } from '@vuelidate/validators'
import { DEBT_NOTE_MAX } from '../../../shared/api/contract'
import type { Currency } from '../../../shared/money/currencies'
import { toMinor, withinAmountLimit, withinRateLimit } from '../../../shared/money/money'
import { trimmedWithin } from '../../../shared/utils/text'
import { isPositiveOrEmpty, notAfter, requiredWhen } from './debtSchema'

export type RepaymentForm = {
  amount: number | null
  currency: Currency
  date: Date | null
  rate: number | null
  accountId: string | null
  note: string
}

type Translate = (key: string) => string

const notAbove =
  (remaining: () => number | undefined, currency: () => Currency) =>
  (value: unknown): boolean => {
    const limit = remaining()
    return typeof value !== 'number' || limit === undefined || toMinor(value, currency()) <= limit
  }

export const repaymentRules = (
  t: Translate,
  options: {
    crossCurrency: () => boolean
    currency: () => Currency
    maxDate: () => Date
    remaining: () => number | undefined
  },
) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  const invalidValue = () => t('validation.invalidValue')
  const positive = helpers.withMessage(() => t('validation.positiveAmount'), isPositiveOrEmpty)
  return {
    amount: {
      required: requiredField,
      positive,
      max: helpers.withMessage(invalidValue, withinAmountLimit(options.currency)),
      notAboveRemaining: helpers.withMessage(
        () => t('validation.exceedsRemaining'),
        notAbove(options.remaining, options.currency),
      ),
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
    accountId: {},
    note: { maxLength: helpers.withMessage(() => t('validation.noteTooLong'), trimmedWithin(DEBT_NOTE_MAX)) },
  }
}
