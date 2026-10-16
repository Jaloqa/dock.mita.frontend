import { expect, type Locator, type Page, test } from '@playwright/test'

const sectionTitles = ['Profile', 'Currency and region', 'Notifications', 'Data']
const ukSectionTitles = ['Профіль', 'Валюта і регіон', 'Сповіщення', 'Дані']

const section = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
const profile = (page: Page) => section(page, 'Profile')
const region = (page: Page) => section(page, 'Currency and region')
const nameField = (page: Page) => profile(page).getByLabel('Name', { exact: true })
const combobox = (page: Page, name: string) => page.getByRole('combobox', { name, exact: true })

const choose = async (page: Page, field: Locator, option: string) => {
  await field.click()
  await page.getByRole('option', { name: option, exact: true }).click()
  await expect(field).toHaveAttribute('aria-expanded', 'false')
}

const openSettings = async (page: Page, name = 'Anna Nowak') => {
  await page.goto('/settings')
  await expect(nameField(page)).toHaveValue(name)
  await expect(region(page).getByRole('combobox').first()).toBeVisible()
}

const localIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const shortDay = (date: Date) => date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })

const periodTitle = (startDay: number) => {
  const now = new Date()
  const offset = now.getDate() >= startDay ? 0 : -1
  const from = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, startDay))
  const to = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset + 1, startDay - 1))
  return `${shortDay(from)} – ${shortDay(to)}`
}

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true })

const openSettingsInApp = async (page: Page, isMobile: boolean) => {
  if (isMobile) await page.goBack()
  else await mainNav(page).getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page).toHaveURL('/settings')
}

const openBudgets = async (page: Page, isMobile: boolean) => {
  const nav = mainNav(page)
  if (isMobile) {
    await nav.getByRole('link', { name: 'Overview', exact: true }).click()
    await expect(page).toHaveURL('/')
    await page.getByRole('link', { name: 'Budgets by period' }).click()
  } else {
    await nav.getByRole('link', { name: 'Budgets', exact: true }).click()
  }
  await expect(page).toHaveURL('/budgets')
}

const backToSettings = async (page: Page, isMobile: boolean) => {
  for (let step = 0; step < (isMobile ? 2 : 1); step++) await page.goBack()
  await expect(page).toHaveURL('/settings')
}

test('shows every section with the data of the demo user', async ({ page, isMobile }) => {
  await openSettings(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await expect(page.getByText('Account', { exact: true })).toBeVisible()
  for (const name of sectionTitles) {
    await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible()
  }
  await expect(profile(page).getByLabel('Email', { exact: true })).toHaveValue('anna@demo.mita.app')
  await expect(combobox(page, 'Base currency')).toHaveText('PLN — zł')
  await expect(combobox(page, 'Language')).toHaveText('English')
  await expect(combobox(page, 'Start of the financial month')).toHaveText('Day 1')
  await expect(combobox(page, 'Theme')).toHaveText('System')

  const first = await profile(page).boundingBox()
  const second = await region(page).boundingBox()
  if (!first || !second) throw new Error('The sections are not rendered')
  if (isMobile) expect(second.y).toBeGreaterThanOrEqual(first.y + first.height)
  else expect(second.x).toBeGreaterThanOrEqual(first.x + first.width)
})

test('validates the profile, maps server errors and saves it', async ({ page }) => {
  await openSettings(page)
  const form = profile(page)
  const email = form.getByLabel('Email', { exact: true })
  const save = form.getByRole('button', { name: 'Save' })

  await email.fill('anna@')
  await email.blur()
  await expect(form.getByText('Enter a valid email address.')).toBeVisible()
  await save.click()
  await expect(email).toBeFocused()

  await email.fill(' OLEH@demo.mita.app ')
  await save.click()
  await expect(form.getByText('This email is already in use.')).toBeVisible()
  await expect(email).toBeFocused()

  await email.fill('anna@demo.mita.app')
  await nameField(page).fill('Anna Kowalska')
  await save.click()
  await expect(page.getByText('Profile saved')).toBeVisible()
  await page.reload()
  await expect(nameField(page)).toHaveValue('Anna Kowalska')
})

test('switches the language and keeps it after a reload', async ({ page }) => {
  await openSettings(page)
  await combobox(page, 'Language').click()
  await page.getByRole('option', { name: 'Polski', exact: true }).click()
  await expect(page).toHaveURL('/pl/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Ustawienia' })).toBeVisible()
  await expect(combobox(page, 'Język')).toHaveText('Polski')
  await expect(combobox(page, 'Język')).toBeFocused()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Ustawienia' })).toBeVisible()
  await expect(combobox(page, 'Język')).toHaveText('Polski')
})

test('switches the theme and keeps it after a reload', async ({ page }) => {
  await openSettings(page)
  const html = page.locator('html')
  await expect(html).not.toHaveClass(/dark/)
  await choose(page, combobox(page, 'Theme'), 'Dark')
  await expect(html).toHaveClass(/dark/)
  await expect(page.getByText('Settings saved')).toBeVisible()
  await page.reload()
  await expect(html).toHaveClass(/dark/)
  await expect(combobox(page, 'Theme')).toHaveText('Dark')
})

test('a new month start moves the budget period without a reload', async ({ page, isMobile }) => {
  await openSettings(page)
  await page.evaluate(() => Reflect.set(window, 'mitaSamePage', true))
  const periodSwitch = page.getByRole('group', { name: 'Period', exact: true })

  await openBudgets(page, isMobile)
  await expect(periodSwitch).toHaveAttribute('title', periodTitle(1))

  await backToSettings(page, isMobile)
  const monthStart = combobox(page, 'Start of the financial month')
  await expect(monthStart).toHaveText('Day 1')
  await choose(page, monthStart, 'Day 10')
  await expect(page.getByText('Settings saved')).toBeVisible()
  await expect(monthStart).toHaveText('Day 10')

  await openBudgets(page, isMobile)
  await expect(periodSwitch).toHaveAttribute('title', periodTitle(10))
  expect(await page.evaluate(() => Reflect.get(window, 'mitaSamePage'))).toBe(true)
})

test('import is announced and export downloads every transaction', async ({ page }) => {
  await openSettings(page)
  const data = section(page, 'Data')
  await data.getByRole('button', { name: 'Import bank statement' }).click()
  await expect(page.getByText('Bank statement import is coming soon')).toBeVisible()

  const downloading = page.waitForEvent('download')
  await data.getByRole('button', { name: 'Export all transactions (CSV)' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe(`mita-transactions-${localIsoDate(new Date())}.csv`)
  await expect(page.getByText(/^Exported \d+ transactions$/)).toBeVisible()
})

test('settings are localized', async ({ page }) => {
  await page.goto('/uk/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Налаштування' })).toBeVisible()
  for (const name of ukSectionTitles) {
    await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible()
  }
  await expect(combobox(page, 'Початок фінансового місяця')).toHaveText('День 1')
})

test('a notification preference is saved at once and persists after a reload', async ({ page }) => {
  await openSettings(page)
  const weekly = page.getByRole('switch', { name: 'Weekly report' })
  const budgetAlerts = page.getByRole('switch', { name: 'Budget alerts' })
  await expect(weekly).not.toBeChecked()
  await expect(budgetAlerts).toBeChecked()
  await expect(page.getByText('Summary every Sunday')).toBeVisible()

  await weekly.check()
  await expect(page.getByText('Settings saved')).toBeVisible()
  await expect(budgetAlerts).toBeEnabled()
  await page.reload()
  await expect(weekly).toBeChecked()
  await expect(budgetAlerts).toBeChecked()
})

test('deleting the account needs the email and restores the demo data', async ({ page, isMobile }) => {
  await openSettings(page)
  await page.evaluate(() => Reflect.set(window, 'mitaSamePage', true))
  await nameField(page).fill('Anna Kowalska')
  await profile(page).getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Profile saved')).toBeVisible()

  const trigger = section(page, 'Data').getByRole('button', { name: 'Delete account' })
  const dialog = page.getByRole('dialog', { name: 'Delete account' })
  const confirmation = dialog.getByLabel('Type anna@demo.mita.app to confirm')
  await trigger.click()
  await expect(confirmation).toBeFocused()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()

  await trigger.click()
  await expect(confirmation).toBeFocused()
  await expect(dialog).toContainText('accounts, transactions, budgets, goals, categories and settings')
  const submit = dialog.getByRole('button', { name: 'Delete account' })
  await expect(submit).toBeDisabled()
  await confirmation.fill('anna@demo.mita')
  await expect(submit).toBeDisabled()
  await confirmation.fill(' ANNA@demo.mita.app ')
  await expect(submit).toBeEnabled()
  await submit.click()

  await expect(page).toHaveURL('/')
  await expect(page.getByText('Account deleted. Demo data restored.')).toBeVisible()
  await openSettingsInApp(page, isMobile)
  await expect(nameField(page)).toHaveValue('Anna Nowak')
  expect(await page.evaluate(() => Reflect.get(window, 'mitaSamePage'))).toBe(true)
})
