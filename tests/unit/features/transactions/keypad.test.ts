import { describe, expect, it } from 'bun:test'
import {
  decimalSeparator,
  entryToMinor,
  fitEntry,
  formatEntry,
  type KeypadKey,
  pressKey,
} from '../../../../app/features/transactions/utils/keypad'

const type = (keys: KeypadKey[], start = '', digits: 0 | 2 | 3 = 2) =>
  keys.reduce((entry, key) => pressKey(entry, key, digits), start)

describe('keypad', () => {
  it('types digits, one decimal separator and at most two fraction digits', () => {
    expect(type(['8', '6', 'decimal', '4', '0', '9'])).toBe('86.40')
    expect(type(['decimal', '5'])).toBe('0.5')
    expect(type(['1', 'decimal', 'decimal', '2'])).toBe('1.2')
  })

  it('allows exactly the fraction digits of the currency', () => {
    expect(pressKey('12', 'decimal', 0)).toBe('12')
    expect(type(['1', 'decimal', '5'], '', 0)).toBe('15')
    expect(pressKey('1.25', '5', 3)).toBe('1.255')
    expect(pressKey('1.255', '5', 3)).toBe('1.255')
  })

  it('replaces a leading zero and limits the whole part to nine digits', () => {
    expect(type(['0', '0', '7'])).toBe('7')
    expect(type(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'])).toBe('123456789')
  })

  it('erases the last character', () => {
    expect(type(['backspace'], '86.4')).toBe('86.')
    expect(type(['backspace', 'backspace'], '86.')).toBe('8')
    expect(type(['backspace'], '')).toBe('')
  })

  it('converts the entry to minor units of the currency', () => {
    expect(entryToMinor('', 2)).toBe(0)
    expect(entryToMinor('0.', 2)).toBe(0)
    expect(entryToMinor('86.4', 2)).toBe(8_640)
    expect(entryToMinor('86.45', 2)).toBe(8_645)
    expect(entryToMinor('7400', 2)).toBe(740_000)
    expect(entryToMinor('1.5', 3)).toBe(1500)
    expect(entryToMinor('1500', 0)).toBe(1500)
  })

  it('cuts the entry to the fraction digits of a newly chosen currency', () => {
    expect(fitEntry('12.55', 0)).toBe('12')
    expect(fitEntry('12.', 0)).toBe('12')
    expect(fitEntry('1.255', 2)).toBe('1.25')
    expect(fitEntry('1.25', 3)).toBe('1.25')
    expect(fitEntry('1500', 2)).toBe('1500')
    expect(fitEntry('', 0)).toBe('')
  })

  it('shows the entry with the locale separator inside the currency format', () => {
    expect(decimalSeparator('pl')).toBe(',')
    expect(decimalSeparator('en')).toBe('.')
    expect(formatEntry('86.4', 'pl', 'PLN').replace(/\s/g, ' ')).toBe('86,4 zł')
    expect(formatEntry('86.4', 'en', 'EUR')).toBe('€86.4')
    expect(formatEntry('86.4', 'en', 'UAH')).toBe('₴86.4')
    expect(formatEntry('', 'en', 'EUR')).toBe('€0')
    expect(formatEntry('1500', 'en', 'JPY')).toBe('¥1500')
    expect(formatEntry('1.25', 'en', 'KWD').replace(/\s/g, ' ')).toBe('KWD 1.25')
  })

  it('shows the entry without a currency code while the currency is unknown', () => {
    expect(formatEntry('42.5', 'en', undefined)).toBe('42.5')
    expect(formatEntry('1234.5', 'pl', undefined)).toBe('1234,5')
  })
})
