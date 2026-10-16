import { describe, expect, it } from 'bun:test'
import {
  addDaysIso,
  currentPeriodKey,
  daysLeft,
  fromLocalDate,
  isIsoDate,
  isPeriodKey,
  monthKeyDate,
  periodByKey,
  periodFor,
  shiftPeriod,
  toIsoDate,
  toLocalDate,
} from '../../../app/shared/period/period'

describe('period', () => {
  it('formats dates in UTC', () => {
    expect(toIsoDate(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05')
  })

  it('uses calendar months when the period starts on the 1st', () => {
    expect(periodFor('2026-10-14', 1)).toEqual({ key: '2026-10', from: '2026-10-01', to: '2026-10-31' })
  })

  it('puts days before the start day into the previous period', () => {
    expect(periodFor('2026-10-05', 10)).toEqual({ key: '2026-09', from: '2026-09-10', to: '2026-10-09' })
    expect(periodFor('2026-10-10', 10)).toEqual({ key: '2026-10', from: '2026-10-10', to: '2026-11-09' })
  })

  it('crosses the year boundary', () => {
    expect(periodFor('2027-01-05', 10)).toEqual({ key: '2026-12', from: '2026-12-10', to: '2027-01-09' })
    expect(shiftPeriod('2026-12', 1, 1)).toEqual({ key: '2027-01', from: '2027-01-01', to: '2027-01-31' })
    expect(shiftPeriod('2027-01', -1, 1).key).toBe('2026-12')
  })

  it('starts on the last working day of the previous month', () => {
    expect(periodByKey('2026-10', 'lastWorkingDay')).toEqual({ key: '2026-10', from: '2026-09-30', to: '2026-10-29' })
  })

  it('assigns the days after a weekend-shifted start to the next period', () => {
    expect(periodFor('2026-10-30', 'lastWorkingDay').key).toBe('2026-11')
    expect(periodFor('2026-10-29', 'lastWorkingDay').key).toBe('2026-10')
  })

  it('places every day of a year in exactly one period', () => {
    for (const start of [1, 10, 28, 'lastWorkingDay'] as const) {
      const day = new Date(Date.UTC(2026, 0, 1))
      while (day.getUTCFullYear() === 2026) {
        const iso = toIsoDate(day)
        const period = periodFor(iso, start)
        expect(iso >= period.from && iso <= period.to).toBe(true)
        day.setUTCDate(day.getUTCDate() + 1)
      }
    }
  })

  it('counts the days left including today', () => {
    const october = periodByKey('2026-10', 1)
    expect(daysLeft(october, '2026-10-14')).toBe(18)
    expect(daysLeft(october, '2026-10-31')).toBe(1)
    expect(daysLeft(october, '2026-11-02')).toBe(0)
    expect(daysLeft(october, '2026-09-20')).toBe(31)
  })

  it('shifts ISO dates across month and year boundaries', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysIso('2026-10-15', 0)).toBe('2026-10-15')
  })

  it('recognises real ISO calendar dates only', () => {
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-1-05')).toBe(false)
    expect(isIsoDate(20261005)).toBe(false)
    expect(isIsoDate('')).toBe(false)
  })

  it('converts between local calendar dates and ISO dates', () => {
    expect(fromLocalDate(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05')
    const local = toLocalDate('2026-10-05')
    expect([local.getFullYear(), local.getMonth(), local.getDate()]).toEqual([2026, 9, 5])
  })

  it('accepts period keys between 1970 and 2099 only', () => {
    expect(['2026-10', '1970-01', '2099-12'].map((value) => isPeriodKey(value))).toEqual([true, true, true])
    const invalid: unknown[] = [
      '2026-13',
      '2026-00',
      '2026-1',
      '0026-10',
      '0000-01',
      '2100-01',
      '2026-10-01',
      '',
      202610,
      null,
      undefined,
      ['2026-10'],
    ]
    expect(invalid.map((value) => isPeriodKey(value))).toEqual(invalid.map(() => false))
  })

  it('names the current period by the month start', () => {
    expect(currentPeriodKey(1, '2026-10-05')).toBe('2026-10')
    expect(currentPeriodKey(10, '2026-10-05')).toBe('2026-09')
    expect(currentPeriodKey(10, '2026-10-16')).toBe('2026-10')
  })

  it('dates a month key in the middle of its month', () => {
    expect(monthKeyDate('2027-06').toISOString()).toBe('2027-06-15T00:00:00.000Z')
    expect(monthKeyDate('2026-12').toISOString()).toBe('2026-12-15T00:00:00.000Z')
  })
})
