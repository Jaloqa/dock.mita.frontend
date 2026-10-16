export function useOverviewPercent() {
  const { n } = useI18n()

  return {
    share: (percent: number) =>
      n(percent / 100, { key: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    whole: (percent: number) => n(percent / 100, { key: 'percent', maximumFractionDigits: 0 }),
    change: (percent: number) =>
      n(percent / 100, {
        key: 'percent',
        signDisplay: 'exceptZero',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
  }
}
