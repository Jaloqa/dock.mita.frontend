import { helpers, required } from '@vuelidate/validators'

export const PROFILE_NAME_MAX = 40
export const EMAIL_MAX = 254

export type ProfileForm = { name: string; email: string }

type Translate = (key: string) => string

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

export const fitsProfileName = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim().length <= PROFILE_NAME_MAX

export const isEmailAddress = (value: unknown): boolean => {
  if (isBlank(value)) return true
  if (typeof value !== 'string') return false
  const address = value.trim()
  return address.length <= EMAIL_MAX && EMAIL_PATTERN.test(address)
}

export const profileRules = (t: Translate) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  return {
    name: {
      required: requiredField,
      maxLength: helpers.withMessage(() => t('validation.nameTooLong'), fitsProfileName),
    },
    email: {
      required: requiredField,
      format: helpers.withMessage(() => t('validation.invalidEmail'), isEmailAddress),
    },
  }
}
