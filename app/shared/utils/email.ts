import { helpers, required } from '@vuelidate/validators'

export const EMAIL_MAX = 254

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

export const isEmailAddress = (value: unknown): boolean => {
  if (isBlank(value)) return true
  if (typeof value !== 'string') return false
  const address = value.trim()
  return address.length <= EMAIL_MAX && EMAIL_PATTERN.test(address)
}

export const emailRules = (t: (key: string) => string) => ({
  required: helpers.withMessage(() => t('validation.required'), required),
  format: helpers.withMessage(() => t('validation.invalidEmail'), isEmailAddress),
})
