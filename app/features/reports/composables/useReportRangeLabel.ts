import { rangeEnds, sameYear } from '../utils/reportsView'

export function useReportRangeLabel() {
  const { t } = useI18n()
  const monthLabel = useMonthLabel()

  return (periods: readonly { period: string }[]): string => {
    const ends = rangeEnds(periods)
    if (!ends) return ''
    return t('shared.period.range', {
      from: monthLabel(ends.first, { withYear: !sameYear(ends.first, ends.last) }),
      to: monthLabel(ends.last, { withYear: true }),
    })
  }
}
