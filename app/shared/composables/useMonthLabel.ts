import { monthKeyDate } from '~/shared/period/period'

export function useMonthLabel() {
  const { d } = useI18n()

  return (key: string, options: { withYear?: boolean } = {}): string =>
    d(monthKeyDate(key), {
      month: 'long',
      ...(options.withYear ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    })
}
