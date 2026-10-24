import { helpers, required } from '@vuelidate/validators'
import { TAG_NAME_MAX, TAGS_PER_TRANSACTION_MAX } from '../../../shared/api/contract'
import { withinRateLimit } from '../../../shared/money/money'
import { trimmedWithin } from '../../../shared/utils/text'
import { isPositiveOrEmpty, requiredWhen } from '../../../shared/utils/validation'

const CONFIRM_TITLE_MAX = 100

export const NEW_CATEGORY = '__new__'

export type ConfirmLineForm = {
  categoryId: string | null
  newCategory: string | null
  title: string
  tags: string[]
}

export type ConfirmForm = {
  accountId: string | null
  rate: number | null
  lines: ConfirmLineForm[]
}

type Translate = (key: string) => string

const tagList = (check: (tags: string[]) => boolean) => (value: unknown) =>
  !Array.isArray(value) || check(value.filter((tag) => typeof tag === 'string'))

export const confirmLineRules = (t: Translate) => ({
  categoryId: { required: helpers.withMessage(() => t('validation.required'), required) },
  title: { maxLength: helpers.withMessage(() => t('validation.titleTooLong'), trimmedWithin(CONFIRM_TITLE_MAX)) },
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
})

export const confirmRules = (t: Translate, options: { crossCurrency: () => boolean }) => ({
  accountId: { required: helpers.withMessage(() => t('validation.required'), required) },
  rate: {
    required: helpers.withMessage(() => t('validation.required'), requiredWhen(options.crossCurrency)),
    positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveOrEmpty),
    max: helpers.withMessage(() => t('validation.invalidValue'), withinRateLimit),
  },
  lines: { $each: helpers.forEach(confirmLineRules(t)) },
})
