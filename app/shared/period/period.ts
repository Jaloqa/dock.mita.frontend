export type MonthStart = number | 'lastWorkingDay'

export type Period = { key: string; from: string; to: string }

const DAY_MS = 86_400_000

const pad = (value: number) => String(value).padStart(2, '0')

export const toIsoDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`

export const todayIso = (): string => {
  const now = new Date()
  return toIsoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

const parseIsoDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1))
}

const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS)

export const addDaysIso = (iso: string, days: number): string => toIsoDate(addDays(parseIsoDate(iso), days))

export const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && toIsoDate(parseIsoDate(value)) === value

export const fromLocalDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const toLocalDate = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

function lastWorkingDayOf(year: number, monthIndex: number): Date {
  let day = new Date(Date.UTC(year, monthIndex + 1, 0))
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day = addDays(day, -1)
  return day
}

function startOf(year: number, monthIndex: number, start: MonthStart): Date {
  return start === 'lastWorkingDay'
    ? lastWorkingDayOf(year, monthIndex - 1)
    : new Date(Date.UTC(year, monthIndex, start))
}

const keyOf = (date: Date): string => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`

export function periodByKey(key: string, start: MonthStart): Period {
  const [year, month] = key.split('-').map(Number)
  const monthIndex = (month ?? 1) - 1
  const from = startOf(year ?? 0, monthIndex, start)
  const to = addDays(startOf(year ?? 0, monthIndex + 1, start), -1)
  return { key, from: toIsoDate(from), to: toIsoDate(to) }
}

export function periodFor(date: string, start: MonthStart): Period {
  const day = parseIsoDate(date)
  for (const offset of [0, -1, 1]) {
    const label = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + offset, 1))
    const period = periodByKey(keyOf(label), start)
    if (date >= period.from && date <= period.to) return period
  }
  throw new RangeError(`No financial period contains ${date}`)
}

export function shiftPeriod(key: string, months: number, start: MonthStart): Period {
  const [year, month] = key.split('-').map(Number)
  return periodByKey(keyOf(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1 + months, 1))), start)
}

export function daysLeft(period: Period, today: string): number {
  if (today > period.to) return 0
  const from = today < period.from ? period.from : today
  return Math.round((parseIsoDate(period.to).getTime() - parseIsoDate(from).getTime()) / DAY_MS) + 1
}

const PERIOD_KEY = /^(?:19[7-9]\d|20\d\d)-(?:0[1-9]|1[0-2])$/

export const isPeriodKey = (value: unknown): value is string => typeof value === 'string' && PERIOD_KEY.test(value)

export const currentPeriodKey = (start: MonthStart, today: string = todayIso()): string => periodFor(today, start).key
