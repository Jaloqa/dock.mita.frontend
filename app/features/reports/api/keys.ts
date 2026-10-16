import type { ReportRange } from '~/shared/api/contract'

export const reportKeys = {
  all: ['reports'],
  range: (range: ReportRange) => ['reports', range] as const,
} as const
