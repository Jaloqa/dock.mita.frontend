import { expect, type Locator, type Page, test } from '@playwright/test'
import { pickOverlayOption } from './overlayOption'

const TOKEN = 'albania-2026-demo-link-0123456789abcdefghij'
const LINK = `/g/${TOKEN}`
const MEMBER_KEY = `mita.groupMember.${TOKEN}`
const DEAD_LINK = "This link does not work. Ask the group's owner for a new one."
const AGAIN = 'Choose who you are again.'
const ERROR_TITLE = 'Something went wrong'
const anonymous = { storageState: { cookies: [], origins: [] } }

type QueryView = {
  queryKey: unknown[]
  state: { dataUpdatedAt: number; errorUpdatedAt: number; fetchStatus: string }
}
type AppRoot = {
  __vue_app__?: {
    config: { globalProperties: { $queryClient?: { getQueryCache: () => { getAll: () => QueryView[] } } } }
  }
}

const requestedKeys = (page: Page): Promise<unknown[][] | undefined> =>
  page.evaluate(() => {
    const root = document.querySelector('#__nuxt') as unknown as AppRoot | null
    return root?.__vue_app__?.config.globalProperties.$queryClient
      ?.getQueryCache()
      .getAll()
      .filter(({ state }) => state.dataUpdatedAt > 0 || state.errorUpdatedAt > 0 || state.fetchStatus !== 'idle')
      .map((query) => query.queryKey)
  })

const throughLink = (key: unknown[]) =>
  key[0] === 'me' ||
  (key[0] === 'groups' && key[1] === 'link' && key[2] === TOKEN) ||
  (key[0] === 'rates' && key[1] === `/v1/shared/groups/${TOKEN}/rates`)

const expectOnlyLinkRequests = async (page: Page) => {
  const keys = (await requestedKeys(page)) ?? []
  expect(keys.some((key) => key[0] === 'groups')).toBe(true)
  expect(keys.filter((key) => !throughLink(key))).toEqual([])
}

const chooser = (page: Page, name = 'Who are you?') => page.getByRole('region', { name, exact: true })
const groupHeading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Albania 2026', exact: true })
const youAre = (page: Page, name: string) => page.getByText(`You are ${name}`, { exact: true })
const changeButton = (page: Page) => page.getByRole('button', { name: 'Change', exact: true })

const expenses = (page: Page) => page.getByRole('region', { name: 'Expenses', exact: true })
const row = (page: Page, title: string) => expenses(page).getByRole('article', { name: title, exact: true })
const balanceRow = (page: Page, name: string) =>
  page
    .getByRole('region', { name: 'Balances', exact: true })
    .getByRole('list', { name: 'Balance of each member', exact: true })
    .getByRole('listitem')
    .filter({ has: page.getByText(name, { exact: true }) })

const chooseAs = async (page: Page, name: string) => {
  await chooser(page).getByRole('button', { name, exact: true }).click()
  await expect(groupHeading(page)).toBeVisible()
  await expect(youAre(page, name)).toBeVisible()
}

const openLinkAs = async (page: Page, name: string) => {
  await page.goto(LINK)
  await expect(chooser(page)).toBeVisible()
  await chooseAs(page, name)
}

const pickInDialog = async (page: Page, dialog: Locator, label: string, option: string, shown = option) => {
  const field = dialog.getByRole('combobox', { name: label, exact: true })
  await field.click()
  await pickOverlayOption(page, option)
  await expect(field).toContainText(shown)
  await expect(page.locator('[data-pc-section="overlay"]')).toHaveCount(0)
}

const addExpense = async (page: Page, payer: string, amount: string, description: string) => {
  await page.getByRole('button', { name: 'Add expense', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New expense', exact: true })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await pickInDialog(page, dialog, 'Paid by', payer)
  await dialog.getByLabel('Amount', { exact: true }).pressSequentially(amount)
  await dialog.getByLabel('Description', { exact: true }).fill(description)
  return dialog
}

const shareNewGroup = async (page: Page, name: string) => {
  await page.goto('/tools/groups')
  await page.getByRole('button', { name: 'New group', exact: true }).click()
  const create = page.getByRole('dialog', { name: 'New group', exact: true })
  await create.getByLabel('Name', { exact: true }).fill(name)
  await create.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  const share = page.getByRole('dialog', { name: 'Share', exact: true })
  await share.getByRole('button', { name: 'Create link', exact: true }).click()
  const field = share.getByLabel('Link', { exact: true })
  await expect(field).toHaveValue(/\/g\/[A-Za-z0-9_-]{43}$/)
  const link = new URL(await field.inputValue())
  await share.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(share).toBeHidden()
  return link.pathname
}

const storedMember = (page: Page) => page.evaluate((key) => window.localStorage.getItem(key), MEMBER_KEY)

const errorToasts = (page: Page) => page.getByRole('alert').filter({ hasText: ERROR_TITLE })

test.describe('without an account', () => {
  test.use(anonymous)

  test('asks who you are and remembers it', async ({ page }) => {
    const response = await page.goto(LINK)
    expect(response?.headers()['referrer-policy']).toBe('no-referrer')
    const question = chooser(page)
    await expect(question.getByRole('heading', { level: 1, name: 'Who are you?', exact: true })).toBeVisible()
    await expect(question).toContainText('Albania 2026')
    await expect(question).toContainText('Pick your name. This browser remembers it.')
    await expect(question).not.toContainText(AGAIN)
    await expect(question.getByRole('button')).toHaveText(['Anna', 'Olya', 'Max', 'Kasia'])
    for (const button of await question.getByRole('button').all()) {
      expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    }
    await expect(page).toHaveURL(LINK)
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')

    await chooseAs(page, 'Olya')
    await expect(page).toHaveTitle('Albania 2026 · Mita')
    await expect(balanceRow(page, 'Anna')).toContainText('+€42.32')
    await expect(changeButton(page)).toBeFocused()
    expect(await storedMember(page)).toBe('gmb_olya')

    await page.reload()
    await expect(groupHeading(page)).toBeVisible()
    await expect(youAre(page, 'Olya')).toBeVisible()
    await expect(chooser(page)).toHaveCount(0)
    const change = changeButton(page)
    const box = await change.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
    expect(box?.width).toBeGreaterThanOrEqual(44)

    await change.click()
    await expect(chooser(page).getByRole('heading', { level: 1, name: 'Who are you?', exact: true })).toBeFocused()
    await expect(youAre(page, 'Olya')).toHaveCount(0)
    await expect(groupHeading(page)).toHaveCount(0)
    await expectOnlyLinkRequests(page)
  })

  test('adds an expense as the chosen member', async ({ page }) => {
    await openLinkAs(page, 'Olya')
    const dialog = await addExpense(page, 'Olya', '8', 'Ice cream')
    await pickInDialog(page, dialog, 'Currency', 'PLN — Polish Zloty', 'PLN')
    await expect(dialog.getByLabel('Exchange rate (PLN → EUR)', { exact: true })).toHaveValue(/^0\.\d+$/)
    await pickInDialog(page, dialog, 'Currency', 'EUR — Euro', 'EUR')
    await expect(dialog.getByLabel('Exchange rate (PLN → EUR)', { exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByText('Expense added')).toBeVisible()
    await expect(dialog).toBeHidden()
    const iceCream = row(page, 'Ice cream')
    await expect(iceCream).toContainText('Paid by Olya')
    await expect(iceCream).toContainText('€8.00')
    await expect(iceCream).toContainText('Added by Olya')

    await iceCream.getByRole('button', { name: 'History of Ice cream', exact: true }).click()
    const history = page.getByRole('dialog', { name: 'History of Ice cream', exact: true })
    await expect(history.getByRole('list', { name: 'Changes', exact: true }).locator(':scope > li')).toHaveCount(1)
    await expect(history).toContainText('Added by Olya')
    await expectOnlyLinkRequests(page)
    expect((await requestedKeys(page))?.some((key) => key[0] === 'rates')).toBe(true)
  })

  test('hides what only the owner can do', async ({ page }) => {
    await openLinkAs(page, 'Olya')
    await expect(page.getByRole('button', { name: 'Add expense', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Record repayment', exact: true }).first()).toBeVisible()
    await expect(row(page, 'Dinner')).toBeVisible()
    for (const name of ['Members', 'Edit group', 'Share']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }
    await expect(page.getByRole('navigation')).toHaveCount(0)
    await expect(page.getByRole('link')).toHaveCount(0)
  })

  test('asks again when the member is gone', async ({ page }) => {
    await page.addInitScript((key) => window.localStorage.setItem(key, 'gmb_gone'), MEMBER_KEY)
    await page.goto(LINK)
    const question = chooser(page)
    await expect(question.getByRole('heading', { level: 1, name: 'Who are you?', exact: true })).toBeVisible()
    await expect(question.getByRole('alert')).toHaveText(AGAIN)
    await expect(question.getByRole('button')).toHaveText(['Anna', 'Olya', 'Max', 'Kasia'])
    await expect.poll(() => storedMember(page)).toBeNull()

    await chooseAs(page, 'Max')
    expect(await storedMember(page)).toBe('gmb_max')
  })

  test('shows a dead link', async ({ page }) => {
    await page.goto('/g/unknown-token-unknown-token-unknown-token-x')
    await expect(page.getByText(DEAD_LINK, { exact: true })).toBeVisible()
    await expect(page).toHaveURL('/g/unknown-token-unknown-token-unknown-token-x')
    await expect(chooser(page)).toHaveCount(0)
    await expect(page.getByRole('navigation')).toHaveCount(0)
    await expect(page.getByRole('link')).toHaveCount(0)
  })

  test('shows a dead link for a malformed token without asking for it', async ({ page }) => {
    await page.goto('/g/not-a-share-token')
    await expect(page.getByText(DEAD_LINK, { exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Language', exact: true })).toBeVisible()
    await expect.poll(async () => (await requestedKeys(page))?.map((key) => key[0])).toEqual(['me'])
  })

  test('/pl/g/<token> asks in Polish', async ({ page }) => {
    await page.goto(`/pl${LINK}`)
    const question = chooser(page, 'Kim jesteś?')
    await expect(question.getByRole('heading', { level: 1, name: 'Kim jesteś?', exact: true })).toBeVisible()
    await expect(question).toContainText('Wybierz swoje imię. Ta przeglądarka je zapamięta.')
    await expect(page).toHaveURL(`/pl${LINK}`)
  })

  test('answers every locale variant of the link page with Referrer-Policy no-referrer', async ({ request }) => {
    const linkPages = [LINK, `/pl${LINK}`, `/ru${LINK}`, `/uk${LINK}`, '/g/unknown-token-unknown-token-unknown-token-x']
    for (const path of linkPages) {
      expect((await request.get(path)).headers()['referrer-policy'], path).toBe('no-referrer')
    }
    expect((await request.get('/login')).headers()['referrer-policy']).toBeUndefined()
  })
})

test('lets a signed-in visitor act as the member they choose', async ({ page }) => {
  await page.goto(LINK)
  await expect(chooser(page)).toBeVisible()
  await expect(page).toHaveURL(LINK)
  await chooseAs(page, 'Anna')

  const dialog = await addExpense(page, 'Anna', '3', 'Coffee')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Expense added')).toBeVisible()
  const coffee = row(page, 'Coffee')
  await expect(coffee).toContainText('Added by Anna')
  await expect(coffee).not.toContainText('Anna Nowak')
  await expectOnlyLinkRequests(page)

  await page.goto('/tools/groups/grp_albania')
  await expect(groupHeading(page)).toBeVisible()
  await expect(row(page, 'Coffee')).toContainText('Added by Anna')
  await expect(row(page, 'Coffee')).not.toContainText('Anna Nowak')
})

test('asks again when the chosen member is removed before a write', async ({ page, context }) => {
  const owner = await context.newPage()
  await owner.goto('/tools/groups/grp_albania')
  await expect(groupHeading(owner)).toBeVisible()
  await owner.getByRole('button', { name: 'Members', exact: true }).click()
  const members = owner.getByRole('dialog', { name: 'Members', exact: true })
  await members.getByLabel('New member', { exact: true }).fill('Zoe')
  await members.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(owner.getByText('Member added')).toBeVisible()

  await openLinkAs(page, 'Zoe')

  await members.getByRole('button', { name: 'Remove Zoe', exact: true }).click()
  await expect(owner.getByText('Member removed')).toBeVisible()

  const dialog = await addExpense(page, 'Anna', '5', 'Snacks')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  const question = chooser(page)
  await expect(question.getByRole('alert')).toHaveText(AGAIN)
  await expect(question.getByRole('button')).toHaveText(['Anna', 'Olya', 'Max', 'Kasia'])
  await expect(dialog).toBeHidden()
  await expect(errorToasts(page)).toHaveCount(0)
  expect(await storedMember(page)).toBeNull()

  await chooseAs(page, 'Olya')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(changeButton(page)).toBeFocused()
  await expect(row(page, 'Snacks')).toHaveCount(0)
  await expect(errorToasts(page)).toHaveCount(0)

  await owner.reload()
  await expect(groupHeading(owner)).toBeVisible()
  await expect(row(owner, 'Dinner')).toBeVisible()
  await expect(row(owner, 'Snacks')).toHaveCount(0)
})

test('tells a link holder that repayments wait for a second member', async ({ page }) => {
  const link = await shareNewGroup(page, 'Rome')

  await page.goto(link)
  await chooser(page).getByRole('button', { name: 'Anna Nowak', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Rome', exact: true })).toBeVisible()
  const hint = 'The group needs a second member before repayments can be recorded.'
  await expect(page.getByText(hint, { exact: true })).toBeVisible()
  await expect(page.getByText('Add a second member to record repayments.', { exact: true })).toHaveCount(0)
  const record = page.getByRole('button', { name: 'Record repayment', exact: true }).first()
  await expect(record).toBeDisabled()
  await expect(record).toHaveAccessibleDescription(hint)
  await expect(page.getByRole('button', { name: 'Add expense', exact: true }).first()).toBeEnabled()
})

test('tells a link holder to ask the owner when the group has no members', async ({ page }) => {
  const link = await shareNewGroup(page, 'Oslo')
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  const members = page.getByRole('dialog', { name: 'Members', exact: true })
  await members.getByRole('button', { name: 'Remove Anna Nowak', exact: true }).click()
  await expect(page.getByText('Member removed')).toBeVisible()
  await expect(members.getByText('No members yet.', { exact: true })).toBeVisible()

  await page.goto(link)
  const question = chooser(page)
  await expect(question.getByRole('heading', { level: 1, name: 'Who are you?', exact: true })).toBeVisible()
  await expect(question).toContainText("No members yet. Ask the group's owner to add members.")
  await expect(question).not.toContainText('Pick your name.')
  await expect(question.getByRole('button')).toHaveCount(0)
})
