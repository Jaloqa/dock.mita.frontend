import type { TransactionDto } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'

export type TransactionView = {
  transaction: TransactionDto
  title: string
  categoryName: string
  categoryColor: string
  accountName: string
  accountCurrency?: Currency
  initial: string
  tags: string[]
}
