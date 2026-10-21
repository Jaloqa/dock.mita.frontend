import { expect, type Locator, type Page } from '@playwright/test'

const overlay = (page: Page): Locator => page.locator('[data-pc-section="overlay"]')

export const overlayOption = (page: Page, name: string): Locator =>
  overlay(page).getByRole('option', { name, exact: true })

export const pickOverlayOption = async (page: Page, name: string) => {
  const option = overlayOption(page, name)
  await expect(option).toBeVisible()
  // Clicking while the overlay still plays its enter animation makes Playwright retry with forced scroll
  // alignments, which scroll the page behind a modal and move the body-anchored overlay away from the pointer.
  await expect.poll(() => overlay(page).evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  await option.click()
}
