import { helpers, maxLength, required, requiredIf } from '@vuelidate/validators'
import { type CategoryKind, TAG_NAME_MAX, TAGS_PER_TRANSACTION_MAX } from '../../../shared/api/contract'
import { AMOUNT_MINOR_MAX, type Currency } from '../../../shared/money/currencies'
import { withinAmountLimit, withinRateLimit } from '../../../shared/money/money'

export const TRANSACTION_TITLE_MAX = 100
export const TRANSACTION_NOTE_MAX = 200

export type TransactionForm = {
  kind: CategoryKind
  amount: number | null
  currency: Currency
  rate: number | null
  categoryId: string | null
  accountId: string | null
  date: Date | null
  title: string
  note: string
  tags: string[]
}

type Translate = (key: string) => string

export const isPositiveOrEmpty = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'number' && value > 0)

export const isPositiveMinor = (value: unknown): boolean =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

export const notAfter =
  (limit: () => Date) =>
  (value: unknown): boolean =>
    !(value instanceof Date) || value.getTime() <= limit().getTime()

export const transactionRules = (
  t: Translate,
  options: { crossCurrency: () => boolean; maxDate: () => Date; currency: () => Currency },
) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  const invalidValue = () => t('validation.invalidValue')
  return {
    kind: { required: requiredField },
    amount: {
      required: requiredField,
      positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveOrEmpty),
      max: helpers.withMessage(invalidValue, withinAmountLimit(options.currency)),
    },
    currency: { required: requiredField },
    rate: {
      required: helpers.withMessage(() => t('validation.required'), requiredIf(options.crossCurrency)),
      positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveOrEmpty),
      max: helpers.withMessage(invalidValue, withinRateLimit),
    },
    categoryId: { required: requiredField },
    accountId: { required: requiredField },
    date: {
      required: requiredField,
      notTooFar: helpers.withMessage(() => t('validation.dateTooFar'), notAfter(options.maxDate)),
    },
    title: { maxLength: helpers.withMessage(() => t('validation.titleTooLong'), maxLength(TRANSACTION_TITLE_MAX)) },
    note: { maxLength: helpers.withMessage(() => t('validation.noteTooLong'), maxLength(TRANSACTION_NOTE_MAX)) },
    tags: {
      tooMany: helpers.withMessage(
        () => t('validation.tooManyTags'),
        (value: string[]) => value.length <= TAGS_PER_TRANSACTION_MAX,
      ),
      tooLong: helpers.withMessage(
        () => t('validation.tagTooLong'),
        (value: string[]) => value.every((name) => name.trim().length <= TAG_NAME_MAX),
      ),
    },
  }
}

export const quickAddRules = (t: Translate) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  return {
    amount: {
      positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveMinor),
      max: helpers.withMessage(
        () => t('validation.invalidValue'),
        (value: unknown) => typeof value !== 'number' || value <= AMOUNT_MINOR_MAX,
      ),
    },
    categoryId: { required: requiredField },
    accountId: { required: requiredField },
  }
}
