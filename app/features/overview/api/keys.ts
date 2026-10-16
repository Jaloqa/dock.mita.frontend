import type { OverviewRange } from '~/shared/api/contract'

export const overviewKeys = {
  all: ['overview'],
  range: (range: OverviewRange) => ['overview', range] as const,
} as const
