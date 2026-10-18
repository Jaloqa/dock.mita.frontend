import { expect, test as setup } from '@playwright/test'
import { SIGNED_IN_STATE } from './signedInState'

setup('signs in as the demo user Anna', async ({ page }) => {
  await page.goto('/login')
  const submit = page.getByRole('button', { name: 'Sign in', exact: true })
  await expect(submit).toBeEnabled()
  await page.getByLabel('Email', { exact: true }).fill('anna@demo.mita.app')
  await page.getByLabel('Password', { exact: true }).fill('demo-password')
  await submit.click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await page.context().storageState({ path: SIGNED_IN_STATE })
})
