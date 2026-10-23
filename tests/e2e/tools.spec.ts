import { expect, type Page, test } from '@playwright/test'

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true })
const toolList = (page: Page, name: string) => page.getByRole('list', { name, exact: true })

test('the sidebar opens the tools hub with the debts entry', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the sidebar is the desktop layout')
  await page.goto('/')
  const link = mainNav(page).getByRole('link', { name: 'Tools', exact: true })
  await expect(link).not.toHaveAttribute('aria-current', 'page')
  await link.click()
  await expect(page).toHaveURL('/tools')
  await expect(page.getByRole('heading', { level: 1, name: 'Tools', exact: true })).toBeVisible()
  await expect(page.getByText('Extras', { exact: true })).toBeVisible()
  await expect(link).toHaveAttribute('aria-current', 'page')
  await expect(page).toHaveTitle('Tools · Mita')
  const entries = toolList(page, 'Tools').getByRole('link')
  await expect(entries).toHaveCount(1)
  await expect(entries.first()).toHaveAccessibleName('Debts')
  await expect(entries.first()).toHaveAccessibleDescription('Money you lent or borrowed, and what is left to repay')
  await expect(entries.first()).toHaveAttribute('href', /\/tools\/debts$/)
})

test('the debts entry is a touch target that takes the keyboard focus', async ({ page }) => {
  await page.goto('/tools')
  const entry = toolList(page, 'Tools').getByRole('link', { name: 'Debts', exact: true })
  await expect(entry).toBeVisible()
  expect((await entry.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  await entry.focus()
  await expect(entry).toBeFocused()
})

test('the mobile overview links to the tools hub', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout')
  await page.goto('/')
  await page.getByRole('link', { name: 'Tools', exact: true }).filter({ visible: true }).click()
  await expect(page).toHaveURL('/tools')
  await expect(page.getByRole('heading', { level: 1, name: 'Tools', exact: true })).toBeVisible()
  await expect(toolList(page, 'Tools').getByRole('link', { name: 'Debts', exact: true })).toBeVisible()
})

const localized = [
  { path: '/pl/tools', menu: 'Menu główne', title: 'Narzędzia', entry: 'Długi' },
  { path: '/ru/tools', menu: 'Главное меню', title: 'Инструменты', entry: 'Долги' },
  { path: '/uk/tools', menu: 'Головне меню', title: 'Інструменти', entry: 'Борги' },
]

for (const { path, menu, title, entry } of localized) {
  test(`${path} shows the hub in its own language`, async ({ page, isMobile }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
    const link = toolList(page, title).getByRole('link', { name: entry, exact: true })
    await expect(link).toBeVisible()
    if (!isMobile) {
      const sidebarLink = page.getByRole('navigation', { name: menu }).getByRole('link', { name: title, exact: true })
      await expect(sidebarLink).toHaveAttribute('aria-current', 'page')
    }
  })
}
