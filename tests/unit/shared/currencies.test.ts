import { describe, expect, it } from 'bun:test'
import {
  AMOUNT_MINOR_MAX,
  BASE_CURRENCIES,
  CURRENCIES,
  currencyDigits,
  isBaseCurrency,
  isCurrency,
  MANUAL_RATE_MAX,
} from '../../../app/shared/money/currencies'

const EXPECTED =
  'PLN EUR USD UAH AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BHD BIF BND BOB BRL BSD BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB FJD GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KRW KWD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UGX UYU UZS VES VND VUV WST XAF XCD XCG XOF XPF YER ZAR ZMW ZWG'.split(
    ' ',
  )

describe('currency catalog', () => {
  it('lists the 148 codes with the base currencies first and the rest alphabetically', () => {
    expect(CURRENCIES).toHaveLength(148)
    expect<string[]>([...CURRENCIES]).toEqual(EXPECTED)
    expect(CURRENCIES.slice(0, BASE_CURRENCIES.length)).toEqual([...BASE_CURRENCIES])
    const rest = CURRENCIES.slice(BASE_CURRENCIES.length)
    expect(rest).toEqual([...rest].sort())
  })

  it('keeps PLN, EUR, USD and UAH as the base currencies', () => {
    expect([...BASE_CURRENCIES]).toEqual(['PLN', 'EUR', 'USD', 'UAH'])
    expect(isBaseCurrency('UAH')).toBe(true)
    expect(isBaseCurrency('JPY')).toBe(false)
    expect(isBaseCurrency('pln')).toBe(false)
  })

  it('accepts only exact upper-case codes of the catalog', () => {
    expect(isCurrency('JPY')).toBe(true)
    expect(isCurrency('ZWG')).toBe(true)
    expect(isCurrency('XCG')).toBe(true)
    for (const value of ['XDR', 'jpy', ' JPY', 'JPY\n', '1', 'PLNX', '', 'constructor', null, undefined, 840]) {
      expect(isCurrency(value)).toBe(false)
    }
  })

  it('knows the ISO 4217 minor units of every currency', () => {
    expect(currencyDigits('JPY')).toBe(0)
    expect(currencyDigits('KWD')).toBe(3)
    expect(currencyDigits('PLN')).toBe(2)
    expect(CURRENCIES.filter((currency) => currencyDigits(currency) === 0)).toEqual([
      'BIF',
      'CLP',
      'DJF',
      'GNF',
      'ISK',
      'JPY',
      'KMF',
      'KRW',
      'PYG',
      'RWF',
      'UGX',
      'VND',
      'VUV',
      'XAF',
      'XOF',
      'XPF',
    ])
    expect(CURRENCIES.filter((currency) => currencyDigits(currency) === 3)).toEqual([
      'BHD',
      'IQD',
      'JOD',
      'KWD',
      'LYD',
      'OMR',
      'TND',
    ])
    expect(BASE_CURRENCIES.every((currency) => currencyDigits(currency) === 2)).toBe(true)
  })

  it('shares the amount and manual rate limits with the backend', () => {
    expect(AMOUNT_MINOR_MAX).toBe(100_000_000_000)
    expect(MANUAL_RATE_MAX).toBe(1_000_000_000)
  })
})
