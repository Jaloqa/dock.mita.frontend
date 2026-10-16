import { convertMinor } from '../app/shared/money/money'
import type { AccountRow, MockState, TransferRow } from './db'
import { badRequest } from './errors'
import { newId } from './ids'
import { rateOn, roundRate } from './rates'
import { type collectErrors, isMissing } from './validation'

export const AMOUNT_MAX = 100_000_000_000

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
        : rateOn(state.rates, draft.date, draft.from.currency, draft.to.currency)
  const toAmount = convertMinor(draft.fromAmount, rate)
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
