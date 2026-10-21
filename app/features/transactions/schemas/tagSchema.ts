import { helpers, required } from '@vuelidate/validators'
import { TAG_NAME_MAX } from '../../../shared/api/contract'

export type TagForm = { name: string }

type Translate = (key: string) => string

const normalized = (name: string): string => name.trim().toLocaleLowerCase()

export const tagRules = (t: Translate, takenNames: () => readonly string[]) => ({
  name: {
    required: helpers.withMessage(() => t('validation.required'), required),
    tooLong: helpers.withMessage(
      () => t('validation.tagTooLong'),
      (value: unknown) => typeof value !== 'string' || value.trim().length <= TAG_NAME_MAX,
    ),
    taken: helpers.withMessage(
      () => t('validation.tagNameTaken'),
      (value: unknown) =>
        typeof value !== 'string' || !takenNames().some((name) => normalized(name) === normalized(value)),
    ),
  },
})
