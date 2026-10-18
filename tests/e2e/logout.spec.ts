import { expect, type Page, test } from '@playwright/test'

const expectLoginPage = async (page: Page, previousUserData: string) => {
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  await expect(page.getByText(previousUserData)).toHaveCount(0)
}

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true })

test('signing out from the sidebar lands on the login page and Back shows no data', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The sidebar is a desktop navigation')
  await page.goto('/accounts')
  await expect(page.getByRole('heading', { name: 'Konto główne', exact: true })).toBeVisible()
  await expect(mainNav(page).getByText('Anna Nowak', { exact: true })).toBeVisible()

  await mainNav(page).getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/login')
  await expectLoginPage(page, 'Konto główne')

  await page.goBack()
  await expectLoginPage(page, 'Konto główne')
  await expect(page).toHaveURL('/login?redirect=/accounts')
})

test('signing out from the settings profile lands on the login page and Back shows no data', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Covered through the sidebar on desktop')
  await page.goto('/goals')
  await expect(page.getByRole('heading', { name: 'Wakacje', exact: true })).toBeVisible()
  await mainNav(page).getByRole('link', { name: 'Overview' }).click()
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  const profile = page.getByRole('region', { name: 'Profile', exact: true })
  await expect(profile.getByLabel('Name', { exact: true })).toHaveValue('Anna Nowak')

  await profile.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/login')
  await expectLoginPage(page, 'Wakacje')

  await page.goBack()
  await expectLoginPage(page, 'Anna Nowak')
  await page.goBack()
  await expectLoginPage(page, 'Wakacje')
})

test('signing out from the settings profile also works on desktop', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mobile is covered by the previous test')
  await page.goto('/settings')
  const profile = page.getByRole('region', { name: 'Profile', exact: true })
  await expect(profile.getByLabel('Name', { exact: true })).toHaveValue('Anna Nowak')
  await profile.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/login')
  await expectLoginPage(page, 'Anna Nowak')
})
