import type { Currency } from '../../../shared/money/currencies'
import { currencyFormat } from '../../../shared/money/format'

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

export type KeypadKey = Digit | 'decimal' | 'backspace'

type FractionDigits = 0 | 2 | 3

export const MAX_INTEGER_DIGITS = 9

export const isDigit = (value: string): value is Digit => /^\d$/.test(value)

export function pressKey(entry: string, key: KeypadKey, digits: FractionDigits): string {
  if (key === 'backspace') return entry.slice(0, -1)
  if (key === 'decimal') return digits === 0 || entry.includes('.') ? entry : `${entry || '0'}.`
  const [integer = '', fraction] = entry.split('.')
  if (fraction !== undefined) return fraction.length >= digits ? entry : entry + key
  if (integer === '0') return key
  return integer.length >= MAX_INTEGER_DIGITS ? entry : entry + key
}

export function fitEntry(entry: string, digits: FractionDigits): string {
  const [integer = '', fraction] = entry.split('.')
  if (fraction === undefined) return entry
  return digits === 0 ? integer : `${integer}.${fraction.slice(0, digits)}`
}

export function entryToMinor(entry: string, digits: FractionDigits): number {
  const [integer = '', fraction = ''] = entry.split('.')
  return Number(integer || '0') * 10 ** digits + Number(fraction.padEnd(digits, '0').slice(0, digits) || '0')
}

export const decimalSeparator = (locale: string): string =>
  new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.'

const NUMBER_PARTS = new Set(['integer', 'group', 'decimal', 'fraction'])

export function formatEntry(entry: string, locale: string, currency: Currency | undefined): string {
  const digits = (entry || '0').replace('.', decimalSeparator(locale))
  let placed = false
  return new Intl.NumberFormat(locale, currency ? currencyFormat(currency) : undefined)
    .formatToParts(1)
    .map((part) => {
      if (!NUMBER_PARTS.has(part.type)) return part.value
      if (placed) return ''
      placed = true
      return digits
    })
    .join('')
}
