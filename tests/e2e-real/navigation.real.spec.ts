import { expect, type Page, type Request, test } from '@playwright/test'

const name = 'Navigation Smoke'
const email = `navigation-${Date.now()}@example.com`
const password = 'navigation-smoke-password'

const pages = [
  { link: 'Overview', path: '/', heading: /^\p{L}+ \d{4}$/u },
  { link: 'Transactions', path: '/transactions', heading: 'Transactions' },
  { link: 'Budgets', path: '/budgets', heading: 'Budgets' },
  { link: 'Goals', path: '/goals', heading: 'Goals' },
  { link: 'Accounts', path: '/accounts', heading: 'Accounts' },
  { link: 'Reports', path: '/reports', heading: 'Reports' },
  { link: 'Tools', path: '/tools', heading: 'Tools' },
  { link: 'Settings', path: '/settings', heading: 'Settings' },
]

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true })
const section = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })

test('a new real user opens every page without errors', async ({ page }) => {
  await page.goto('/register')
  const create = page.getByRole('button', { name: 'Create account', exact: true })
  await expect(create).toBeEnabled()
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await create.click()
  await expect(page).toHaveURL('/')

  const pending = new Set<Request>()
  const failed: string[] = []
  const isApi = (request: Request) => new URL(request.url()).pathname.startsWith('/v1/')
  page.on('request', (request) => {
    if (isApi(request)) pending.add(request)
  })
  page.on('requestfinished', async (request) => {
    if (!isApi(request)) return
    const response = await request.response()
    if (response && response.status() >= 400) failed.push(`${response.status()} ${request.method()} ${request.url()}`)
    pending.delete(request)
  })
  page.on('requestfailed', (request) => {
    if (!isApi(request)) return
    failed.push(`${request.failure()?.errorText ?? 'failed'} ${request.method()} ${request.url()}`)
    pending.delete(request)
  })
  const settled = () => expect.poll(() => ({ pending: pending.size, failed })).toEqual({ pending: 0, failed: [] })

  for (const entry of pages) {
    await mainNav(page).getByRole('link', { name: entry.link, exact: true }).click()
    await expect(page).toHaveURL(entry.path)
    await expect(page.getByRole('heading', { level: 1, name: entry.heading, exact: true })).toBeVisible()
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
    await settled()
    await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0)
  }
  await settled()
  await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0)

  await section(page, 'Data').getByRole('button', { name: 'Delete account' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete account' })
  await dialog.getByLabel('Password', { exact: true }).fill(password)
  await dialog.getByRole('button', { name: 'Delete account' }).click()
  await expect(page).toHaveURL('/login')
})
