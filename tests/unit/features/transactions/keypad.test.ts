import { describe, expect, it } from 'bun:test'
import {
  decimalSeparator,
  entryToMinor,
  formatEntry,
  type KeypadKey,
  pressKey,
} from '../../../../app/features/transactions/utils/keypad'

const type = (keys: KeypadKey[], start = '') => keys.reduce(pressKey, start)

describe('keypad', () => {
  it('types digits, one decimal separator and at most two fraction digits', () => {
    expect(type(['8', '6', 'decimal', '4', '0', '9'])).toBe('86.40')
    expect(type(['decimal', '5'])).toBe('0.5')
    expect(type(['1', 'decimal', 'decimal', '2'])).toBe('1.2')
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

  it('converts the entry to minor units', () => {
    expect(entryToMinor('')).toBe(0)
    expect(entryToMinor('0.')).toBe(0)
    expect(entryToMinor('86.4')).toBe(8_640)
    expect(entryToMinor('86.45')).toBe(8_645)
    expect(entryToMinor('7400')).toBe(740_000)
  })

  it('shows the entry with the locale separator inside the currency format', () => {
    expect(decimalSeparator('pl')).toBe(',')
    expect(decimalSeparator('en')).toBe('.')
    expect(formatEntry('86.4', 'pl', 'PLN').replace(/\s/g, ' ')).toBe('86,4 zł')
    expect(formatEntry('', 'en', 'EUR')).toBe('€0')
  })
})
