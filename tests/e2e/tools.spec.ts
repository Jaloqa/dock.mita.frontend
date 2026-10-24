import { expect, type Page, test } from '@playwright/test'

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' }).filter({ visible: true })
const toolList = (page: Page, name: string) => page.getByRole('list', { name, exact: true })

test('the sidebar opens the tools hub with the groups and debts entries', async ({ page, isMobile }) => {
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
  await expect(entries).toHaveCount(2)
  await expect(entries.first()).toHaveAccessibleName('Groups')
  await expect(entries.first()).toHaveAccessibleDescription('Shared expenses with friends and who owes whom')
  await expect(entries.first()).toHaveAttribute('href', /\/tools\/groups$/)
  await expect(entries.last()).toHaveAccessibleName('Debts')
  await expect(entries.last()).toHaveAccessibleDescription('Money you lent or borrowed, and what is left to repay')
  await expect(entries.last()).toHaveAttribute('href', /\/tools\/debts$/)
})

for (const name of ['Groups', 'Debts']) {
  test(`the ${name} entry is a touch target that takes the keyboard focus`, async ({ page }) => {
    await page.goto('/tools')
    const entry = toolList(page, 'Tools').getByRole('link', { name, exact: true })
    await expect(entry).toBeVisible()
    expect((await entry.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    await entry.focus()
    await expect(entry).toBeFocused()
  })
}

test('the groups entry opens the groups page and its eyebrow link returns to the hub', async ({ page }) => {
  await page.goto('/tools')
  await toolList(page, 'Tools').getByRole('link', { name: 'Groups', exact: true }).click()
  await expect(page).toHaveURL('/tools/groups')
  await expect(page.getByRole('heading', { level: 1, name: 'Groups', exact: true })).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Tools', exact: true }).click()
  await expect(page).toHaveURL('/tools')
  await expect(page.getByRole('heading', { level: 1, name: 'Tools', exact: true })).toBeVisible()
})

test('the debts entry opens the debts page and its eyebrow link returns to the hub', async ({ page }) => {
  await page.goto('/tools')
  await toolList(page, 'Tools').getByRole('link', { name: 'Debts', exact: true }).click()
  await expect(page).toHaveURL('/tools/debts')
  await expect(page.getByRole('heading', { level: 1, name: 'Debts', exact: true })).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Tools', exact: true }).click()
  await expect(page).toHaveURL('/tools')
  await expect(page.getByRole('heading', { level: 1, name: 'Tools', exact: true })).toBeVisible()
})

const childPages = [
  { path: '/tools/debts', menu: 'Main navigation', tools: 'Tools', overview: 'Overview' },
  { path: '/pl/tools/debts', menu: 'Menu główne', tools: 'Narzędzia', overview: 'Przegląd' },
  { path: '/tools/groups', menu: 'Main navigation', tools: 'Tools', overview: 'Overview' },
  { path: '/pl/tools/groups', menu: 'Menu główne', tools: 'Narzędzia', overview: 'Przegląd' },
]

for (const { path, menu, tools, overview } of childPages) {
  test(`the sidebar marks Tools as the section of ${path} without calling it the current page`, async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the sidebar is the desktop layout')
    await page.goto(path)
    const nav = page.getByRole('navigation', { name: menu }).filter({ visible: true })
    await expect(nav.getByRole('link', { name: tools, exact: true })).toHaveAttribute('aria-current', 'true')
    await expect(nav.getByRole('link', { name: overview, exact: true })).not.toHaveAttribute('aria-current')
  })
}

test('the mobile overview links to the tools hub', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout')
  await page.goto('/')
  await page.getByRole('link', { name: 'Tools', exact: true }).filter({ visible: true }).click()
  await expect(page).toHaveURL('/tools')
  await expect(page.getByRole('heading', { level: 1, name: 'Tools', exact: true })).toBeVisible()
  await expect(toolList(page, 'Tools').getByRole('link', { name: 'Groups', exact: true })).toBeVisible()
  await expect(toolList(page, 'Tools').getByRole('link', { name: 'Debts', exact: true })).toBeVisible()
})

const localized = [
  { path: '/pl/tools', menu: 'Menu główne', title: 'Narzędzia', entry: 'Długi', groups: 'Grupy' },
  { path: '/ru/tools', menu: 'Главное меню', title: 'Инструменты', entry: 'Долги', groups: 'Группы' },
  { path: '/uk/tools', menu: 'Головне меню', title: 'Інструменти', entry: 'Борги', groups: 'Групи' },
]

for (const { path, menu, title, entry, groups } of localized) {
  test(`${path} shows the hub in its own language`, async ({ page, isMobile }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
    const link = toolList(page, title).getByRole('link', { name: entry, exact: true })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', `${path}/debts`)
    const groupsLink = toolList(page, title).getByRole('link', { name: groups, exact: true })
    await expect(groupsLink).toHaveAttribute('href', `${path}/groups`)
    if (!isMobile) {
      const sidebarLink = page.getByRole('navigation', { name: menu }).getByRole('link', { name: title, exact: true })
      await expect(sidebarLink).toHaveAttribute('aria-current', 'page')
    }
  })
}

const linkAnna = async (page: Page) => {
  await page.goto('/tools/groups/grp_albania')
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  const members = page.getByRole('dialog', { name: 'Members', exact: true })
  await members.getByRole('button', { name: 'This is me: Anna', exact: true }).click()
  await expect(page.getByText('Linked to you', { exact: true })).toBeVisible()
}

test('the Groups entry shows no count while nothing waits for confirmation', async ({ page }) => {
  await page.goto('/tools')
  const groups = toolList(page, 'Tools').getByRole('link', { name: 'Groups', exact: true })
  await expect(groups).toBeVisible()
  await expect(groups).not.toContainText('to confirm')
  await expect(groups).toHaveAccessibleDescription('Shared expenses with friends and who owes whom')
})

test('the Groups entry counts what waits for confirmation', async ({ page }) => {
  await linkAnna(page)
  await page.goto('/tools')
  const groups = toolList(page, 'Tools').getByRole('link', { name: 'Groups', exact: true })
  await expect(groups).toContainText('2 to confirm')
  await expect(groups).toHaveAccessibleDescription(/Shared expenses with friends and who owes whom.*2 to confirm/)
  expect((await groups.boundingBox())?.height).toBeGreaterThanOrEqual(44)
})

test('the Groups entry counts what waits for confirmation in the user language', async ({ page }) => {
  await linkAnna(page)
  await page.goto('/pl/tools')
  await expect(toolList(page, 'Narzędzia').getByRole('link', { name: 'Grupy', exact: true })).toContainText(
    '2 do potwierdzenia',
  )
  await page.goto('/ru/tools')
  await expect(toolList(page, 'Инструменты').getByRole('link', { name: 'Группы', exact: true })).toContainText(
    '2 на подтверждение',
  )
  await page.goto('/uk/tools')
  await expect(toolList(page, 'Інструменти').getByRole('link', { name: 'Групи', exact: true })).toContainText(
    '2 на підтвердження',
  )
})
