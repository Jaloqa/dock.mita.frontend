import { helpers } from '@vuelidate/validators'
import { GROUP_NAME_MAX } from '../../../shared/api/contract'
import { hasText, trimmedWithin } from '../../../shared/utils/text'
import { nameKey } from './groupSchema'

export type MemberNameForm = { name: string }

type Translate = (key: string) => string

export const memberNameRules = (t: Translate, takenNames: () => readonly string[]) => ({
  name: {
    required: helpers.withMessage(() => t('validation.required'), hasText),
    maxLength: helpers.withMessage(() => t('validation.nameTooLong'), trimmedWithin(GROUP_NAME_MAX)),
    unique: helpers.withMessage(
      () => t('validation.memberNameTaken'),
      (value: unknown) => typeof value !== 'string' || !takenNames().some((name) => nameKey(name) === nameKey(value)),
    ),
  },
})
