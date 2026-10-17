import { wholePercentOptions } from '../utils/reportsView'

export function useReportPercent() {
  const { n } = useI18n()

  return {
    share: (percent: number) =>
      n(percent / 100, { key: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    whole: (percent: number) => n(percent / 100, { key: 'percent', ...wholePercentOptions }),
  }
}
