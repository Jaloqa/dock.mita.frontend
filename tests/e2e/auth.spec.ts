import { expect, type Page, test } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

const ANNA = 'anna@demo.mita.app'
const DEMO_PASSWORD = 'demo-password'

const emailField = (page: Page) => page.getByLabel('Email', { exact: true })
const passwordField = (page: Page) => page.getByLabel('Password', { exact: true })
const redirectingTo = (path: string, redirect: string) => (url: URL) =>
  url.pathname === path && url.searchParams.get('redirect') === redirect
const message = (page: Page) => page.getByRole('alert').filter({ hasText: /\S/ })

const open = async (page: Page, path: string) => {
  await page.goto(path)
  await expect(page.locator('form button[type="submit"]')).toBeEnabled()
}

const signIn = async (page: Page, email: string, password: string) => {
  await emailField(page).fill(email)
  await passwordField(page).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

const fillRegistration = async (page: Page, name: string, email: string, password: string) => {
  await page.getByLabel('Name', { exact: true }).fill(name)
  await emailField(page).fill(email)
  await passwordField(page).fill(password)
}

test('an anonymous visit to a protected page signs in and returns there', async ({ page }) => {
  await open(page, '/budgets')
  await expect(page).toHaveURL(redirectingTo('/login', '/budgets'))
  await expect(page).toHaveTitle('Sign in · Mita')
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  await expect(page.getByText(`${ANNA} or oleh@demo.mita.app, password ${DEMO_PASSWORD}`)).toBeVisible()

  await signIn(page, ANNA, DEMO_PASSWORD)
  await expect(page).toHaveURL('/budgets')
  await expect(page.getByRole('heading', { level: 1, name: 'Budgets' })).toBeVisible()
})

test('the form is validated before it is sent', async ({ page }) => {
  await open(page, '/login')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('This field is required.')).toHaveCount(2)
  await expect(emailField(page)).toBeFocused()

  await passwordField(page).fill('secret')
  const toggle = page.getByRole('button', { name: 'Show password' })
  await expect(passwordField(page)).toHaveAttribute('type', 'password')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(passwordField(page)).toHaveAttribute('type', 'text')
})

test('a wrong password shows the invalid credentials message', async ({ page }) => {
  await open(page, '/login')
  await signIn(page, ANNA, 'wrong-password')
  await expect(message(page)).toHaveText('Wrong email or password.')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
  await expect(page).toHaveURL('/login')
})

test('an expired session is explained above the form', async ({ page }) => {
  await open(page, '/login?redirect=%2Freports&expired=1')
  await expect(message(page)).toHaveText('Your session has expired. Sign in again.')
  await signIn(page, ANNA, DEMO_PASSWORD)
  await expect(page).toHaveURL('/reports')
})

test('registering a new user lands on the overview of that user', async ({ page }) => {
  await open(page, '/register')
  await expect(page).toHaveTitle('Create account · Mita')
  await expect(page.getByText('Min. 10 characters')).toBeVisible()
  await fillRegistration(page, 'Ewa Lis', 'ewa@example.com', 'too-short')
  await passwordField(page).blur()
  await expect(page.getByText('Use at least 10 characters.')).toBeVisible()

  await passwordField(page).fill('long-enough-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Start with an account' })).toBeVisible()
  await expect(page.getByText('Konto główne')).toHaveCount(0)

  await page.goto('/settings')
  const profile = page.getByRole('region', { name: 'Profile', exact: true })
  await expect(profile.getByLabel('Name', { exact: true })).toHaveValue('Ewa Lis')
  await expect(profile.getByLabel('Email', { exact: true })).toHaveValue('ewa@example.com')
})

test('registering with an existing email shows the error on the email field', async ({ page }) => {
  await open(page, '/register')
  await fillRegistration(page, 'Anna Bis', ' ANNA@demo.mita.app ', 'long-enough-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('This email is already in use.')).toBeVisible()
  await expect(emailField(page)).toBeFocused()
  await expect(emailField(page)).toHaveAttribute('aria-invalid', 'true')
  await expect(page).toHaveURL('/register')

  await emailField(page).blur()
  await expect(page.getByText('This email is already in use.')).toBeVisible()
  await emailField(page).fill('ewa.nowak@example.com')
  await expect(page.getByText('This email is already in use.')).toHaveCount(0)
})

test('a redirect to another site is ignored after signing in', async ({ page }) => {
  await open(page, '/login?redirect=//evil.example')
  await signIn(page, ANNA, DEMO_PASSWORD)
  await expect(page).toHaveURL('/')
})

test('the links between signing in and registering keep the redirect', async ({ page }) => {
  await open(page, '/login?redirect=%2Fgoals')
  await page.getByRole('link', { name: 'Create one' }).click()
  await expect(page).toHaveURL(redirectingTo('/register', '/goals'))
  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(redirectingTo('/login', '/goals'))
})

test('the language and theme can be switched before signing in', async ({ page }) => {
  await open(page, '/login?redirect=%2Fbudgets')
  const html = page.locator('html')
  await page.getByRole('combobox', { name: 'Theme', exact: true }).click()
  await page.getByRole('option', { name: 'Dark', exact: true }).click()
  await expect(html).toHaveClass(/dark/)

  await page.getByRole('combobox', { name: 'Language', exact: true }).click()
  await page.getByRole('option', { name: 'Polski', exact: true }).click()
  await expect(page).toHaveURL(redirectingTo('/pl/login', '/budgets'))
  await expect(page.getByRole('heading', { level: 1, name: 'Zaloguj się' })).toBeVisible()
})

test('the pages render in Polish and Ukrainian', async ({ page }) => {
  await page.goto('/pl/login')
  await expect(page).toHaveTitle('Zaloguj się · Mita')
  await expect(page.getByRole('heading', { level: 1, name: 'Zaloguj się' })).toBeVisible()
  await expect(page.getByLabel('Hasło', { exact: true })).toBeVisible()

  await page.goto('/uk/register')
  await expect(page).toHaveTitle('Реєстрація · Mita')
  await expect(page.getByRole('heading', { level: 1, name: 'Реєстрація' })).toBeVisible()
  await expect(page.getByText('Мінімум 10 символів')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Створити акаунт' })).toBeVisible()
})
