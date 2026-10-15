import { helpers, maxLength, required } from '@vuelidate/validators'
import type { AccountType } from '../../../shared/api/contract'
import type { Currency } from '../../../shared/money/money'

export const ACCOUNT_NAME_MAX = 40

export type AccountForm = {
  name: string
  type: AccountType
  currency: Currency
  openingBalance: number | null
  cardLast4: string
}

type Translate = (key: string) => string

export const isCardLast4 = (value: unknown): boolean =>
  value === '' || value === null || value === undefined || (typeof value === 'string' && /^\d{4}$/.test(value))

export const accountRules = (t: Translate) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  return {
    name: {
      required: requiredField,
      maxLength: helpers.withMessage(() => t('validation.nameTooLong'), maxLength(ACCOUNT_NAME_MAX)),
    },
    type: { required: requiredField },
    currency: { required: requiredField },
    openingBalance: { required: requiredField },
    cardLast4: { cardLast4: helpers.withMessage(() => t('validation.cardLast4'), isCardLast4) },
  }
}
