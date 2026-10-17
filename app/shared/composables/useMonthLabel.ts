import { monthKeyDate } from '~/shared/period/period'

export function useMonthLabel() {
  const { d } = useI18n()

  return (key: string, options: { withYear?: boolean } = {}): string => {
    const date = monthKeyDate(key)
    const month = d(date, { month: 'long', timeZone: 'UTC' })
    return options.withYear ? `${month} ${date.getUTCFullYear()}` : month
  }
}
