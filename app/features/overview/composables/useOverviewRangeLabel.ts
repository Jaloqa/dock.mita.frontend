import { sameYear } from '../utils/overviewView'

export function useOverviewRangeLabel() {
  const { t, d } = useI18n()

  const day = (iso: string, withYear: boolean) =>
    d(new Date(`${iso}T00:00:00Z`), {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' as const } : {}),
      timeZone: 'UTC',
    })

  return (from: string, to: string): string =>
    t('shared.period.range', { from: day(from, !sameYear(from, to)), to: day(to, true) })
}
