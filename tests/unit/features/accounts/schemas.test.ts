import { describe, expect, it } from 'bun:test'
import {
  ACCOUNT_NAME_MAX,
  type AccountForm,
  accountRules,
  isCardLast4,
  isCardLast4For,
} from '../../../../app/features/accounts/schemas/accountSchema'
import {
  differentFrom,
  type TransferForm,
  transferRules,
} from '../../../../app/features/accounts/schemas/transferSchema'
import { MANUAL_RATE_MAX } from '../../../../app/shared/money/currencies'
import { isPositiveOrEmpty } from '../../../../app/shared/utils/validation'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

describe('account form rules', () => {
  it('accepts an empty value or exactly four digits as card digits', () => {
    expect(isCardLast4('')).toBe(true)
    expect(isCardLast4('0042')).toBe(true)
    expect(isCardLast4('123')).toBe(false)
    expect(isCardLast4('12a4')).toBe(false)
    expect(isCardLast4('12345')).toBe(false)
  })

  it('checks card digits only for card accounts', () => {
    expect(isCardLast4For(() => 'card')('12')).toBe(false)
    expect(isCardLast4For(() => 'cash')('12')).toBe(true)
    expect(isCardLast4For(() => 'savings')('12')).toBe(true)
  })

  it('ignores leftover card digits once the type is no longer a card', () => {
    const form: AccountForm = { name: 'Cash', type: 'card', currency: 'PLN', openingBalance: 0, cardLast4: '12' }
    const rules = accountRules((key) => key, form)
    expect(validate(rules.cardLast4.cardLast4, form.cardLast4)).toBe(false)
    form.type = 'cash'
    expect(validate(rules.cardLast4.cardLast4, form.cardLast4)).toBe(true)
  })

  it('requires a name of at most 40 characters', () => {
    const rules = accountRules((key) => key, { type: 'cash', currency: 'PLN' })
    expect(validate(rules.name.required, '')).toBe(false)
    expect(validate(rules.name.required, 'Cash')).toBe(true)
    expect(validate(rules.name.maxLength, 'a'.repeat(ACCOUNT_NAME_MAX))).toBe(true)
    expect(validate(rules.name.maxLength, 'a'.repeat(ACCOUNT_NAME_MAX + 1))).toBe(false)
  })

  it('maps rule failures to translation keys', () => {
    const rules = accountRules((key) => key, { type: 'card', currency: 'PLN' })
    expect(message(rules.name.maxLength)).toBe('validation.nameTooLong')
    expect(message(rules.cardLast4.cardLast4)).toBe('validation.cardLast4')
    expect(message(rules.openingBalance.max)).toBe('validation.invalidValue')
  })

  it('holds the opening balance of either sign to the minor unit limit of the account currency', () => {
    const form: Pick<AccountForm, 'type' | 'currency'> = { type: 'cash', currency: 'JPY' }
    const rules = accountRules((key) => key, form)
    expect(validate(rules.openingBalance.max, 100_000_000_000)).toBe(true)
    expect(validate(rules.openingBalance.max, -100_000_000_000)).toBe(true)
    expect(validate(rules.openingBalance.max, -100_000_000_001)).toBe(false)
    form.currency = 'KWD'
    expect(validate(rules.openingBalance.max, 100_000_000)).toBe(true)
    expect(validate(rules.openingBalance.max, 100_000_000.001)).toBe(false)
    form.currency = 'PLN'
    expect(validate(rules.openingBalance.max, 1_000_000_000.01)).toBe(false)
  })
})

describe('transfer form rules', () => {
  it('requires the target account to differ from the source', () => {
    const different = differentFrom(() => 'acc_a')
    expect(different('acc_b')).toBe(true)
    expect(different('acc_a')).toBe(false)
    expect(different(null)).toBe(true)
  })

  it('accepts an empty or positive rate only', () => {
    expect(isPositiveOrEmpty(null)).toBe(true)
    expect(isPositiveOrEmpty(0.2342)).toBe(true)
    expect(isPositiveOrEmpty(0)).toBe(false)
    expect(isPositiveOrEmpty(-1)).toBe(false)
  })

  it('holds the amount to the limit of the source currency and the rate to the backend maximum', () => {
    const form: TransferForm = {
      fromAccountId: 'acc_a',
      toAccountId: 'acc_b',
      amount: null,
      date: null,
      rate: null,
      note: '',
    }
    const rules = transferRules((key) => key, form, { crossCurrency: () => true, currency: () => 'KWD' })
    expect(validate(rules.amount.max, 100_000_000)).toBe(true)
    expect(validate(rules.amount.max, 100_000_000.001)).toBe(false)
    expect(validate(rules.amount.positive, 0.001)).toBe(true)
    expect(message(rules.amount.max)).toBe('validation.invalidValue')
    expect(validate(rules.rate.max, MANUAL_RATE_MAX)).toBe(true)
    expect(validate(rules.rate.max, MANUAL_RATE_MAX + 1)).toBe(false)
    expect(message(rules.rate.max)).toBe('validation.invalidValue')
  })
})
