import { readFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'

test.skip(({ isMobile }) => isMobile, 'the table and the filter panel are the desktop layout')

const filters = (page: Page) => page.getByRole('region', { name: 'Filters' })
const body = (page: Page) => page.getByRole('region', { name: 'Transactions' }).locator('tbody tr')

const showAllTime = async (page: Page) => {
  await filters(page).getByRole('combobox', { name: 'Period' }).click()
  await page.getByRole('option', { name: 'All time' }).click()
}

const addQuickTransaction = async (page: Page) => {
  await page.getByRole('button', { name: 'Add transaction' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await dialog.getByLabel('Amount').pressSequentially('1')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Transaction saved')).toBeVisible()
}

test('lists transactions with a summary and loads more on demand', async ({ page }) => {
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible()
  await showAllTime(page)
  await expect(body(page)).toHaveCount(20)
  const summary = page.getByRole('region', { name: 'Filter summary' })
  await expect(summary).toContainText(/Found: \d+ transactions/)
  await expect(summary).toContainText(/Total: [+-]zł/)
  await page.getByRole('button', { name: 'Show more' }).click()
  await expect(body(page)).toHaveCount(40)
})

test('filters by search, type and category', async ({ page }) => {
  await page.goto('/transactions')
  await showAllTime(page)
  const search = filters(page).getByRole('searchbox', { name: 'Search' })
  await search.fill('Lidl')
  await expect(body(page).first()).toContainText('Lidl')
  await expect(body(page).filter({ hasNotText: 'Lidl' })).toHaveCount(0)
  await search.fill('')
  await filters(page).getByRole('button', { name: 'Income', exact: true }).click()
  await expect(body(page).filter({ hasText: 'Wynagrodzenie' }).first()).toBeVisible()
  await expect(body(page).filter({ hasText: 'Czynsz' })).toHaveCount(0)
  await filters(page).getByRole('button', { name: 'All', exact: true }).click()
  await filters(page).getByRole('combobox', { name: 'Category' }).click()
  await page.getByRole('option', { name: 'Mieszkanie' }).click()
  await expect(body(page).filter({ hasText: 'Czynsz' }).first()).toBeVisible()
  await expect(body(page).filter({ hasNotText: 'Mieszkanie' })).toHaveCount(0)
})

test('sorts by amount and by date on the server', async ({ page }) => {
  await page.goto('/transactions')
  await showAllTime(page)
  const amount = page.getByRole('columnheader', { name: 'Amount' })
  const date = page.getByRole('columnheader', { name: 'Date' })
  await expect(date).toHaveAttribute('aria-sort', 'descending')
  await amount.getByRole('button').click()
  await expect(amount).toHaveAttribute('aria-sort', 'descending')
  await expect(body(page).first()).toContainText('Wynagrodzenie')
  await amount.getByRole('button').click()
  await expect(amount).toHaveAttribute('aria-sort', 'ascending')
  await expect(body(page).first()).not.toContainText('Wynagrodzenie')
  await date.getByRole('button').click()
  await expect(date).toHaveAttribute('aria-sort', 'descending')
  await expect(amount).not.toHaveAttribute('aria-sort', /./)
})

test('adds a transaction from the header, edits it from its row and deletes it', async ({ page }) => {
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Add transaction' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await dialog.getByLabel('Amount').pressSequentially('12.5')
  await dialog.getByLabel('Description').fill('Kiosk Ruch')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Transaction saved')).toBeVisible()
  const row = body(page).filter({ hasText: 'Kiosk Ruch' })
  await expect(row).toContainText('-zł 12.50')
  await expect(row).toContainText('Spożywcze')
  await expect(row.locator('td').first()).toHaveText(/^\d{2}\D\d{2}$/)
  await row.getByRole('button', { name: 'Kiosk Ruch' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit transaction' })
  await expect(edit.getByLabel('Description')).toHaveValue('Kiosk Ruch')
  await expect(edit.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await edit.getByLabel('Note').fill('Gazeta')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Transaction updated')).toBeVisible()
  await expect(row).toContainText('Gazeta')
  await row.click()
  await page.getByRole('dialog', { name: 'Edit transaction' }).getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Transaction deleted')).toBeVisible()
  await expect(row).toHaveCount(0)
})

test('exports every filtered transaction as CSV', async ({ page }) => {
  await page.goto('/transactions')
  await showAllTime(page)
  await filters(page).getByRole('searchbox', { name: 'Search' }).fill('Lidl')
  await expect(body(page).first()).toContainText('Lidl')
  await expect(body(page).filter({ hasNotText: 'Lidl' })).toHaveCount(0)
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^mita-transactions-\d{4}-\d{2}-\d{2}\.csv$/)
  const lines = readFileSync(await download.path(), 'utf8')
    .trimEnd()
    .split('\r\n')
  expect(lines[0]).toBe(
    '﻿Date,Type,Description,Category,Account,Amount,Currency,Account amount,Account currency,Exchange rate,Amount in base currency,Base currency,Note',
  )
  expect(lines.length).toBeGreaterThan(21)
  expect(lines.slice(1).every((line) => line.includes(',Expense,Lidl,Spożywcze,Konto główne,'))).toBe(true)
  await expect(page.getByText(/^Exported \d+ transactions$/)).toBeVisible()
})

test('shows an empty state for filters without results, widens the period and resets them', async ({ page }) => {
  await page.goto('/transactions')
  const search = filters(page).getByRole('searchbox', { name: 'Search' })
  await search.fill('zzzz')
  await expect(page.getByRole('heading', { name: 'Nothing found' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset filters' })).toBeVisible()
  await page.getByRole('button', { name: 'Show all time' }).click()
  await expect(filters(page).getByRole('combobox', { name: 'Period' })).toContainText('All time')
  await expect(search).toHaveValue('zzzz')
  await expect(page.getByRole('heading', { name: 'Nothing found' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show all time' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Reset filters' }).click()
  await expect(search).toHaveValue('')
  await expect(page.getByRole('heading', { name: 'Nothing found' })).toHaveCount(0)
})

test('offers all time when the current period is empty but older transactions exist', async ({ page }) => {
  await page.goto('/transactions')
  await addQuickTransaction(page)
  await page.evaluate(() => {
    const key = 'mita-mock-db-v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    for (const transaction of state.transactions) transaction.date = '2020-01-15'
    localStorage.setItem(key, JSON.stringify(state))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Nothing found' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No transactions yet' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Show all time' }).click()
  await expect(filters(page).getByRole('combobox', { name: 'Period' })).toContainText('All time')
  await expect(body(page)).toHaveCount(20)
  await expect(body(page).first()).toContainText('2020')
})

test('invites to add the first transaction when there are none', async ({ page }) => {
  await page.goto('/transactions')
  await addQuickTransaction(page)
  await page.evaluate(() => {
    const key = 'mita-mock-db-v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    state.transactions = []
    localStorage.setItem(key, JSON.stringify(state))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'No transactions yet' })).toBeVisible()
  await page.getByRole('button', { name: 'Add your first transaction' }).click()
  await expect(page.getByRole('dialog', { name: 'New transaction' })).toBeVisible()
})

test('transactions screen is localized', async ({ page }) => {
  await page.goto('/pl/transactions')
  await expect(page.getByRole('heading', { level: 1, name: 'Operacje' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dodaj operację' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Podsumowanie filtra' })).toContainText('Znaleziono')
  const month = new Date().toLocaleString('pl', { month: 'long' })
  const capitalized = month.charAt(0).toUpperCase() + month.slice(1)
  await expect(page.getByText(new RegExp(`^${capitalized} \\d{4}$`))).toBeVisible()
})
