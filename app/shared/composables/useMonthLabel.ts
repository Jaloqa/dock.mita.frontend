import { monthKeyDate } from '~/shared/period/period'
import { capitalizeFirst } from '~/shared/utils/text'

export function useMonthLabel() {
  const { d, locale } = useI18n()

  return (key: string, options: { withYear?: boolean; capitalize?: boolean } = {}): string => {
    const date = monthKeyDate(key)
    const month = d(date, { month: 'long', timeZone: 'UTC' })
    const label = options.withYear ? `${month} ${date.getUTCFullYear()}` : month
    return options.capitalize ? capitalizeFirst(label, locale.value) : label
  }
}
