import { convertMinor, roundRate } from '../app/shared/money/money'
import type { AccountRow, MockState, TransferRow } from './db'
import { badRequest, ratesUnavailable } from './errors'
import { newId } from './ids'
import { freshRateOn } from './rates'
import { type collectErrors, isMissing } from './validation'

type Errors = ReturnType<typeof collectErrors>

export function checkAccount(
  state: MockState,
  userId: string,
  value: unknown,
  field: string,
  errors: Errors,
): AccountRow | undefined {
  if (isMissing(value)) {
    errors.add(field, 'validation.required')
    return undefined
  }
  const account = state.accounts.find((row) => row.id === value && row.userId === userId)
  if (!account) errors.add(field, 'validation.unknownAccount')
  else if (account.archived) errors.add(field, 'validation.archivedAccount')
  return account
}

export type TransferDraft = {
  date: string
  today: string
  from: AccountRow
  to: AccountRow
  fromAmount: number
  rate: number | undefined
  note: string | null
}

export function transferRow(state: MockState, userId: string, draft: TransferDraft): TransferRow {
  const rate =
    draft.from.currency === draft.to.currency
      ? 1
      : draft.rate !== undefined
        ? roundRate(draft.rate)
        : (freshRateOn(state.rates, draft.date, draft.today, draft.from.currency, draft.to.currency) ??
          ratesUnavailable())
  const toAmount = convertMinor(draft.fromAmount, rate, draft.from.currency, draft.to.currency)
  if (toAmount <= 0) badRequest({ rate: ['validation.positiveAmount'] })
  return {
    id: newId('trf'),
    userId,
    date: draft.date,
    fromAccountId: draft.from.id,
    toAccountId: draft.to.id,
    fromAmount: draft.fromAmount,
    toAmount,
    rate,
    note: draft.note,
  }
}
