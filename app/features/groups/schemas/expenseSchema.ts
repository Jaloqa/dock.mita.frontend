import { helpers, required } from '@vuelidate/validators'
import {
  EXPENSE_DESCRIPTION_MAX,
  type GroupSplitMode,
  TAG_NAME_MAX,
  TAGS_PER_TRANSACTION_MAX,
} from '../../../shared/api/contract'
import type { Currency } from '../../../shared/money/currencies'
import { sumMinor, toMinor, withinAmountLimit, withinRateLimit } from '../../../shared/money/money'
import { trimmedWithin } from '../../../shared/utils/text'
import { isPositiveOrEmpty, notAfter, requiredWhen } from '../../../shared/utils/validation'

export type ExpenseForm = {
  payerId: string | null
  amount: number | null
  currency: Currency
  date: Date | null
  categoryId: string
  tags: string[]
  description: string
  rate: number | null
  splitMode: GroupSplitMode
  memberIds: string[]
  exact: Record<string, number | null>
}

type Translate = (key: string) => string

type SplitSiblings = Partial<Pick<ExpenseForm, 'splitMode'>> | undefined

const tagList = (check: (tags: string[]) => boolean) => (value: unknown) =>
  !Array.isArray(value) || check(value.filter((tag) => typeof tag === 'string'))

export const exactMinors = (exact: Record<string, number | null>, currency: Currency): number[] =>
  Object.values(exact).flatMap((value) => (typeof value === 'number' ? [toMinor(value, currency)] : []))

export const expenseRules = (
  t: Translate,
  options: {
    crossCurrency: () => boolean
    currency: () => Currency
    maxDate: () => Date
    exactTotal: () => number | undefined
  },
) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  const invalidValue = () => t('validation.invalidValue')
  const positive = helpers.withMessage(() => t('validation.positiveAmount'), isPositiveOrEmpty)
  const addsUp = (value: unknown, siblings: SplitSiblings): boolean => {
    const total = options.exactTotal()
    if (siblings?.splitMode !== 'exact' || total === undefined) return true
    if (typeof value !== 'object' || value === null) return false
    return sumMinor(exactMinors(value as Record<string, number | null>, options.currency())) === total
  }
  return {
    payerId: { required: requiredField },
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
    categoryId: {},
    tags: {
      tooMany: helpers.withMessage(
        () => t('validation.tooManyTags'),
        tagList((tags) => tags.length <= TAGS_PER_TRANSACTION_MAX),
      ),
      tooLong: helpers.withMessage(
        () => t('validation.tagTooLong'),
        tagList((tags) => tags.every(trimmedWithin(TAG_NAME_MAX))),
      ),
    },
    description: {
      maxLength: helpers.withMessage(() => t('validation.titleTooLong'), trimmedWithin(EXPENSE_DESCRIPTION_MAX)),
    },
    rate: {
      required: helpers.withMessage(() => t('validation.required'), requiredWhen(options.crossCurrency)),
      positive,
      max: helpers.withMessage(invalidValue, withinRateLimit),
    },
    splitMode: {},
    memberIds: {
      chooseMembers: helpers.withMessage(
        () => t('groups.expense.chooseMembers'),
        (value: unknown, siblings: SplitSiblings) =>
          siblings?.splitMode !== 'equal' || (Array.isArray(value) && value.length > 0),
      ),
    },
    exact: { splitMismatch: helpers.withMessage(() => t('validation.splitMismatch'), addsUp) },
  }
}
