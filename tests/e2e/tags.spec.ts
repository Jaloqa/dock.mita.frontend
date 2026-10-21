import { readFileSync } from 'node:fs'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { overlayOption, pickOverlayOption } from './overlayOption'

const rowTitle = (page: Page, isMobile: boolean, title: string): Locator =>
  isMobile
    ? page.getByRole('region', { name: 'Transactions by day' }).getByRole('listitem').first()
    : page
        .getByRole('region', { name: 'Transactions' })
        .locator('tbody tr')
        .first()
        .getByRole('button', { name: title })

const showAllTime = async (page: Page, isMobile: boolean) => {
  if (isMobile) {
    await page.getByRole('button', { name: 'Filters' }).click()
    const drawer = page.getByRole('dialog', { name: 'Filters' })
    await drawer.getByRole('combobox', { name: 'Period' }).click()
    await page.getByRole('option', { name: 'All time' }).click()
    await drawer.getByRole('button', { name: 'Show results' }).click()
    await expect(drawer).toBeHidden()
    return
  }
  await page.getByRole('region', { name: 'Filters' }).getByRole('combobox', { name: 'Period' }).click()
  await page.getByRole('option', { name: 'All time' }).click()
}

const openEditDialog = async (page: Page, isMobile: boolean, title: string): Promise<Locator> => {
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible()
  await showAllTime(page, isMobile)
  await page.getByRole('searchbox', { name: 'Search' }).fill(title)
  const row = rowTitle(page, isMobile, title)
  await expect(row).toContainText(title)
  await row.click()
  const dialog = page.getByRole('dialog', { name: 'Edit transaction' })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  return dialog
}

const tagsField = (dialog: Locator) => dialog.getByRole('combobox', { name: 'Tags' })
const chip = (dialog: Locator, name: string) => dialog.getByRole('button', { name: `Remove tag ${name}`, exact: true })

const addNewTag = async (page: Page, dialog: Locator, name: string) => {
  const field = tagsField(dialog)
  await field.fill(name)
  await expect(overlayOption(page, name)).toBeVisible()
  await field.press('Enter')
  await expect(chip(dialog, name)).toBeVisible()
}

test('adds an existing and a new tag to a transaction', async ({ page, isMobile }) => {
  let dialog: Locator
  let title: string
  if (isMobile) {
    title = 'Czynsz'
    dialog = await openEditDialog(page, true, title)
  } else {
    title = 'Wizyta z tagami'
    await page.goto('/transactions')
    await page.getByRole('button', { name: 'Add transaction' }).click()
    dialog = page.getByRole('dialog', { name: 'New transaction' })
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
    await dialog.getByLabel('Amount').pressSequentially('12')
    await dialog.getByLabel('Description').fill(title)
  }
  const field = tagsField(dialog)
  await field.fill('prac')
  await pickOverlayOption(page, 'praca')
  await expect(chip(dialog, 'praca')).toBeVisible()
  await addNewTag(page, dialog, 'kino')
  await expect(chip(dialog, 'praca')).toBeVisible()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(isMobile ? 'Transaction updated' : 'Transaction saved')).toBeVisible()
  if (!isMobile) await page.getByRole('searchbox', { name: 'Search' }).fill(title)
  await rowTitle(page, isMobile, title).click()
  const reopened = page.getByRole('dialog', { name: 'Edit transaction' })
  await expect(chip(reopened, 'praca')).toBeVisible()
  await expect(chip(reopened, 'kino')).toBeVisible()
})

test('keeps tags when only the amount changes', async ({ page, isMobile }) => {
  const title = 'Booking.com — hotel Barcelona'
  const dialog = await openEditDialog(page, isMobile, title)
  await expect(chip(dialog, 'barcelona')).toBeVisible()
  await dialog.getByLabel('Amount').fill('')
  await dialog.getByLabel('Amount').pressSequentially('123')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Transaction updated')).toBeVisible()
  await rowTitle(page, isMobile, title).click()
  const reopened = page.getByRole('dialog', { name: 'Edit transaction' })
  await expect(reopened.getByLabel('Amount')).toHaveValue(/123/)
  await expect(chip(reopened, 'barcelona')).toBeVisible()
})

test('refuses an eleventh tag', async ({ page, isMobile }) => {
  const dialog = await openEditDialog(page, isMobile, 'Czynsz')
  for (let index = 1; index <= 11; index += 1) await addNewTag(page, dialog, `limit${index}`)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('Use at most 10 tags.')).toBeVisible()
  await expect(dialog).toBeVisible()
})

test('saves a tag that was typed but not confirmed', async ({ page, isMobile }) => {
  const title = 'Booking.com — hotel Barcelona'
  const dialog = await openEditDialog(page, isMobile, title)
  await tagsField(dialog).fill('niepotwierdzony')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await rowTitle(page, isMobile, title).click()
  const reopened = page.getByRole('dialog', { name: 'Edit transaction' })
  await expect(chip(reopened, 'niepotwierdzony')).toBeVisible()
  await expect(chip(reopened, 'barcelona')).toBeVisible()
})

test('removes a tag with its labelled button', async ({ page, isMobile }) => {
  const dialog = await openEditDialog(page, isMobile, 'Booking.com — hotel Barcelona')
  await chip(dialog, 'barcelona').click()
  await expect(chip(dialog, 'barcelona')).toHaveCount(0)
})

test.describe('tag filter on the desktop table', () => {
  test.skip(({ isMobile }) => isMobile, 'the table is the desktop layout')

  const filterRegion = (page: Page) => page.getByRole('region', { name: 'Filters' })
  const rows = (page: Page) => page.getByRole('region', { name: 'Transactions' }).locator('tbody tr')
  const pickTag = async (page: Page, text: string, name: string) => {
    const field = filterRegion(page).getByRole('combobox', { name: 'Tags' })
    await field.fill(text)
    await pickOverlayOption(page, name)
    await expect(filterRegion(page).getByRole('button', { name: `Remove tag ${name}`, exact: true })).toBeVisible()
  }

  test('filters by tag and the sum follows', async ({ page }) => {
    await page.goto('/transactions')
    await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible()
    await showAllTime(page, false)
    await pickTag(page, 'barc', 'barcelona')
    const summary = page.getByRole('region', { name: 'Filter summary' })
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('Booking.com — hotel Barcelona')
    await expect(rows(page).first().getByRole('list', { name: 'Tags' })).toContainText('barcelona')
    await expect(summary).toContainText('Found: 1 transaction')
    const downloading = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export CSV' }).click()
    const lines = readFileSync(await (await downloading).path(), 'utf8')
      .trimEnd()
      .split('\r\n')
    const baseAmount = Math.abs(Number(lines[1]?.split(',')[10]))
    expect(baseAmount).toBeGreaterThan(0)
    await expect(summary).toContainText(baseAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }))
    await pickTag(page, 'prac', 'praca')
    await expect(rows(page).filter({ hasText: 'Laptop — Media Expert' })).toHaveCount(1)
    await expect(rows(page).filter({ hasText: 'Lidl' })).toHaveCount(0)
    await expect(summary).toContainText('Found: 5 transactions')
    await expect(rows(page).filter({ hasText: 'Booking.com — hotel Barcelona' })).toHaveCount(1)
    await filterRegion(page).getByRole('button', { name: 'Remove tag praca', exact: true }).click()
    await filterRegion(page).getByRole('button', { name: 'Remove tag barcelona', exact: true }).click()
    await expect(summary).not.toContainText('Found: 1 transaction')
    await expect(rows(page).nth(5)).toBeVisible()
  })

  test('exports tags in the CSV', async ({ page }) => {
    await page.goto('/transactions')
    await showAllTime(page, false)
    await pickTag(page, 'barc', 'barcelona')
    await expect(rows(page)).toHaveCount(1)
    const downloading = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export CSV' }).click()
    const download = await downloading
    const lines = readFileSync(await download.path(), 'utf8')
      .trimEnd()
      .split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]?.endsWith(',Tags')).toBe(true)
    expect(lines[1]?.endsWith(',barcelona')).toBe(true)
  })
})

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true })

const openSettingsInApp = async (page: Page, isMobile: boolean) => {
  if (isMobile) {
    await mainNav(page).getByRole('link', { name: 'Overview', exact: true }).click()
    await expect(page).toHaveURL('/')
    await page.getByRole('link', { name: 'Settings' }).filter({ visible: true }).click()
  } else {
    await mainNav(page).getByRole('link', { name: 'Settings', exact: true }).click()
  }
  await expect(page).toHaveURL('/settings')
}

const openTransactionsInApp = async (page: Page) => {
  await mainNav(page).getByRole('link', { name: 'Transactions', exact: true }).click()
  await expect(page).toHaveURL('/transactions')
  await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible()
}

const openTagManager = async (page: Page) => {
  await page.getByRole('button', { name: 'Manage tags' }).click()
  const dialog = page.getByRole('dialog', { name: 'Tags' })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  return dialog
}

const closeTagManager = async (dialog: Locator) => {
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toBeHidden()
}

const rowChips = (page: Page, name: string) =>
  page.getByRole('main').getByRole('list', { name: 'Tags' }).getByText(name, { exact: true })

const withFilters = async (page: Page, isMobile: boolean, action: (scope: Locator) => Promise<void>) => {
  if (!isMobile) {
    await action(page.getByRole('region', { name: 'Filters' }))
    return
  }
  await page.getByRole('button', { name: 'Filters' }).click()
  const drawer = page.getByRole('dialog', { name: 'Filters' })
  await action(drawer)
  await drawer.getByRole('button', { name: 'Show results' }).click()
  await expect(drawer).toBeHidden()
}

test('renaming and deleting a tag updates the rows', async ({ page, isMobile }) => {
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible()
  await showAllTime(page, isMobile)
  await page.getByRole('searchbox', { name: 'Search' }).fill('Play')
  await expect(rowChips(page, 'abonament').first()).toBeVisible()

  await openSettingsInApp(page, isMobile)
  let dialog = await openTagManager(page)
  const list = dialog.getByRole('list', { name: 'Tags' })
  await expect(list.getByRole('listitem')).toHaveCount(4)
  await expect(list.getByRole('listitem').filter({ hasText: 'remont' })).toContainText('0 transactions')
  const usage = await list
    .getByRole('listitem')
    .filter({ hasText: 'abonament' })
    .getByText(/^\d+ transactions$/)
    .textContent()
  const count = Number.parseInt(usage ?? '', 10)
  expect(count).toBeGreaterThan(1)

  await dialog.getByRole('button', { name: 'Rename abonament' }).click()
  const name = dialog.getByLabel('Name', { exact: true })
  await expect(name).toBeFocused()
  await name.fill('praca')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('A tag with this name already exists.')).toBeVisible()
  await name.fill('subskrypcja')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Tag renamed')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Rename subskrypcja' })).toBeFocused()
  await closeTagManager(dialog)

  await openTransactionsInApp(page)
  await showAllTime(page, isMobile)
  await page.getByRole('searchbox', { name: 'Search' }).fill('Play')
  await expect(rowChips(page, 'subskrypcja').first()).toBeVisible()
  await expect(rowChips(page, 'abonament')).toHaveCount(0)

  await withFilters(page, isMobile, async (scope) => {
    const field = scope.getByRole('combobox', { name: 'Tags' })
    await field.fill('subskr')
    await pickOverlayOption(page, 'subskrypcja')
    await expect(scope.getByRole('button', { name: 'Remove tag subskrypcja', exact: true })).toBeVisible()
  })
  await expect(rowChips(page, 'subskrypcja').first()).toBeVisible()

  await openSettingsInApp(page, isMobile)
  dialog = await openTagManager(page)
  await dialog.getByRole('button', { name: 'Delete subskrypcja' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText(`“subskrypcja” will be removed from ${count} transactions.`)
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Tag deleted')).toBeVisible()
  await expect(dialog.getByRole('list', { name: 'Tags' }).getByRole('listitem')).toHaveCount(3)
  await closeTagManager(dialog)

  await openTransactionsInApp(page)
  await showAllTime(page, isMobile)
  await expect(rowChips(page, 'subskrypcja')).toHaveCount(0)
  await withFilters(page, isMobile, async (scope) => {
    await expect(scope.getByRole('combobox', { name: 'Tags' })).toHaveValue('')
    await expect(scope.getByRole('button', { name: /^Remove tag/ })).toHaveCount(0)
  })
})

test('tag manager is localized', async ({ page }) => {
  await page.goto('/pl/settings')
  await page.getByRole('button', { name: 'Zarządzaj tagami' }).click()
  await expect(page.getByRole('dialog', { name: 'Tagi' })).toBeVisible()
})
