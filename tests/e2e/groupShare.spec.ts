import { expect, type Locator, type Page, test } from '@playwright/test'

const SEEDED_TOKEN = 'albania-2026-demo-link-0123456789abcdefghij'
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/

const originOf = (page: Page) => new URL(page.url()).origin
const tokenOf = (link: string) => link.slice(link.lastIndexOf('/') + 1)

const english = { share: 'Share', close: 'Close', path: '/tools/groups/grp_albania' }
const polish = { share: 'Udostępnij', close: 'Zamknij', path: '/pl/tools/groups/grp_albania' }

const openShare = async (page: Page, names = english) => {
  await page.goto(names.path)
  await expect(page.getByRole('heading', { level: 1, name: 'Albania 2026', exact: true })).toBeVisible()
  await page.getByRole('button', { name: names.share, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: names.share, exact: true })
  await expect(dialog.getByRole('button', { name: names.close, exact: true })).toBeFocused()
  return dialog
}

const linkField = (dialog: Locator) => dialog.getByLabel('Link', { exact: true })

const toast = (page: Page, text: string) => page.getByText(text, { exact: true })

const confirmWith = async (page: Page, title: string, message: string, accept: string) => {
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText(title)
  await expect(confirm).toContainText(message)
  await confirm.getByRole('button', { name: accept, exact: true }).click()
}

test('shows the seeded link', async ({ page }) => {
  const dialog = await openShare(page)
  const field = linkField(dialog)
  await expect(field).toHaveValue(`${originOf(page)}/g/${SEEDED_TOKEN}`)
  await expect(field).toHaveAttribute('readonly', '')
  await expect(dialog.getByRole('button', { name: 'Create link', exact: true })).toHaveCount(0)
  for (const name of ['Copy link', 'New link', 'Turn off link']) {
    const box = await dialog.getByRole('button', { name, exact: true }).boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
})

test('gives the Share action a 44px target', async ({ page }) => {
  await page.goto('/tools/groups/grp_albania')
  const box = await page.getByRole('button', { name: 'Share', exact: true }).boundingBox()
  expect(box?.height).toBeGreaterThanOrEqual(44)
  expect(box?.width).toBeGreaterThanOrEqual(44)
})

test('makes a new link', async ({ page }) => {
  const dialog = await openShare(page)
  const field = linkField(dialog)
  await expect(field).toHaveValue(/\/g\/albania-2026-demo-link-/)
  await dialog.getByRole('button', { name: 'New link', exact: true }).click()
  await confirmWith(page, 'Make a new link?', 'The current link stops working.', 'New link')
  await expect(toast(page, 'New link created')).toBeVisible()
  await expect(field).not.toHaveValue(/albania-2026-demo-link/)
  await expect(field).toHaveValue(new RegExp(`^${originOf(page)}/g/[A-Za-z0-9_-]{43}$`))
  expect(tokenOf(await field.inputValue())).toMatch(TOKEN_SHAPE)
  await expect(field).toBeFocused()
})

test('keeps the link when the new one is not confirmed', async ({ page }) => {
  const dialog = await openShare(page)
  await dialog.getByRole('button', { name: 'New link', exact: true }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Make a new link?')
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(confirm).toBeHidden()
  await expect(linkField(dialog)).toHaveValue(`${originOf(page)}/g/${SEEDED_TOKEN}`)
  await expect(toast(page, 'New link created')).toHaveCount(0)
})

test('turns the link off and on', async ({ page }) => {
  const dialog = await openShare(page)
  await dialog.getByRole('button', { name: 'Turn off link', exact: true }).click()
  await confirmWith(page, 'Turn off the link?', 'People with the link can no longer open the group.', 'Turn off link')
  await expect(toast(page, 'Link turned off')).toBeVisible()
  const create = dialog.getByRole('button', { name: 'Create link', exact: true })
  await expect(create).toBeVisible()
  await expect(create).toBeFocused()
  await expect(linkField(dialog)).toHaveCount(0)
  await expect(
    dialog.getByText('Anyone with the link can see the group and add expenses and repayments without an account.'),
  ).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Copy link', exact: true })).toHaveCount(0)

  await create.click()
  await expect(toast(page, 'Link created')).toBeVisible()
  const field = linkField(dialog)
  await expect(field).toHaveValue(new RegExp(`^${originOf(page)}/g/[A-Za-z0-9_-]{43}$`))
  await expect(field).not.toHaveValue(/albania-2026-demo-link/)
  await expect(field).toBeFocused()
  await expect(create).toHaveCount(0)
})

test('keeps the link off after a reload', async ({ page }) => {
  const dialog = await openShare(page)
  await dialog.getByRole('button', { name: 'Turn off link', exact: true }).click()
  await confirmWith(page, 'Turn off the link?', 'People with the link can no longer open the group.', 'Turn off link')
  await expect(toast(page, 'Link turned off')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Share', exact: true }).getByRole('button', { name: 'Create link', exact: true }),
  ).toBeVisible()
})

test('copies the link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const dialog = await openShare(page)
  await dialog.getByRole('button', { name: 'Copy link', exact: true }).click()
  await expect(toast(page, 'Link copied')).toBeVisible()
  const expected = `${originOf(page)}/g/${SEEDED_TOKEN}`
  await expect(linkField(dialog)).toHaveValue(expected)
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected)
})

test('/pl/tools/groups/grp_albania copies a link with the Polish prefix', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const dialog = await openShare(page, polish)
  const expected = `${originOf(page)}/pl/g/${SEEDED_TOKEN}`
  await expect(linkField(dialog)).toHaveValue(expected)
  await dialog.getByRole('button', { name: 'Kopiuj link', exact: true }).click()
  await expect(toast(page, 'Link skopiowany')).toBeVisible()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected)
})

test('selects the link to copy by hand when the clipboard cannot be used', async ({ page }) => {
  const dialog = await openShare(page)
  const copy = dialog.getByRole('button', { name: 'Copy link', exact: true })
  const field = linkField(dialog)
  const failure = 'The link could not be copied. Select it and copy it by hand.'
  const selected = () =>
    field.evaluate((input: HTMLInputElement) => input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0))

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) },
    })
  })
  await copy.click()
  await expect(toast(page, failure)).toHaveCount(1)
  await expect(toast(page, 'Link copied')).toHaveCount(0)
  await expect(field).toBeFocused()
  expect(await selected()).toBe(`${originOf(page)}/g/${SEEDED_TOKEN}`)

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
  })
  await copy.click()
  await expect(toast(page, failure)).toHaveCount(2)
  await expect(toast(page, 'Link copied')).toHaveCount(0)
  await expect(dialog).toBeVisible()
  await expect(field).toBeFocused()
})
