import type { CategoryKind, Page, TransactionDto } from '../../../shared/api/contract'
import { type Currency, currencyDigits } from '../../../shared/money/currencies'
import { signedAccountAmount, signedAmount, signedBaseAmount } from './group'

export const csvColumns = [
  'date',
  'kind',
  'title',
  'category',
  'account',
  'amount',
  'currency',
  'accountAmount',
  'accountCurrency',
  'rate',
  'baseAmount',
  'baseCurrency',
  'note',
  'tags',
] as const

export type CsvColumn = (typeof csvColumns)[number]

export type CsvValue = string | number

export type CsvContext = {
  header: (column: CsvColumn) => string
  kind: (kind: CategoryKind) => string
  categoryName: (id: string) => string
  account: (id: string) => { name: string; currency: Currency } | undefined
  baseCurrency: Currency
}

const FORMULA_START = /^[=+\-@\t\r]/

export const csvText = (value: string): string => (FORMULA_START.test(value) ? `'${value}` : value)

export const csvCell = (value: CsvValue): string => {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export const toCsv = (rows: readonly (readonly CsvValue[])[]): string =>
  `﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`

export function decimal(minor: number, currency: Currency): string {
  const digits = currencyDigits(currency)
  return (minor / 10 ** digits).toFixed(digits)
}

export function transactionsCsv(items: readonly TransactionDto[], context: CsvContext): string {
  return toCsv([
    csvColumns.map(context.header),
    ...items.map((item) => {
      const account = context.account(item.accountId)
      return [
        item.date,
        context.kind(item.kind),
        csvText(item.title),
        csvText(context.categoryName(item.categoryId)),
        csvText(account?.name ?? ''),
        decimal(signedAmount(item), item.currency),
        item.currency,
        decimal(signedAccountAmount(item), account?.currency ?? item.currency),
        account?.currency ?? '',
        item.rate,
        decimal(signedBaseAmount(item), context.baseCurrency),
        context.baseCurrency,
        csvText(item.note ?? ''),
        item.tags.map((tag) => csvText(tag.name)).join('; '),
      ]
    }),
  ])
}

type Paged = Pick<Page<unknown>, 'items' | 'page' | 'pageSize' | 'total'>

export async function collectPages<P extends Paged>(
  fetchPage: (page: number) => Promise<P>,
  page = 1,
  collected: readonly P[] = [],
): Promise<P[]> {
  const result = await fetchPage(page)
  const pages = [...collected, result]
  const done = result.items.length === 0 || result.page * result.pageSize >= result.total
  return done ? pages : collectPages(fetchPage, page + 1, pages)
}
