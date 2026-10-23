import { helpers, required } from '@vuelidate/validators'
import { GROUP_MEMBERS_MAX, GROUP_NAME_MAX } from '../../../shared/api/contract'
import type { Currency } from '../../../shared/money/currencies'
import { hasText, trimmedWithin } from '../../../shared/utils/text'

export type GroupForm = {
  name: string
  currency: Currency
  members: string[]
}

type Translate = (key: string) => string

const nameKey = (name: string): string => name.trim().toLocaleLowerCase()

const filled = (rows: readonly string[]): string[] => rows.filter(hasText)

export function faultyMemberRows(rows: readonly string[]): Set<number> {
  const faulty = new Set<number>()
  if (!rows.some(hasText)) faulty.add(0)
  const seen = new Set<string>()
  rows.forEach((row, index) => {
    if (!hasText(row)) return
    if (!trimmedWithin(GROUP_NAME_MAX)(row)) faulty.add(index)
    const key = nameKey(row)
    if (seen.has(key)) faulty.add(index)
    seen.add(key)
  })
  return faulty
}

export const groupRules = (t: Translate, options: { creating: () => boolean }) => {
  const onMembers =
    (check: (rows: string[]) => boolean) =>
    (value: unknown): boolean =>
      !options.creating() || !Array.isArray(value) || check(value.filter((row) => typeof row === 'string'))

  return {
    name: {
      required: helpers.withMessage(() => t('validation.required'), hasText),
      maxLength: helpers.withMessage(() => t('validation.nameTooLong'), trimmedWithin(GROUP_NAME_MAX)),
    },
    currency: { required: helpers.withMessage(() => t('validation.required'), required) },
    members: {
      required: helpers.withMessage(
        () => t('validation.required'),
        onMembers((rows) => filled(rows).length > 0),
      ),
      nameLength: helpers.withMessage(
        () => t('validation.nameTooLong'),
        onMembers((rows) => rows.every(trimmedWithin(GROUP_NAME_MAX))),
      ),
      maxCount: helpers.withMessage(
        () => t('validation.tooManyMembers'),
        onMembers((rows) => filled(rows).length <= GROUP_MEMBERS_MAX),
      ),
      unique: helpers.withMessage(
        () => t('validation.memberNameTaken'),
        onMembers((rows) => new Set(filled(rows).map(nameKey)).size === filled(rows).length),
      ),
    },
  }
}
