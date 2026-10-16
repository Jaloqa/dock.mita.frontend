import { describe, expect, it } from 'bun:test'
import {
  currencyLabel,
  currencyOptions,
  MONTH_START_DAYS,
  monthStartOptions,
} from '../../../../app/features/settings/utils/options'

describe('settings options', () => {
  it('labels currencies with their code and narrow symbol', () => {
    expect(currencyOptions('en')).toEqual([
      { value: 'PLN', label: 'PLN — zł' },
      { value: 'EUR', label: 'EUR — €' },
      { value: 'USD', label: 'USD — $' },
      { value: 'UAH', label: 'UAH — ₴' },
    ])
    expect(currencyLabel('UAH', 'uk')).toBe('UAH — ₴')
    expect(currencyLabel('PLN', 'pl')).toBe('PLN — zł')
  })

  it('offers days 1 to 28 and the last working day', () => {
    const options = monthStartOptions((day) => `Day ${day}`, 'Last working day')
    expect(options).toHaveLength(MONTH_START_DAYS + 1)
    expect(options[0]).toEqual({ value: 1, label: 'Day 1' })
    expect(options[27]).toEqual({ value: 28, label: 'Day 28' })
    expect(options.at(-1)).toEqual({ value: 'lastWorkingDay', label: 'Last working day' })
  })
})
