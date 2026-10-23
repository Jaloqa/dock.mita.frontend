import { expect, type Locator, type Page, test } from '@playwright/test'

const sectionTitles = ['Profile', 'Currency and region', 'Notifications', 'Data', 'Demo']
const ukSectionTitles = ['Профіль', 'Валюта і регіон', 'Сповіщення', 'Дані', 'Демо']

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
  await expect(combobox(page, 'Base currency')).toHaveText('PLN — Polish Zloty')
  await expect(combobox(page, 'Language')).toHaveText('English')
  await expect(combobox(page, 'Start of the financial month')).toHaveText('Day 1')
  await expect(combobox(page, 'Theme')).toHaveText('System')

  const first = await profile(page).boundingBox()
  const second = await region(page).boundingBox()
  if (!first || !second) throw new Error('The sections are not rendered')
  if (isMobile) expect(second.y).toBeGreaterThanOrEqual(first.y + first.height)
  else expect(second.x).toBeGreaterThanOrEqual(first.x + first.width)
})

test('offers only the four base currencies as the base currency', async ({ page }) => {
  await openSettings(page)
  const currency = combobox(page, 'Base currency')
  await currency.click()
  await expect(page.getByRole('listbox').getByRole('option')).toHaveText([
    'PLN — Polish Zloty',
    'EUR — Euro',
    'USD — US Dollar',
    'UAH — Ukrainian Hryvnia',
  ])
  await expect(page.getByRole('searchbox')).toHaveCount(0)
  await currency.click()
  await expect(currency).toHaveAttribute('aria-expanded', 'false')
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

test('data lists tag management after category management', async ({ page }) => {
  await openSettings(page)
  const names = await section(page, 'Data').getByRole('button').allTextContents()
  const trimmed = names.map((name) => name.trim())
  expect(trimmed.indexOf('Manage tags')).toBe(trimmed.indexOf('Manage categories') + 1)
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
  await expect(dialog).toContainText('accounts, transactions, budgets, goals, debts, categories and settings')
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

type DemoUser = 'anna' | 'oleh'

const accountsScreen = { link: 'Accounts', url: '/accounts', anna: 'Konto główne', oleh: 'Основна картка' }
const goalsScreen = { link: 'Goals', url: '/goals', anna: 'Wakacje', oleh: 'Ноутбук' }

const visitUserScreens = async (page: Page, isMobile: boolean, user: DemoUser) => {
  const other: DemoUser = user === 'anna' ? 'oleh' : 'anna'
  for (const screen of isMobile ? [goalsScreen] : [accountsScreen, goalsScreen]) {
    await page.evaluate((text) => {
      const seen = { other: false }
      const observer = new MutationObserver(() => {
        if (document.querySelector('main')?.textContent?.includes(text)) seen.other = true
      })
      observer.observe(document.body, { childList: true, subtree: true, characterData: true })
      Reflect.set(window, 'mitaOtherUser', { seen, observer })
    }, screen[other])
    await mainNav(page).getByRole('link', { name: screen.link, exact: true }).click()
    await expect(page).toHaveURL(screen.url)
    await expect(page.getByRole('heading', { name: screen[user], exact: true })).toBeVisible()
    await expect(page.getByText(screen[other])).toHaveCount(0)
    const otherShown = await page.evaluate(() => {
      const { seen, observer } = Reflect.get(window, 'mitaOtherUser')
      observer.disconnect()
      return seen.other
    })
    expect(otherShown).toBe(false)
  }
}

test('switching the demo user shows only the data of that user', async ({ page, isMobile }) => {
  await openSettings(page)
  await page.evaluate(() => Reflect.set(window, 'mitaSamePage', true))
  await visitUserScreens(page, isMobile, 'anna')
  await openSettingsInApp(page, isMobile)

  const demoUser = combobox(page, 'Demo user')
  await expect(demoUser).toHaveText('Anna Nowak')
  await choose(page, demoUser, 'Oleh Kravets')
  await expect(page.getByText('Switched to Oleh Kravets')).toBeVisible()
  await expect(demoUser).toBeFocused()
  await expect(nameField(page)).toHaveValue('Oleh Kravets')
  await expect(profile(page).getByLabel('Email', { exact: true })).toHaveValue('oleh@demo.mita.app')
  await expect(combobox(page, 'Base currency')).toHaveText('UAH — Ukrainian Hryvnia')
  await expect(combobox(page, 'Start of the financial month')).toHaveText('Day 10')

  await visitUserScreens(page, isMobile, 'oleh')
  await openSettingsInApp(page, isMobile)
  await expect(nameField(page)).toHaveValue('Oleh Kravets')
  await choose(page, combobox(page, 'Demo user'), 'Anna Nowak')
  await expect(page.getByText('Switched to Anna Nowak')).toBeVisible()
  await expect(nameField(page)).toHaveValue('Anna Nowak')
  await expect(combobox(page, 'Base currency')).toHaveText('PLN — Polish Zloty')

  await visitUserScreens(page, isMobile, 'anna')
  expect(await page.evaluate(() => Reflect.get(window, 'mitaSamePage'))).toBe(true)
})

test('resetting the demo data restores the seed', async ({ page }) => {
  await openSettings(page)
  await nameField(page).fill('Anna Kowalska')
  await profile(page).getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Profile saved')).toBeVisible()

  await section(page, 'Demo').getByRole('button', { name: 'Reset demo data' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('All changes will be lost')
  await confirm.getByRole('button', { name: 'Reset demo data' }).click()
  await expect(page.getByText('Demo data restored', { exact: true })).toBeVisible()
  await expect(nameField(page)).toHaveValue('Anna Nowak')
})

test('the simulated network errors switch persists after a reload', async ({ page }) => {
  await openSettings(page)
  const errors = page.getByRole('switch', { name: 'Simulate network errors' })
  await expect(page.getByText('About 1 in 5 requests fails')).toBeVisible()
  await expect(errors).not.toBeChecked()
  await errors.check()
  await expect(page.getByText('Settings saved')).toBeVisible()
  await page.reload()
  await expect(errors).toBeChecked()
  await errors.uncheck()
  await expect(errors).not.toBeChecked()
  await expect(page.getByText('Settings saved')).toBeVisible()
})

test('a failed save shows an error and keeps the stored values', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => (Reflect.get(window, 'mitaFail') === true ? 0 : 0.99)
  })
  await openSettings(page)
  await page.getByRole('switch', { name: 'Simulate network errors' }).check()
  await expect(page.getByText('Settings saved')).toBeVisible()
  await page.evaluate(() => Reflect.set(window, 'mitaFail', true))

  const serverError = page
    .getByRole('alert')
    .filter({ hasText: 'The server could not complete the request. Please try again.' })
  const dismissServerError = async () => {
    await expect(serverError).toHaveCount(1)
    await serverError.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(serverError).toHaveCount(0)
  }
  const currency = combobox(page, 'Base currency')
  await choose(page, currency, 'EUR — Euro')
  await dismissServerError()
  await expect(currency).toHaveText('PLN — Polish Zloty')

  const language = combobox(page, 'Language')
  await language.click()
  await page.getByRole('option', { name: 'Polski', exact: true }).click()
  await expect(language).toHaveAttribute('aria-expanded', 'false')
  await dismissServerError()
  await expect(language).toHaveText('English')
  await expect(page).toHaveURL('/settings')

  const weekly = page.getByRole('switch', { name: 'Weekly report' })
  await weekly.click()
  await dismissServerError()
  await expect(weekly).toBeEnabled()
  await expect(weekly).not.toBeChecked()
})
