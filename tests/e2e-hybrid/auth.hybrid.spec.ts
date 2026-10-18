import { expect, type Page, test } from '@playwright/test'

const name = 'Hybrid Smoke'
const email = `hybrid-${Date.now()}@example.com`
const password = 'hybrid-smoke-password'

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true })
const section = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })
const baseCurrency = (page: Page) => page.getByRole('combobox', { name: 'Base currency', exact: true })
const sessionExpired = (page: Page) => page.getByText('Your session has expired. Sign in again.')

const signIn = async (page: Page) => {
  await page.goto('/login')
  const submit = page.getByRole('button', { name: 'Sign in', exact: true })
  await expect(submit).toBeEnabled()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await submit.click()
}

const openSettings = async (page: Page) => {
  await page.goto('/settings')
  await expect(section(page, 'Profile').getByLabel('Name', { exact: true })).toHaveValue(name)
}

test('a real account registers, keeps its settings, signs out and in, and is deleted', async ({ page }) => {
  await page.goto('/register')
  const create = page.getByRole('button', { name: 'Create account', exact: true })
  await expect(create).toBeEnabled()
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await create.click()
  await expect(page).toHaveURL('/')
  await expect(mainNav(page).getByText(name, { exact: true })).toBeVisible()

  await page.goto('/accounts')
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible()

  await openSettings(page)
  await expect(section(page, 'Demo')).toHaveCount(0)
  const currency = baseCurrency(page)
  await expect(currency).toHaveText('PLN — zł')
  await currency.click()
  await page.getByRole('option', { name: 'EUR — €', exact: true }).click()
  await expect(page.getByText('Settings saved')).toBeVisible()
  await page.reload()
  await expect(baseCurrency(page)).toHaveText('EUR — €')

  await section(page, 'Profile').getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/login')
  await page.waitForLoadState('networkidle')
  await expect(sessionExpired(page)).toHaveCount(0)
  await expect(page).toHaveURL('/login')

  await signIn(page)
  await expect(page).toHaveURL('/')
  await expect(mainNav(page).getByText(name, { exact: true })).toBeVisible()

  await openSettings(page)
  await section(page, 'Data').getByRole('button', { name: 'Delete account' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete account' })
  const passwordInput = dialog.getByLabel('Password', { exact: true })
  const confirmDelete = dialog.getByRole('button', { name: 'Delete account' })
  await passwordInput.fill('not-the-password')
  await confirmDelete.click()
  await expect(dialog.getByText('Wrong password.')).toBeVisible()
  await expect(passwordInput).toBeFocused()

  await page.route('**/v1/me', (route) =>
    route.request().method() === 'DELETE'
      ? route.fulfill({
          status: 429,
          headers: { 'Retry-After': '60' },
          contentType: 'application/problem+json',
          body: JSON.stringify({ title: 'Too many requests', status: 429 }),
        })
      : route.fallback(),
  )
  await passwordInput.fill(password)
  await confirmDelete.click()
  await expect(
    dialog.getByRole('alert').filter({ hasText: 'Too many attempts. Wait a moment and try again.' }),
  ).toBeVisible()
  await page.unroute('**/v1/me')

  await confirmDelete.click()
  await expect(page).toHaveURL('/login')
  await page.waitForLoadState('networkidle')
  await expect(sessionExpired(page)).toHaveCount(0)

  await signIn(page)
  await expect(page.getByRole('alert').filter({ hasText: 'Wrong email or password.' })).toBeVisible()
  await expect(page).toHaveURL('/login')
})
