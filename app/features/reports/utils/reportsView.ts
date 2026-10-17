import { isReportRange, type ReportDto, type ReportRange } from '../../../shared/api/contract'

type ReportFacts = Pick<ReportDto, 'hasTransactions' | 'totals'>

export type ReportState = 'noTransactions' | 'noData' | 'ready'

export const wholePercentOptions = { maximumFractionDigits: 0, signDisplay: 'negative' } as const

export const resolveReportRange = (value: unknown): ReportRange => (isReportRange(value) ? value : '6m')

export const sameYear = (fromKey: string, toKey: string): boolean => fromKey.slice(0, 4) === toKey.slice(0, 4)

export function rangeEnds(periods: readonly { period: string }[]): { first: string; last: string } | null {
  const first = periods[0]?.period
  const last = periods[periods.length - 1]?.period
  return first !== undefined && last !== undefined ? { first, last } : null
}

export function axisLabels(keys: readonly string[], monthOf: (key: string) => string): string[][] {
  return keys.map((key, index) => {
    const year = key.slice(0, 4)
    const yearChanged = index === 0 || keys[index - 1]?.slice(0, 4) !== year
    return yearChanged ? [monthOf(key), year] : [monthOf(key)]
  })
}

export function reportStateOf(report: ReportFacts): ReportState {
  if (!report.hasTransactions) return 'noTransactions'
  return report.totals.income > 0 || report.totals.expense > 0 ? 'ready' : 'noData'
}

export const canExport = (report: ReportFacts | undefined, stale: boolean): boolean =>
  !stale && report !== undefined && reportStateOf(report) === 'ready'

export const largestOf = (items: readonly { amount: number }[]): number =>
  items.reduce((largest, item) => Math.max(largest, item.amount), 0)

export const barShare = (amount: number, largest: number): number => (largest > 0 ? Math.min(amount / largest, 1) : 0)
