import { helpers, required } from '@vuelidate/validators'
import { COUNTERPARTY_MAX, DEBT_NOTE_MAX, type DebtDirection } from '../../../shared/api/contract'
import type { Currency } from '../../../shared/money/currencies'
import { withinAmountLimit, withinRateLimit } from '../../../shared/money/money'
import { fromLocalDate } from '../../../shared/period/period'
import { hasText, trimmedWithin } from '../../../shared/utils/text'

export type DebtForm = {
  direction: DebtDirection
  counterparty: string
  amount: number | null
  currency: Currency
  date: Date | null
  dueDate: Date | null
  accountId: string | null
  rate: number | null
  note: string
}

type Translate = (key: string) => string

export const isPositiveOrEmpty = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'number' && value > 0)

export const requiredWhen =
  (condition: () => boolean) =>
  (value: unknown): boolean =>
    !condition() || (value !== null && value !== undefined && value !== '')

export const notAfter =
  (limit: () => Date) =>
  (value: unknown): boolean =>
    !(value instanceof Date) || fromLocalDate(value) <= fromLocalDate(limit())

const notBeforeDate = (value: unknown, siblings: Partial<Pick<DebtForm, 'date'>> | undefined): boolean => {
  const date = siblings?.date
  return !(value instanceof Date) || !(date instanceof Date) || fromLocalDate(value) >= fromLocalDate(date)
}

export const debtRules = (
  t: Translate,
  options: { crossCurrency: () => boolean; currency: () => Currency; maxDate: () => Date },
) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  const invalidValue = () => t('validation.invalidValue')
  const positive = helpers.withMessage(() => t('validation.positiveAmount'), isPositiveOrEmpty)
  return {
    direction: { required: requiredField },
    counterparty: {
      required: helpers.withMessage(() => t('validation.required'), hasText),
      maxLength: helpers.withMessage(() => t('validation.nameTooLong'), trimmedWithin(COUNTERPARTY_MAX)),
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
    dueDate: { notBeforeDate: helpers.withMessage(() => t('validation.dueBeforeDate'), notBeforeDate) },
    accountId: {},
    rate: {
      required: helpers.withMessage(() => t('validation.required'), requiredWhen(options.crossCurrency)),
      positive,
      max: helpers.withMessage(invalidValue, withinRateLimit),
    },
    note: { maxLength: helpers.withMessage(() => t('validation.noteTooLong'), trimmedWithin(DEBT_NOTE_MAX)) },
  }
}
