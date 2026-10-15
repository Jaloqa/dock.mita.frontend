import { helpers, maxLength, minValue, required, requiredIf } from '@vuelidate/validators'

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

export const isPositiveOrEmpty = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'number' && value > 0)

export const transferRules = (t: Translate, form: TransferForm, crossCurrency: () => boolean) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
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
      positive: helpers.withMessage(() => t('validation.positiveAmount'), minValue(0.01)),
    },
    date: { required: requiredField },
    rate: {
      required: helpers.withMessage(() => t('validation.required'), requiredIf(crossCurrency)),
      positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveOrEmpty),
    },
    note: { maxLength: helpers.withMessage(() => t('validation.noteTooLong'), maxLength(TRANSFER_NOTE_MAX)) },
  }
}
