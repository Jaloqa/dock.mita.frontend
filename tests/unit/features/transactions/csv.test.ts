import { describe, expect, it } from 'bun:test'
import {
  collectPages,
  csvCell,
  csvColumns,
  csvText,
  toCsv,
  transactionsCsv,
} from '../../../../app/features/transactions/utils/csv'
import type { TransactionDto } from '../../../../app/shared/api/contract'

const eurLunch: TransactionDto = {
  id: 'txn_1',
  kind: 'expense',
  date: '2026-10-14',
  title: 'Lunch, "Tapas"',
  note: '=SUM(A1)',
  categoryId: 'cat_cafes',
  accountId: 'acc_card',
  amount: 2_550,
  currency: 'EUR',
  accountAmount: 10_889,
  rate: 4.27,
  baseAmount: 10_889,
  tags: [],
}

describe('csv', () => {
  it('quotes cells with separators, quotes or line breaks', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell(12.5)).toBe('12.5')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
  })

  it('neutralises spreadsheet formulas in text', () => {
    expect(csvText('=1+1')).toBe("'=1+1")
    expect(csvText('+48 600')).toBe("'+48 600")
    expect(csvText('-x')).toBe("'-x")
    expect(csvText('@me')).toBe("'@me")
    expect(csvText('Lidl')).toBe('Lidl')
  })

  it('joins rows with CRLF after a byte order mark', () => {
    expect(
      toCsv([
        ['a', 1],
        ['b', 2],
      ]),
    ).toBe('﻿a,1\r\nb,2\r\n')
  })

  it('writes one signed row per transaction with names and currencies', () => {
    const csv = transactionsCsv([eurLunch, { ...eurLunch, id: 'txn_2', kind: 'income', title: '', note: null }], {
      header: (column) => column.toUpperCase(),
      kind: (kind) => (kind === 'income' ? 'Income' : 'Expense'),
      categoryName: () => 'Cafes',
      account: () => ({ name: 'Main card', currency: 'PLN' }),
      baseCurrency: 'PLN',
    })
    expect(csv.slice(1).split('\r\n')).toEqual([
      csvColumns.map((column) => column.toUpperCase()).join(','),
      '2026-10-14,Expense,"Lunch, ""Tapas""",Cafes,Main card,-25.50,EUR,-108.89,PLN,4.27,-108.89,PLN,\'=SUM(A1),',
      '2026-10-14,Income,,Cafes,Main card,25.50,EUR,108.89,PLN,4.27,108.89,PLN,,',
      '',
    ])
  })

  it('writes the tag names last, each guarded against formulas', () => {
    const csv = transactionsCsv(
      [
        {
          ...eurLunch,
          note: null,
          tags: [
            { id: 'tag_1', name: '=x' },
            { id: 'tag_2', name: 'y' },
          ],
        },
      ],
      {
        header: (column) => (column === 'tags' ? 'Tags' : column),
        kind: () => 'Expense',
        categoryName: () => 'Cafes',
        account: () => ({ name: 'Main card', currency: 'PLN' }),
        baseCurrency: 'PLN',
      },
    )
    const [header, row] = csv.slice(1).split('\r\n')
    expect(header?.endsWith(',Tags')).toBe(true)
    expect(row?.endsWith(",'=x; y")).toBe(true)
  })

  it('collects every page until the total is reached', async () => {
    const requested: number[] = []
    const pages = await collectPages(async (page) => {
      requested.push(page)
      return { items: page < 3 ? [page, page] : [page], page, pageSize: 2, total: 5 }
    })
    expect(requested).toEqual([1, 2, 3])
    expect(pages.flatMap((page) => page.items)).toEqual([1, 1, 2, 2, 3])
  })

  it('stops on an empty page', async () => {
    const pages = await collectPages(async (page) => ({ items: [], page, pageSize: 100, total: 0 }))
    expect(pages).toHaveLength(1)
  })
})
