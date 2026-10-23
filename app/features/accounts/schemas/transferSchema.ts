import { helpers, maxLength, required, requiredIf } from '@vuelidate/validators'
import type { Currency } from '../../../shared/money/currencies'
import { withinAmountLimit, withinRateLimit } from '../../../shared/money/money'
import { isPositiveOrEmpty } from '../../../shared/utils/validation'

export const TRANSFER_NOTE_MAX = 200

export type TransferForm = {
  fromAccountId: string | null
  toAccountId: string | null
  amount: number | null
  date: Date | null
  rate: number | null
  note: string
}

type Translate = (key: string) => string

export const differentFrom =
  (other: () => string | null) =>
  (value: unknown): boolean =>
    value === null || value === undefined || value !== other()

export const transferRules = (
  t: Translate,
  form: TransferForm,
  options: { crossCurrency: () => boolean; currency: () => Currency },
) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  const invalidValue = () => t('validation.invalidValue')
  return {
    fromAccountId: { required: requiredField },
    toAccountId: {
      required: requiredField,
      different: helpers.withMessage(
        () => t('validation.sameAccount'),
        differentFrom(() => form.fromAccountId),
      ),
    },
    amount: {
      required: requiredField,
      positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveOrEmpty),
      max: helpers.withMessage(invalidValue, withinAmountLimit(options.currency)),
    },
    date: { required: requiredField },
    rate: {
      required: helpers.withMessage(() => t('validation.required'), requiredIf(options.crossCurrency)),
      positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveOrEmpty),
      max: helpers.withMessage(invalidValue, withinRateLimit),
    },
    note: { maxLength: helpers.withMessage(() => t('validation.noteTooLong'), maxLength(TRANSFER_NOTE_MAX)) },
  }
}
