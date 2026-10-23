import { helpers, required } from '@vuelidate/validators'
import { emailRules } from '../../../shared/utils/email'

export const PROFILE_NAME_MAX = 40

export type ProfileForm = { name: string; email: string }

type Translate = (key: string) => string

export const fitsProfileName = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim().length <= PROFILE_NAME_MAX

export const profileRules = (t: Translate) => ({
  name: {
    required: helpers.withMessage(() => t('validation.required'), required),
    maxLength: helpers.withMessage(() => t('validation.nameTooLong'), fitsProfileName),
  },
  email: emailRules(t),
})
