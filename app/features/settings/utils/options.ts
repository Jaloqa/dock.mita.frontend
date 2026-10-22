import type { MonthStart } from '../../../shared/period/period'

export type Option<T> = { value: T; label: string }

export const MONTH_START_DAYS = 28

export const monthStartOptions = (dayLabel: (day: number) => string, lastWorkingDay: string): Option<MonthStart>[] => [
  ...Array.from({ length: MONTH_START_DAYS }, (_, index) => ({ value: index + 1, label: dayLabel(index + 1) })),
  { value: 'lastWorkingDay', label: lastWorkingDay },
]
