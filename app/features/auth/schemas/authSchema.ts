import { helpers, maxLength, minLength, required } from '@vuelidate/validators'

export const NAME_MAX = 40
export const EMAIL_MAX = 254
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 128

export type LoginFields = { email: string; password: string }
export type RegisterFields = { name: string; email: string; password: string }

type Translate = (key: string) => string

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

const fitsName = (value: unknown): boolean => typeof value !== 'string' || value.trim().length <= NAME_MAX

export const isEmailAddress = (value: unknown): boolean => {
  if (isBlank(value)) return true
  if (typeof value !== 'string') return false
  const address = value.trim()
  return address.length <= EMAIL_MAX && EMAIL_PATTERN.test(address)
}

const emailRules = (t: Translate) => ({
  required: helpers.withMessage(() => t('validation.required'), required),
  format: helpers.withMessage(() => t('validation.invalidEmail'), isEmailAddress),
})

export const loginRules = (t: Translate) => ({
  email: emailRules(t),
  password: { required: helpers.withMessage(() => t('validation.required'), required) },
})

export const registerRules = (t: Translate) => ({
  name: {
    required: helpers.withMessage(() => t('validation.required'), required),
    maxLength: helpers.withMessage(() => t('validation.nameTooLong'), fitsName),
  },
  email: emailRules(t),
  password: {
    required: helpers.withMessage(() => t('validation.required'), required),
    minLength: helpers.withMessage(() => t('validation.passwordTooShort'), minLength(PASSWORD_MIN)),
    maxLength: helpers.withMessage(() => t('validation.passwordTooLong'), maxLength(PASSWORD_MAX)),
  },
})
