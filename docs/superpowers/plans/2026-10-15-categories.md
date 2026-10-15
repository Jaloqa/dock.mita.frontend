# Categories Implementation Plan

**Goal:** Deliver per-user expense and income categories in the mock backend (starter set, seeded sets for both demo users, full CRUD with reassignment to "other" on delete), the shared category data other features use for pickers and labels, and the category management dialog opened from Settings.

**Architecture:** The mock backend gains a `categories` table, a starter set with names in every supported language, and handlers for `/v1/categories`. Anything that references a category (transactions in stage 4, later budgets) registers a `CategoryReference` in `mocks/categories.ts`; the backend uses the registry to report `inUse` and to move references to the user's "other" category of the same kind when a category is deleted. On the frontend, `app/shared/categories` holds the read side (query, pickers, colour mapping from the colour key to the chart tokens); `app/features/categories` owns the management dialog, its form and mutations; `pages/settings.vue` opens the dialog.

**Tech Stack:** Nuxt 4, TypeScript strict, TanStack Query (`@tanstack/vue-query`), Vuelidate, PrimeVue 4 (`Dialog`, `Tabs`, `TabList`, `Tab`, `TabPanels`, `TabPanel`, `InputText`, `Button`, `Skeleton`, `Toast`, `ConfirmDialog`), vue-i18n, Tailwind 4, Bun (`bun test`), Playwright, Biome.

**Spec:** `docs/superpowers/specs/2026-10-15-frontend-mocks-design.md` (section 1 `Category`, access rules and the starter set; section 2 endpoints `/v1/categories`; section 3 Settings "manage categories"; section 4 forms and errors; section 5 step 3).

## Global Constraints

- Code, identifiers, commit messages in English; no comments except for a genuinely controversial decision; no tool attribution and no `Co-Authored-By` trailers in commits or files.
- API paths start with `/v1/`; errors are RFC 9457 ProblemDetails; validation messages are i18n keys under `validation.*`.
- The frontend never sends `userId`; every handler filters by the session user; a foreign or missing id returns `404`.
- `Category` = `id`, `name`, `kind` (`expense` / `income`), `color` (chart token key `chart-1` … `chart-6`), `system` (`transfer`, `other` cannot be deleted). System categories cannot be deleted and cannot change kind; names are unique per user and kind, compared case-insensitively after trimming; deleting a used category moves its references to the same user's "other" category of the same kind.
- Each new user gets a starter set of categories they can edit, named in the user's language (`settings.locale`, `en` when unknown). Seeded names are user data in each demo user's language (Anna Polish, Oleh Ukrainian).
- Every user-facing string goes through i18n with keys in `en`, `pl`, `ru`, `uk` (the parity test enforces it).
- The UI never shows `ApiError.title` raw: unknown errors map by status to `shared.error.*` keys (`useNotify().error`), field errors are shown through their i18n keys.
- Data queries run on the client only in mock mode (already enforced) — no `suspense()` or server prefetch.
- Accessibility: semantic elements, labels for every input, `aria-invalid` + `aria-describedby` on invalid fields, focus moves to the first invalid field on submit, touch targets at least 44px.
- Only libraries from `docs/STACK.md`; PrimeVue stays on 4.x; components use design tokens (`bg-surface`, `text-muted`, `bg-chart-1`, …), never raw hex values.
- Code under `mocks/`, `app/shared/api/{contract,invalidation}.ts`, `app/shared/categories/{colors,select}.ts` and `app/features/categories/schemas` uses plain relative imports (no Nuxt auto-imports, no `~` alias) so it runs in Bun.
- Biome (`bun run lint`) and `nuxt typecheck` (0 `error TS` lines) must pass before every commit.

## Review Focus

- The browser still holds a mock database saved by the accounts stage (no `categories` table) — the app starts from the new seed instead of crashing or showing an empty list. Pinned in Task 1.
- A user who has no categories yet (a new user) opens anything that touches categories — they get the starter set once, in their language, and repeated calls never duplicate it. Pinned in Task 1.
- A name that differs from an existing one only in case or surrounding spaces is rejected in the same kind, accepted in the other kind, and renaming a category to its own name in a different case is accepted. Pinned in Task 2.
- Deleting a used category moves its references to the "other" category of the same kind of the same user — never to the other kind's "other" and never to another user's. Pinned in Task 2.
- A colour key the frontend does not know (older or newer backend) — the swatch falls back to a neutral token instead of rendering without colour. Pinned in Task 3.

---

## File map

| File | Responsibility |
|---|---|
| `app/shared/api/contract.ts` | `CategoryKind`, `categoryKinds`, `CategoryColor`, `categoryColors`, `SystemCategory`, `CategoryDto`, `CategoryInput` |
| `mocks/db.ts` | `CategoryRow`, `MockState.categories` |
| `mocks/seed/categories.ts` | starter set with names in en/pl/ru/uk, `starterCategories`, `demoCategories` |
| `mocks/seed/index.ts` | seeds categories |
| `mocks/categories.ts` | `CategoryReference` registry, `categoriesInUse`, `reassignCategory`, `ensureCategories`, `otherCategoryOf` |
| `mocks/handlers/categories.ts` | `GET/POST /v1/categories`, `PUT/DELETE /v1/categories/{id}` |
| `mocks/handlers/index.ts` | registers the category handlers |
| `app/shared/categories/colors.ts` | colour key → Tailwind swatch class and CSS variable |
| `app/shared/categories/select.ts` | `categoriesOfKind`, `pickableCategories` |
| `app/shared/categories/categoriesApi.ts`, `keys.ts`, `useCategories.ts` | shared read side and API calls |
| `app/shared/api/invalidation.ts` | `categories` change |
| `app/shared/components/AppIcon.vue`, `app/shared/types/icon.ts` | `trash` icon |
| `app/features/categories/schemas/categorySchema.ts` | Vuelidate rules, `isUniqueName`, `suggestColor` |
| `app/features/categories/composables/useCategoryMutations.ts` | create / update / remove mutations |
| `app/features/categories/components/*` | `CategoryManagerDialog`, `CategoryList`, `CategoryEditor`, `CategoryColorPicker` |
| `app/pages/settings.vue` | "Data" section with "Manage categories" |
| `i18n/locales/*.json` | `settings.data.*`, `categories.*`, new `validation.*` codes |

All shell commands run inside WSL in `~/dock.mita.frontend` on branch `feature/categories` through the helper: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/wsl-run.sh '<command>'`. E2E: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/scripts/cat-e2e.sh <playwright args>` (starts a dev server on port 3100, runs the official Playwright container, stops the server).

---

### Task 1: Category table, starter set and `GET /v1/categories`

**Files:**
- Modify: `app/shared/api/contract.ts`, `mocks/db.ts`, `mocks/seed/index.ts`, `mocks/handlers/index.ts`
- Create: `mocks/seed/categories.ts`, `mocks/categories.ts`, `mocks/handlers/categories.ts`
- Test: `tests/unit/mocks/categories.test.ts`

**Interfaces:**
- Consumes: `Locale` (`contract.ts`); `MockRouter`; `paginate`; `badRequest`, `notFound`; `newId`; `createDb`, `STORAGE_KEY`, `KeyValueStorage`.
- Produces:
  - contract: `type CategoryKind = 'expense' | 'income'`, `categoryKinds`, `type CategoryColor = 'chart-1' | … | 'chart-6'`, `categoryColors`, `type SystemCategory = 'transfer' | 'other'`, `CategoryDto { id; name; kind; color; system: SystemCategory | null; inUse: boolean }`, `CategoryInput { name; kind; color }`
  - db: `CategoryRow = Omit<CategoryDto, 'inUse'> & { userId: string }`, `MockState.categories: CategoryRow[]`
  - `mocks/seed/categories.ts`: `type StarterCategory`, `starterSet`, `starterCategories(userId, locale, idOf): CategoryRow[]`, `demoCategories(): CategoryRow[]`
  - `mocks/categories.ts`: `type CategoryReference { usedCategoryIds(state, userId): Set<string>; reassign(state, userId, fromId, toId): void }`, `categoryReferences: CategoryReference[]`, `categoriesInUse(state, userId): Set<string>`, `reassignCategory(state, userId, fromId, toId): void`, `ensureCategories(state, userId): boolean`, `otherCategoryOf(state, userId, kind): CategoryRow | undefined`
  - `registerCategoryHandlers(router)` with `GET /v1/categories?kind=&page=&pageSize=` → `Page<CategoryDto>` (default and max page size 100), ordered: expense before income; inside a kind user categories in creation order, then "other", then "transfer"

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/mocks/categories.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import { type CategoryDto, categoryColors, type Page } from '../../../app/shared/api/contract'
import { createMockApi, type MockApi } from '../../../mocks/api'
import { createDb, type KeyValueStorage, STORAGE_KEY } from '../../../mocks/db'
import { defaultHandlers } from '../../../mocks/handlers'
import { seedState } from '../../../mocks/seed'

const api = () => createMockApi({ register: defaultHandlers })
const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)
const list = async (mock: MockApi, query?: Record<string, string>) =>
  (await mock.handle({ method: 'GET', path: '/v1/categories', query })) as Page<CategoryDto>
const names = (page: Page<CategoryDto>, kind: CategoryDto['kind']) =>
  page.items.filter((category) => category.kind === kind).map((category) => category.name)

describe('categories', () => {
  it('lists the Polish categories of Anna, expenses first, system categories last', async () => {
    const page = await list(api())
    expect(page).toMatchObject({ page: 1, pageSize: 100, total: 19 })
    expect(names(page, 'expense')).toEqual([
      'Spożywcze',
      'Transport',
      'Mieszkanie',
      'Kawiarnie',
      'Zdrowie',
      'Zakupy',
      'Rozrywka',
      'Prezenty',
      'Sport',
      'Inne',
      'Przelewy',
    ])
    expect(names(page, 'income')).toEqual([
      'Wynagrodzenie',
      'Freelance',
      'Prezent',
      'Odsetki',
      'Zwrot',
      'Sprzedaż',
      'Premia',
      'Inne',
    ])
    expect(page.items.findIndex((category) => category.kind === 'income')).toBe(11)
  })

  it('marks exactly one other per kind and one transfer category as system', async () => {
    const system = (await list(api())).items
      .filter((category) => category.system !== null)
      .map((category) => [category.kind, category.system])
    expect(system).toEqual([
      ['expense', 'other'],
      ['expense', 'transfer'],
      ['income', 'other'],
    ])
  })

  it('shows Oleh his own Ukrainian categories only', async () => {
    const mock = api()
    const anna = new Set((await list(mock)).items.map((category) => category.id))
    await mock.handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_oleh' } })
    const oleh = await list(mock)
    expect(oleh.items.some((category) => anna.has(category.id))).toBe(false)
    expect(names(oleh, 'expense')).toEqual([
      'Продукти',
      'Транспорт',
      'Житло',
      'Кафе',
      "Здоров'я",
      'Покупки',
      'Дозвілля',
      'Подарунки',
      'Підписки',
      'Інше',
      'Перекази',
    ])
    expect(names(oleh, 'income')).toContain('Зарплата')
  })

  it('uses chart token keys as colours', async () => {
    for (const category of seedState().categories) expect(categoryColors).toContain(category.color)
  })

  it('never exposes userId', async () => {
    const [category] = (await list(api())).items
    expect(Object.keys(category ?? {}).sort()).toEqual(['color', 'id', 'inUse', 'kind', 'name', 'system'])
    expect(category).toMatchObject({ inUse: false })
  })

  it('filters by kind and rejects an unknown kind', async () => {
    const mock = api()
    const income = await list(mock, { kind: 'income' })
    expect(income.total).toBe(8)
    expect(income.items.every((category) => category.kind === 'income')).toBe(true)
    expect(await failure(list(mock, { kind: 'transfer' }))).toMatchObject({
      problem: { status: 400, errors: { kind: ['validation.invalidValue'] } },
    })
  })

  it('gives a new user the starter set in their language exactly once', async () => {
    const mock = api()
    mock.db.state.users.push({ id: 'usr_new', name: 'New', email: 'new@demo.mita.app', createdAt: '2026-10-01T00:00:00Z' })
    const anna = mock.db.state.settings.find((row) => row.userId === 'usr_anna')
    if (!anna) throw new Error('seed has no settings for Anna')
    mock.db.state.settings.push({ ...anna, userId: 'usr_new', locale: 'ru' })
    await mock.handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_new' } })
    const first = await list(mock)
    expect(names(first, 'expense')).toEqual([
      'Продукты',
      'Транспорт',
      'Жильё',
      'Кафе',
      'Здоровье',
      'Покупки',
      'Досуг',
      'Подарки',
      'Другое',
      'Переводы',
    ])
    expect(names(first, 'income')).toEqual([
      'Зарплата',
      'Фриланс',
      'Подарок',
      'Проценты',
      'Возврат',
      'Продажа',
      'Бонус',
      'Другое',
    ])
    expect(first.items.every((category) => category.id.startsWith('cat_'))).toBe(true)
    const second = await list(mock)
    expect(second.items.map((category) => category.id)).toEqual(first.items.map((category) => category.id))
  })

  it('starts from the seed when the stored database has no categories table', () => {
    const { categories: _categories, ...older } = seedState()
    const storage: KeyValueStorage = { getItem: (key) => (key === STORAGE_KEY ? JSON.stringify(older) : null), setItem: () => {} }
    expect(createDb(storage, seedState).state.categories.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/unit/mocks/categories.test.ts`
Expected: FAIL — `categoryColors` is not exported / `GET /v1/categories` returns 404.

- [ ] **Step 3: Add the contract types**

Append to `app/shared/api/contract.ts`:

```ts
export type CategoryKind = 'expense' | 'income'

export const categoryKinds: readonly CategoryKind[] = ['expense', 'income']

export type CategoryColor = 'chart-1' | 'chart-2' | 'chart-3' | 'chart-4' | 'chart-5' | 'chart-6'

export const categoryColors: readonly CategoryColor[] = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6']

export type SystemCategory = 'transfer' | 'other'

export type CategoryDto = {
  id: string
  name: string
  kind: CategoryKind
  color: CategoryColor
  system: SystemCategory | null
  inUse: boolean
}

export type CategoryInput = { name: string; kind: CategoryKind; color: CategoryColor }
```

- [ ] **Step 4: Add the table to the mock database**

In `mocks/db.ts` change the import to
`import type { AccountDto, CategoryDto, RateDto, SettingsDto, TransferDto, UserDto } from '../app/shared/api/contract'`,
add after `TransferRow`:

```ts
export type CategoryRow = Omit<CategoryDto, 'inUse'> & { userId: string }
```

and add `categories: CategoryRow[]` as the last field of `MockState` (after `transfers`).

- [ ] **Step 5: Write the starter set and the demo seed**

Create `mocks/seed/categories.ts`:

```ts
import type { CategoryColor, CategoryKind, Locale, SystemCategory } from '../../app/shared/api/contract'
import type { CategoryRow } from '../db'

export type StarterCategory = {
  key: string
  kind: CategoryKind
  color: CategoryColor
  system: SystemCategory | null
  names: Record<Locale, string>
}

export const starterSet: readonly StarterCategory[] = [
  {
    key: 'groceries',
    kind: 'expense',
    color: 'chart-2',
    system: null,
    names: { en: 'Groceries', pl: 'Spożywcze', ru: 'Продукты', uk: 'Продукти' },
  },
  {
    key: 'transport',
    kind: 'expense',
    color: 'chart-5',
    system: null,
    names: { en: 'Transport', pl: 'Transport', ru: 'Транспорт', uk: 'Транспорт' },
  },
  {
    key: 'housing',
    kind: 'expense',
    color: 'chart-1',
    system: null,
    names: { en: 'Housing', pl: 'Mieszkanie', ru: 'Жильё', uk: 'Житло' },
  },
  {
    key: 'cafes',
    kind: 'expense',
    color: 'chart-4',
    system: null,
    names: { en: 'Cafes', pl: 'Kawiarnie', ru: 'Кафе', uk: 'Кафе' },
  },
  {
    key: 'health',
    kind: 'expense',
    color: 'chart-3',
    system: null,
    names: { en: 'Health', pl: 'Zdrowie', ru: 'Здоровье', uk: "Здоров'я" },
  },
  {
    key: 'shopping',
    kind: 'expense',
    color: 'chart-4',
    system: null,
    names: { en: 'Shopping', pl: 'Zakupy', ru: 'Покупки', uk: 'Покупки' },
  },
  {
    key: 'leisure',
    kind: 'expense',
    color: 'chart-3',
    system: null,
    names: { en: 'Leisure', pl: 'Rozrywka', ru: 'Досуг', uk: 'Дозвілля' },
  },
  {
    key: 'gifts',
    kind: 'expense',
    color: 'chart-2',
    system: null,
    names: { en: 'Gifts', pl: 'Prezenty', ru: 'Подарки', uk: 'Подарунки' },
  },
  {
    key: 'other',
    kind: 'expense',
    color: 'chart-6',
    system: 'other',
    names: { en: 'Other', pl: 'Inne', ru: 'Другое', uk: 'Інше' },
  },
  {
    key: 'transfer',
    kind: 'expense',
    color: 'chart-5',
    system: 'transfer',
    names: { en: 'Transfers', pl: 'Przelewy', ru: 'Переводы', uk: 'Перекази' },
  },
  {
    key: 'salary',
    kind: 'income',
    color: 'chart-2',
    system: null,
    names: { en: 'Salary', pl: 'Wynagrodzenie', ru: 'Зарплата', uk: 'Зарплата' },
  },
  {
    key: 'freelance',
    kind: 'income',
    color: 'chart-1',
    system: null,
    names: { en: 'Freelance', pl: 'Freelance', ru: 'Фриланс', uk: 'Фриланс' },
  },
  {
    key: 'gift',
    kind: 'income',
    color: 'chart-4',
    system: null,
    names: { en: 'Gift', pl: 'Prezent', ru: 'Подарок', uk: 'Подарунок' },
  },
  {
    key: 'interest',
    kind: 'income',
    color: 'chart-3',
    system: null,
    names: { en: 'Interest', pl: 'Odsetki', ru: 'Проценты', uk: 'Відсотки' },
  },
  {
    key: 'refund',
    kind: 'income',
    color: 'chart-5',
    system: null,
    names: { en: 'Refund', pl: 'Zwrot', ru: 'Возврат', uk: 'Повернення' },
  },
  {
    key: 'sale',
    kind: 'income',
    color: 'chart-1',
    system: null,
    names: { en: 'Sale', pl: 'Sprzedaż', ru: 'Продажа', uk: 'Продаж' },
  },
  {
    key: 'bonus',
    kind: 'income',
    color: 'chart-4',
    system: null,
    names: { en: 'Bonus', pl: 'Premia', ru: 'Бонус', uk: 'Бонус' },
  },
  {
    key: 'other',
    kind: 'income',
    color: 'chart-6',
    system: 'other',
    names: { en: 'Other', pl: 'Inne', ru: 'Другое', uk: 'Інше' },
  },
]

export function starterCategories(
  userId: string,
  locale: Locale,
  idOf: (starter: StarterCategory) => string,
): CategoryRow[] {
  return starterSet.map((starter) => ({
    id: idOf(starter),
    userId,
    name: starter.names[locale],
    kind: starter.kind,
    color: starter.color,
    system: starter.system,
  }))
}

const seededId =
  (user: string) =>
  (starter: StarterCategory): string =>
    `cat_${user}_${starter.kind}_${starter.key}`

export const demoCategories = (): CategoryRow[] => [
  ...starterCategories('usr_anna', 'pl', seededId('anna')),
  { id: 'cat_anna_expense_sport', userId: 'usr_anna', name: 'Sport', kind: 'expense', color: 'chart-3', system: null },
  ...starterCategories('usr_oleh', 'uk', seededId('oleh')),
  {
    id: 'cat_oleh_expense_subscriptions',
    userId: 'usr_oleh',
    name: 'Підписки',
    kind: 'expense',
    color: 'chart-4',
    system: null,
  },
]
```

In `mocks/seed/index.ts` add `import { demoCategories } from './categories'` and add `categories: demoCategories(),` after `transfers: …` in the returned state.

- [ ] **Step 6: Write the reference registry and the starter provisioning**

Create `mocks/categories.ts`:

```ts
import type { CategoryKind } from '../app/shared/api/contract'
import type { CategoryRow, MockState } from './db'
import { newId } from './ids'
import { starterCategories } from './seed/categories'

export type CategoryReference = {
  usedCategoryIds(state: MockState, userId: string): Set<string>
  reassign(state: MockState, userId: string, fromId: string, toId: string): void
}

export const categoryReferences: CategoryReference[] = []

export function categoriesInUse(state: MockState, userId: string): Set<string> {
  return new Set(categoryReferences.flatMap((reference) => [...reference.usedCategoryIds(state, userId)]))
}

export function reassignCategory(state: MockState, userId: string, fromId: string, toId: string): void {
  for (const reference of categoryReferences) reference.reassign(state, userId, fromId, toId)
}

export function ensureCategories(state: MockState, userId: string): boolean {
  if (state.categories.some((row) => row.userId === userId)) return false
  const locale = state.settings.find((row) => row.userId === userId)?.locale ?? 'en'
  state.categories.push(...starterCategories(userId, locale, () => newId('cat')))
  return true
}

export const otherCategoryOf = (state: MockState, userId: string, kind: CategoryKind): CategoryRow | undefined =>
  state.categories.find((row) => row.userId === userId && row.kind === kind && row.system === 'other')
```

- [ ] **Step 7: Write the list handler**

Create `mocks/handlers/categories.ts`:

```ts
import { type CategoryDto, type CategoryKind, categoryKinds } from '../../app/shared/api/contract'
import { categoriesInUse, ensureCategories } from '../categories'
import type { CategoryRow, MockDb } from '../db'
import { badRequest } from '../errors'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'

const isKind = (value: unknown): value is CategoryKind => categoryKinds.includes(value as CategoryKind)

const systemOrder = (row: CategoryRow): number => (row.system === 'transfer' ? 2 : row.system === 'other' ? 1 : 0)

const ordered = (rows: readonly CategoryRow[]): CategoryRow[] =>
  rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        categoryKinds.indexOf(a.row.kind) - categoryKinds.indexOf(b.row.kind) ||
        systemOrder(a.row) - systemOrder(b.row) ||
        a.index - b.index,
    )
    .map(({ row }) => row)

const ownRows = (db: MockDb, userId: string): CategoryRow[] => {
  if (ensureCategories(db.state, userId)) db.save()
  return db.state.categories.filter((row) => row.userId === userId)
}

const toDto = ({ userId: _userId, ...row }: CategoryRow, inUse: Set<string>): CategoryDto => ({
  ...row,
  inUse: inUse.has(row.id),
})

export function registerCategoryHandlers(router: MockRouter) {
  router.on('GET', '/v1/categories', ({ db, userId, query }) => {
    if (query.kind !== undefined && !isKind(query.kind)) badRequest({ kind: ['validation.invalidValue'] })
    const inUse = categoriesInUse(db.state, userId)
    const rows = ordered(ownRows(db, userId)).filter((row) => query.kind === undefined || row.kind === query.kind)
    return paginate(
      rows.map((row) => toDto(row, inUse)),
      query,
      { defaultPageSize: 100, maxPageSize: 100 },
    )
  })
}
```

In `mocks/handlers/index.ts` add `import { registerCategoryHandlers } from './categories'` and append `registerCategoryHandlers` to `defaultHandlers` after `registerTransferHandlers`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `bun test tests/unit/mocks/categories.test.ts`
Expected: PASS (8 tests). Then `bun test tests/unit` — all pass.

- [ ] **Step 9: Lint, typecheck, commit**

Run: `bunx biome check --write app/shared/api/contract.ts mocks tests/unit/mocks/categories.test.ts && bun run lint && bun run typecheck 2>&1 | grep -c "error TS"` → lint clean, `0`.

```bash
git add app/shared/api/contract.ts mocks tests/unit/mocks/categories.test.ts
git commit -m "feat: categories with a localized starter set in the mock backend"
```

---

### Task 2: Create, update and delete categories with reassignment to "other"

**Files:**
- Modify: `mocks/handlers/categories.ts`
- Test: `tests/unit/mocks/categoryMutations.test.ts`

**Interfaces:**
- Consumes: everything Task 1 produced; `collectErrors`, `isMissing`, `objectBody` (`mocks/validation.ts`); `notFound`; `newId`.
- Produces:
  - `CATEGORY_NAME_MAX = 40` exported from `mocks/handlers/categories.ts`
  - `POST /v1/categories` body `CategoryInput` → `CategoryDto` (`system: null`)
  - `PUT /v1/categories/{id}` body `CategoryInput` → `CategoryDto`
  - `DELETE /v1/categories/{id}` → no body; references move to `otherCategoryOf(state, userId, row.kind)`
  - Field error codes: `name`: `validation.required`, `validation.invalidValue`, `validation.nameTooLong`, `validation.categoryNameTaken`; `kind`: `validation.required`, `validation.invalidValue`, `validation.categoryKindLocked`; `color`: `validation.required`, `validation.invalidValue`; `id` (DELETE): `validation.systemCategory`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/mocks/categoryMutations.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'bun:test'
import type { CategoryDto, CategoryInput, Page } from '../../../app/shared/api/contract'
import { createMockApi, type MockApi } from '../../../mocks/api'
import { type CategoryReference, categoryReferences } from '../../../mocks/categories'
import { defaultHandlers } from '../../../mocks/handlers'

const api = () => createMockApi({ register: defaultHandlers })
const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)
const list = async (mock: MockApi) =>
  ((await mock.handle({ method: 'GET', path: '/v1/categories' })) as Page<CategoryDto>).items
const create = (mock: MockApi, body: unknown) => mock.handle({ method: 'POST', path: '/v1/categories', body })
const update = (mock: MockApi, id: string, body: unknown) =>
  mock.handle({ method: 'PUT', path: `/v1/categories/${id}`, body })
const remove = (mock: MockApi, id: string) => mock.handle({ method: 'DELETE', path: `/v1/categories/${id}` })
const fieldError = (field: string, code: string) => ({ problem: { status: 400, errors: { [field]: [code] } } })

const books: CategoryInput = { name: 'Książki', kind: 'expense', color: 'chart-4' }

const usage = (assignments: Record<string, { userId: string; categoryId: string }>): CategoryReference => ({
  usedCategoryIds: (_state, userId) =>
    new Set(
      Object.values(assignments)
        .filter((assignment) => assignment.userId === userId)
        .map((assignment) => assignment.categoryId),
    ),
  reassign: (_state, userId, fromId, toId) => {
    for (const assignment of Object.values(assignments)) {
      if (assignment.userId === userId && assignment.categoryId === fromId) assignment.categoryId = toId
    }
  },
})

const registered: CategoryReference[] = []
const register = (reference: CategoryReference) => {
  categoryReferences.push(reference)
  registered.push(reference)
}

afterEach(() => {
  for (const reference of registered.splice(0)) categoryReferences.splice(categoryReferences.indexOf(reference), 1)
})

describe('category mutations', () => {
  it('creates a category before the system ones of its kind', async () => {
    const mock = api()
    const created = (await create(mock, { ...books, name: '  Książki  ' })) as CategoryDto
    expect(created).toMatchObject({ name: 'Książki', kind: 'expense', color: 'chart-4', system: null, inUse: false })
    expect(created.id).toStartWith('cat_')
    const expense = (await list(mock)).filter((category) => category.kind === 'expense').map((category) => category.name)
    expect(expense.slice(-4)).toEqual(['Sport', 'Książki', 'Inne', 'Przelewy'])
  })

  it('validates name, kind and colour', async () => {
    const mock = api()
    expect(await failure(create(mock, {}))).toMatchObject({
      problem: {
        status: 400,
        errors: { name: ['validation.required'], kind: ['validation.required'], color: ['validation.required'] },
      },
    })
    expect(await failure(create(mock, { ...books, name: '   ' }))).toMatchObject(
      fieldError('name', 'validation.required'),
    )
    expect(await failure(create(mock, { ...books, name: 42 }))).toMatchObject(
      fieldError('name', 'validation.invalidValue'),
    )
    expect(await failure(create(mock, { ...books, name: 'x'.repeat(41) }))).toMatchObject(
      fieldError('name', 'validation.nameTooLong'),
    )
    expect(await create(mock, { ...books, name: 'y'.repeat(40) })).toMatchObject({ name: 'y'.repeat(40) })
    expect(await failure(create(mock, { ...books, kind: 'transfer' }))).toMatchObject(
      fieldError('kind', 'validation.invalidValue'),
    )
    expect(await failure(create(mock, { ...books, color: '#ff0000' }))).toMatchObject(
      fieldError('color', 'validation.invalidValue'),
    )
  })

  it('keeps names unique per kind, ignoring case and surrounding spaces', async () => {
    const mock = api()
    expect(await failure(create(mock, { ...books, name: ' spożywcze ' }))).toMatchObject(
      fieldError('name', 'validation.categoryNameTaken'),
    )
    expect(await create(mock, { ...books, kind: 'income', name: 'Spożywcze' })).toMatchObject({ kind: 'income' })
    expect(await failure(update(mock, 'cat_anna_expense_sport', { ...books, name: 'INNE' }))).toMatchObject(
      fieldError('name', 'validation.categoryNameTaken'),
    )
    expect(await update(mock, 'cat_anna_expense_sport', { ...books, name: 'SPORT' })).toMatchObject({ name: 'SPORT' })
  })

  it('renames and recolours a system category but never changes its kind', async () => {
    const mock = api()
    const id = 'cat_anna_expense_other'
    expect(await update(mock, id, { name: 'Różne', kind: 'expense', color: 'chart-1' })).toMatchObject({
      name: 'Różne',
      color: 'chart-1',
      system: 'other',
    })
    expect(await failure(update(mock, id, { name: 'Różne', kind: 'income', color: 'chart-1' }))).toMatchObject(
      fieldError('kind', 'validation.categoryKindLocked'),
    )
  })

  it('changes the kind of a user category only while it is unused', async () => {
    const mock = api()
    expect(await update(mock, 'cat_anna_expense_sport', { ...books, name: 'Sport', kind: 'income' })).toMatchObject({
      kind: 'income',
    })
    register(usage({ tx1: { userId: 'usr_anna', categoryId: 'cat_anna_expense_gifts' } }))
    expect(
      await failure(update(mock, 'cat_anna_expense_gifts', { name: 'Prezenty', kind: 'income', color: 'chart-2' })),
    ).toMatchObject(fieldError('kind', 'validation.categoryKindLocked'))
  })

  it('reports categories in use', async () => {
    const mock = api()
    register(usage({ tx1: { userId: 'usr_anna', categoryId: 'cat_anna_expense_cafes' } }))
    const cafes = (await list(mock)).find((category) => category.id === 'cat_anna_expense_cafes')
    expect(cafes?.inUse).toBe(true)
  })

  it('deletes an unused category', async () => {
    const mock = api()
    const created = (await create(mock, books)) as CategoryDto
    expect(await remove(mock, created.id)).toBeUndefined()
    expect((await list(mock)).some((category) => category.id === created.id)).toBe(false)
  })

  it('moves references of a deleted category to the other category of the same kind and user', async () => {
    const mock = api()
    const assignments = {
      annaExpense: { userId: 'usr_anna', categoryId: 'cat_anna_expense_cafes' },
      annaIncome: { userId: 'usr_anna', categoryId: 'cat_anna_income_bonus' },
      oleh: { userId: 'usr_oleh', categoryId: 'cat_oleh_expense_cafes' },
    }
    register(usage(assignments))
    await remove(mock, 'cat_anna_expense_cafes')
    await remove(mock, 'cat_anna_income_bonus')
    expect(assignments.annaExpense.categoryId).toBe('cat_anna_expense_other')
    expect(assignments.annaIncome.categoryId).toBe('cat_anna_income_other')
    expect(assignments.oleh.categoryId).toBe('cat_oleh_expense_cafes')
  })

  it('refuses to delete system categories', async () => {
    const mock = api()
    for (const id of ['cat_anna_expense_other', 'cat_anna_expense_transfer', 'cat_anna_income_other']) {
      expect(await failure(remove(mock, id))).toMatchObject(fieldError('id', 'validation.systemCategory'))
    }
  })

  it('returns 404 for categories of another user or unknown ids', async () => {
    const mock = api()
    const notFound = { problem: { status: 404 } }
    expect(await failure(update(mock, 'cat_oleh_expense_cafes', books))).toMatchObject(notFound)
    expect(await failure(remove(mock, 'cat_oleh_expense_cafes'))).toMatchObject(notFound)
    expect(await failure(remove(mock, 'cat_missing'))).toMatchObject(notFound)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/unit/mocks/categoryMutations.test.ts`
Expected: FAIL — `POST /v1/categories` returns 404.

- [ ] **Step 3: Implement validation and the mutation handlers**

Replace `mocks/handlers/categories.ts` with:

```ts
import {
  type CategoryColor,
  type CategoryDto,
  type CategoryKind,
  categoryColors,
  categoryKinds,
} from '../../app/shared/api/contract'
import { categoriesInUse, ensureCategories, otherCategoryOf, reassignCategory } from '../categories'
import type { CategoryRow, MockDb } from '../db'
import { badRequest, notFound } from '../errors'
import { newId } from '../ids'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'
import { collectErrors, isMissing, objectBody } from '../validation'

export const CATEGORY_NAME_MAX = 40

type CategoryFields = Pick<CategoryRow, 'name' | 'kind' | 'color'>

const isKind = (value: unknown): value is CategoryKind => categoryKinds.includes(value as CategoryKind)

const isColor = (value: unknown): value is CategoryColor => categoryColors.includes(value as CategoryColor)

const normalized = (name: string): string => name.trim().toLocaleLowerCase()

const systemOrder = (row: CategoryRow): number => (row.system === 'transfer' ? 2 : row.system === 'other' ? 1 : 0)

const ordered = (rows: readonly CategoryRow[]): CategoryRow[] =>
  rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        categoryKinds.indexOf(a.row.kind) - categoryKinds.indexOf(b.row.kind) ||
        systemOrder(a.row) - systemOrder(b.row) ||
        a.index - b.index,
    )
    .map(({ row }) => row)

const ownRows = (db: MockDb, userId: string): CategoryRow[] => {
  if (ensureCategories(db.state, userId)) db.save()
  return db.state.categories.filter((row) => row.userId === userId)
}

const ownCategory = (db: MockDb, userId: string, id: string | undefined): CategoryRow =>
  ownRows(db, userId).find((row) => row.id === id) ?? notFound()

const toDto = ({ userId: _userId, ...row }: CategoryRow, inUse: Set<string>): CategoryDto => ({
  ...row,
  inUse: inUse.has(row.id),
})

function validateCategory(
  own: readonly CategoryRow[],
  body: unknown,
  existing?: { row: CategoryRow; inUse: boolean },
): CategoryFields {
  const { name, kind, color } = objectBody(body)
  const errors = collectErrors()
  if (isMissing(name)) errors.add('name', 'validation.required')
  else if (typeof name !== 'string') errors.add('name', 'validation.invalidValue')
  else if (name.trim().length > CATEGORY_NAME_MAX) errors.add('name', 'validation.nameTooLong')
  if (isMissing(kind)) errors.add('kind', 'validation.required')
  else if (!isKind(kind)) errors.add('kind', 'validation.invalidValue')
  else if (existing && kind !== existing.row.kind && (existing.row.system !== null || existing.inUse)) {
    errors.add('kind', 'validation.categoryKindLocked')
  }
  if (isMissing(color)) errors.add('color', 'validation.required')
  else if (!isColor(color)) errors.add('color', 'validation.invalidValue')
  if (typeof name === 'string' && isKind(kind)) {
    const taken = own.some(
      (row) => row.kind === kind && row.id !== existing?.row.id && normalized(row.name) === normalized(name),
    )
    if (taken) errors.add('name', 'validation.categoryNameTaken')
  }
  errors.throwIfAny()
  return { name: (name as string).trim(), kind: kind as CategoryKind, color: color as CategoryColor }
}

export function registerCategoryHandlers(router: MockRouter) {
  router.on('GET', '/v1/categories', ({ db, userId, query }) => {
    if (query.kind !== undefined && !isKind(query.kind)) badRequest({ kind: ['validation.invalidValue'] })
    const inUse = categoriesInUse(db.state, userId)
    const rows = ordered(ownRows(db, userId)).filter((row) => query.kind === undefined || row.kind === query.kind)
    return paginate(
      rows.map((row) => toDto(row, inUse)),
      query,
      { defaultPageSize: 100, maxPageSize: 100 },
    )
  })

  router.on('POST', '/v1/categories', ({ db, userId, body }) => {
    const row: CategoryRow = { id: newId('cat'), userId, system: null, ...validateCategory(ownRows(db, userId), body) }
    db.state.categories.push(row)
    db.save()
    return toDto(row, categoriesInUse(db.state, userId))
  })

  router.on('PUT', '/v1/categories/:id', ({ db, userId, params, body }) => {
    const row = ownCategory(db, userId, params.id)
    const inUse = categoriesInUse(db.state, userId)
    Object.assign(row, validateCategory(ownRows(db, userId), body, { row, inUse: inUse.has(row.id) }))
    db.save()
    return toDto(row, inUse)
  })

  router.on('DELETE', '/v1/categories/:id', ({ db, userId, params }) => {
    const row = ownCategory(db, userId, params.id)
    if (row.system !== null) badRequest({ id: ['validation.systemCategory'] })
    if (categoriesInUse(db.state, userId).has(row.id)) {
      const other = otherCategoryOf(db.state, userId, row.kind) ?? notFound()
      reassignCategory(db.state, userId, row.id, other.id)
    }
    db.state.categories = db.state.categories.filter((category) => category.id !== row.id)
    db.save()
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/unit/mocks/categoryMutations.test.ts tests/unit/mocks/categories.test.ts`
Expected: PASS (18 tests). Then `bun test tests/unit` — all pass.

- [ ] **Step 5: Lint, typecheck, commit**

Run: `bunx biome check --write mocks/handlers/categories.ts tests/unit/mocks/categoryMutations.test.ts && bun run lint && bun run typecheck 2>&1 | grep -c "error TS"` → lint clean, `0`.

```bash
git add mocks/handlers/categories.ts tests/unit/mocks/categoryMutations.test.ts
git commit -m "feat: create, rename, recolour and delete categories in the mock backend"
```

---

### Task 3: Shared category data, colour mapping and translations

**Files:**
- Create: `app/shared/categories/colors.ts`, `app/shared/categories/select.ts`, `app/shared/categories/categoriesApi.ts`, `app/shared/categories/keys.ts`, `app/shared/categories/useCategories.ts`
- Modify: `app/shared/api/invalidation.ts`, `i18n/locales/en.json`, `i18n/locales/pl.json`, `i18n/locales/ru.json`, `i18n/locales/uk.json`
- Test: `tests/unit/shared/categories.test.ts`

**Interfaces:**
- Consumes: `CategoryDto`, `CategoryInput`, `CategoryKind`, `CategoryColor`, `categoryColors`, `Page` (contract); `ApiClient` (`~/shared/api/client`); `useApi()` (auto-imported).
- Produces:
  - `colors.ts`: `categorySwatchClass(color: string): string` (`bg-chart-N`, unknown → `bg-chart-5`), `categoryColorVar(color: string): string` (`var(--mita-chart-N)`, unknown → `var(--mita-chart-5)`)
  - `select.ts`: `categoriesOfKind(categories: readonly CategoryDto[], kind: CategoryKind): CategoryDto[]`, `pickableCategories(categories, kind): CategoryDto[]` (without the `transfer` system category — for transaction and budget pickers)
  - `categoriesApi(api)`: `list()`, `create(body: CategoryInput)`, `update(id: string, body: CategoryInput)`, `remove(id: string)`
  - `categoryKeys = { all: ['categories'], list: ['categories', 'list'] }`
  - `useCategories()` → `{ categories: ComputedRef<CategoryDto[]>, byId: ComputedRef<Map<string, CategoryDto>>, ofKind(kind): CategoryDto[], pickable(kind): CategoryDto[], nameOf(id: string): string | undefined, isPending, isError, refetch }`
  - `DataChange` gains `'categories'`; `invalidationMap.categories = [['categories'], ['transactions'], ['budgets'], ['overview'], ['reports']]`
  - i18n keys: `settings.data.title`, `settings.data.manageCategories`, `categories.*` (below), `validation.categoryNameTaken`, `validation.categoryKindLocked`, `validation.systemCategory`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/shared/categories.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import { type CategoryDto, categoryColors } from '../../../app/shared/api/contract'
import { categoryColorVar, categorySwatchClass } from '../../../app/shared/categories/colors'
import { categoriesOfKind, pickableCategories } from '../../../app/shared/categories/select'

const category = (id: string, kind: CategoryDto['kind'], system: CategoryDto['system'] = null): CategoryDto => ({
  id,
  name: id,
  kind,
  color: 'chart-1',
  system,
  inUse: false,
})

const categories = [
  category('groceries', 'expense'),
  category('salary', 'income'),
  category('other', 'expense', 'other'),
  category('transfer', 'expense', 'transfer'),
  category('otherIncome', 'income', 'other'),
]

describe('category colours', () => {
  it('maps every colour key to its own chart token', () => {
    expect(categoryColors.map(categorySwatchClass)).toEqual([
      'bg-chart-1',
      'bg-chart-2',
      'bg-chart-3',
      'bg-chart-4',
      'bg-chart-5',
      'bg-chart-6',
    ])
    expect(categoryColorVar('chart-2')).toBe('var(--mita-chart-2)')
  })

  it('falls back to a neutral token for an unknown key', () => {
    expect(categorySwatchClass('chart-9')).toBe('bg-chart-5')
    expect(categoryColorVar('red')).toBe('var(--mita-chart-5)')
  })
})

describe('category selection', () => {
  it('keeps the categories of one kind in order', () => {
    expect(categoriesOfKind(categories, 'expense').map((item) => item.id)).toEqual(['groceries', 'other', 'transfer'])
    expect(categoriesOfKind(categories, 'income').map((item) => item.id)).toEqual(['salary', 'otherIncome'])
  })

  it('leaves the transfer category out of pickers', () => {
    expect(pickableCategories(categories, 'expense').map((item) => item.id)).toEqual(['groceries', 'other'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/unit/shared/categories.test.ts`
Expected: FAIL — cannot resolve `app/shared/categories/colors`.

- [ ] **Step 3: Write the pure helpers**

Create `app/shared/categories/colors.ts`:

```ts
import { type CategoryColor, categoryColors } from '../api/contract'

const FALLBACK: CategoryColor = 'chart-5'

const swatchClasses: Record<CategoryColor, string> = {
  'chart-1': 'bg-chart-1',
  'chart-2': 'bg-chart-2',
  'chart-3': 'bg-chart-3',
  'chart-4': 'bg-chart-4',
  'chart-5': 'bg-chart-5',
  'chart-6': 'bg-chart-6',
}

const known = (color: string): CategoryColor =>
  categoryColors.includes(color as CategoryColor) ? (color as CategoryColor) : FALLBACK

export const categorySwatchClass = (color: string): string => swatchClasses[known(color)]

export const categoryColorVar = (color: string): string => `var(--mita-${known(color)})`
```

Create `app/shared/categories/select.ts`:

```ts
import type { CategoryDto, CategoryKind } from '../api/contract'

export const categoriesOfKind = (categories: readonly CategoryDto[], kind: CategoryKind): CategoryDto[] =>
  categories.filter((category) => category.kind === kind)

export const pickableCategories = (categories: readonly CategoryDto[], kind: CategoryKind): CategoryDto[] =>
  categoriesOfKind(categories, kind).filter((category) => category.system !== 'transfer')
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/unit/shared/categories.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the API module, keys and composable**

Create `app/shared/categories/categoriesApi.ts`:

```ts
import type { ApiClient } from '~/shared/api/client'
import type { CategoryDto, CategoryInput, Page } from '~/shared/api/contract'

const categoryPath = (id: string) => `/v1/categories/${encodeURIComponent(id)}`

export const categoriesApi = (api: ApiClient) => ({
  list: () => api.get<Page<CategoryDto>>('/v1/categories', { pageSize: 100 }),
  create: (body: CategoryInput) => api.post<CategoryDto>('/v1/categories', body),
  update: (id: string, body: CategoryInput) => api.put<CategoryDto>(categoryPath(id), body),
  remove: (id: string) => api.delete(categoryPath(id)),
})
```

Create `app/shared/categories/keys.ts`:

```ts
export const categoryKeys = {
  all: ['categories'],
  list: ['categories', 'list'],
} as const
```

Create `app/shared/categories/useCategories.ts`:

```ts
import { useQuery } from '@tanstack/vue-query'
import type { CategoryKind } from '~/shared/api/contract'
import { categoriesApi } from './categoriesApi'
import { categoryKeys } from './keys'
import { categoriesOfKind, pickableCategories } from './select'

export function useCategories() {
  const api = categoriesApi(useApi())
  const query = useQuery({ queryKey: categoryKeys.list, queryFn: api.list })
  const categories = computed(() => query.data.value?.items ?? [])
  const byId = computed(() => new Map(categories.value.map((category) => [category.id, category])))

  return {
    categories,
    byId,
    ofKind: (kind: CategoryKind) => categoriesOfKind(categories.value, kind),
    pickable: (kind: CategoryKind) => pickableCategories(categories.value, kind),
    nameOf: (id: string) => byId.value.get(id)?.name,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
```

- [ ] **Step 6: Extend the invalidation map**

In `app/shared/api/invalidation.ts` change the type to
`export type DataChange = 'settings' | 'demo' | 'accounts' | 'transfers' | 'categories'`
and add the entry after `transfers`:

```ts
  categories: [['categories'], ['transactions'], ['budgets'], ['overview'], ['reports']],
```

- [ ] **Step 7: Add the translations**

In every locale file add a top-level `settings` object after `shared`, a top-level `categories` object after `accounts`, and three keys at the end of `validation`. Keep the existing keys untouched.

`i18n/locales/en.json`:

```json
  "settings": {
    "data": { "title": "Data", "manageCategories": "Manage categories" }
  },
```

```json
  "categories": {
    "dialog": { "title": "Categories" },
    "kind": { "expense": "Expenses", "income": "Income" },
    "system": "System",
    "list": { "empty": "No categories yet." },
    "actions": {
      "add": "Add category",
      "edit": "Edit {name}",
      "delete": "Delete {name}",
      "confirmDelete": "Delete"
    },
    "form": {
      "createTitle": "New category",
      "editTitle": "Edit category",
      "name": "Name",
      "color": "Color",
      "colorOption": "Color {index}"
    },
    "confirm": {
      "deleteTitle": "Delete category?",
      "deleteMessage": "“{name}” will be deleted. Any transactions in it will move to “{other}”."
    },
    "toast": { "created": "Category added", "updated": "Category updated", "deleted": "Category deleted" }
  },
```

```json
    "categoryNameTaken": "A category with this name already exists.",
    "categoryKindLocked": "The type of this category cannot change.",
    "systemCategory": "System categories cannot be deleted."
```

`i18n/locales/pl.json`:

```json
  "settings": {
    "data": { "title": "Dane", "manageCategories": "Zarządzaj kategoriami" }
  },
```

```json
  "categories": {
    "dialog": { "title": "Kategorie" },
    "kind": { "expense": "Wydatki", "income": "Przychody" },
    "system": "Systemowa",
    "list": { "empty": "Brak kategorii." },
    "actions": {
      "add": "Dodaj kategorię",
      "edit": "Edytuj {name}",
      "delete": "Usuń {name}",
      "confirmDelete": "Usuń"
    },
    "form": {
      "createTitle": "Nowa kategoria",
      "editTitle": "Edycja kategorii",
      "name": "Nazwa",
      "color": "Kolor",
      "colorOption": "Kolor {index}"
    },
    "confirm": {
      "deleteTitle": "Usunąć kategorię?",
      "deleteMessage": "Kategoria „{name}” zostanie usunięta. Jej transakcje zostaną przeniesione do „{other}”."
    },
    "toast": { "created": "Dodano kategorię", "updated": "Zaktualizowano kategorię", "deleted": "Usunięto kategorię" }
  },
```

```json
    "categoryNameTaken": "Kategoria o tej nazwie już istnieje.",
    "categoryKindLocked": "Typu tej kategorii nie można zmienić.",
    "systemCategory": "Kategorii systemowych nie można usunąć."
```

`i18n/locales/ru.json`:

```json
  "settings": {
    "data": { "title": "Данные", "manageCategories": "Управление категориями" }
  },
```

```json
  "categories": {
    "dialog": { "title": "Категории" },
    "kind": { "expense": "Расходы", "income": "Доходы" },
    "system": "Системная",
    "list": { "empty": "Категорий пока нет." },
    "actions": {
      "add": "Добавить категорию",
      "edit": "Изменить {name}",
      "delete": "Удалить {name}",
      "confirmDelete": "Удалить"
    },
    "form": {
      "createTitle": "Новая категория",
      "editTitle": "Изменение категории",
      "name": "Название",
      "color": "Цвет",
      "colorOption": "Цвет {index}"
    },
    "confirm": {
      "deleteTitle": "Удалить категорию?",
      "deleteMessage": "Категория «{name}» будет удалена. Её операции перейдут в «{other}»."
    },
    "toast": { "created": "Категория добавлена", "updated": "Категория обновлена", "deleted": "Категория удалена" }
  },
```

```json
    "categoryNameTaken": "Категория с таким названием уже есть.",
    "categoryKindLocked": "Тип этой категории нельзя изменить.",
    "systemCategory": "Системные категории нельзя удалить."
```

`i18n/locales/uk.json`:

```json
  "settings": {
    "data": { "title": "Дані", "manageCategories": "Керування категоріями" }
  },
```

```json
  "categories": {
    "dialog": { "title": "Категорії" },
    "kind": { "expense": "Витрати", "income": "Доходи" },
    "system": "Системна",
    "list": { "empty": "Категорій поки немає." },
    "actions": {
      "add": "Додати категорію",
      "edit": "Редагувати {name}",
      "delete": "Видалити {name}",
      "confirmDelete": "Видалити"
    },
    "form": {
      "createTitle": "Нова категорія",
      "editTitle": "Редагування категорії",
      "name": "Назва",
      "color": "Колір",
      "colorOption": "Колір {index}"
    },
    "confirm": {
      "deleteTitle": "Видалити категорію?",
      "deleteMessage": "Категорію «{name}» буде видалено. Її операції перейдуть до «{other}»."
    },
    "toast": { "created": "Категорію додано", "updated": "Категорію оновлено", "deleted": "Категорію видалено" }
  },
```

```json
    "categoryNameTaken": "Категорія з такою назвою вже існує.",
    "categoryKindLocked": "Тип цієї категорії не можна змінити.",
    "systemCategory": "Системні категорії не можна видалити."
```

- [ ] **Step 8: Run all unit tests**

Run: `bun test tests/unit`
Expected: PASS, including `tests/unit/i18n/locales.test.ts` (key parity).

- [ ] **Step 9: Lint, typecheck, commit**

Run: `bunx biome check --write app/shared/categories app/shared/api/invalidation.ts i18n/locales tests/unit/shared/categories.test.ts && bun run lint && bun run typecheck 2>&1 | grep -c "error TS"` → lint clean, `0`.

```bash
git add app/shared/categories app/shared/api/invalidation.ts i18n/locales tests/unit/shared/categories.test.ts
git commit -m "feat: shared category data, colour mapping and translations"
```

---

### Task 4: Category manager dialog opened from Settings (browse)

**Files:**
- Create: `app/features/categories/components/CategoryList.vue`, `app/features/categories/components/CategoryManagerDialog.vue`, `tests/e2e/categories.spec.ts`
- Modify: `app/pages/settings.vue`

**Interfaces:**
- Consumes: `useCategories()`, `categoriesOfKind`, `categorySwatchClass` (Task 3); `CategoryDto`, `CategoryKind`, `categoryKinds` (contract); shared `ErrorState`, `EmptyState`, `AppIcon`; PrimeVue `Dialog`, `Tabs`, `TabList`, `Tab`, `TabPanels`, `TabPanel`, `Skeleton`.
- Produces:
  - `CategoryList` props `{ categories: CategoryDto[]; label: string; isPending: boolean; isError: boolean }`, emits `retry`
  - `CategoryManagerDialog` with `v-model:visible`
  - Settings "Data" section with the "Manage categories" button

- [ ] **Step 1: Write the failing E2E test**

Create `tests/e2e/categories.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test'

const openManager = async (page: Page, path = '/settings', button = 'Manage categories', title = 'Categories') => {
  await page.goto(path)
  await page.getByRole('button', { name: button }).click()
  const dialog = page.getByRole('dialog', { name: title })
  await expect(dialog).toBeVisible()
  return dialog
}

test('category manager lists expense and income categories of the demo user', async ({ page }) => {
  const dialog = await openManager(page)
  const expense = dialog.getByRole('list', { name: 'Expenses' })
  await expect(expense.getByRole('listitem')).toHaveCount(11)
  await expect(expense.getByRole('listitem').first()).toContainText('Spożywcze')
  await expect(expense.getByRole('listitem').filter({ hasText: 'Inne' })).toContainText('System')
  await expect(expense.getByRole('listitem').filter({ hasText: 'Sport' })).not.toContainText('System')

  await dialog.getByRole('tab', { name: 'Income' }).click()
  const income = dialog.getByRole('list', { name: 'Income' })
  await expect(income.getByRole('listitem')).toHaveCount(8)
  await expect(income.getByRole('listitem').first()).toContainText('Wynagrodzenie')
  await expect(dialog.getByRole('list', { name: 'Expenses' })).toBeHidden()
})

test('category manager is localized', async ({ page }) => {
  const dialog = await openManager(page, '/uk/settings', 'Керування категоріями', 'Категорії')
  await expect(dialog.getByRole('tab', { name: 'Витрати' })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByRole('tab', { name: 'Доходи' })).toBeVisible()
  await expect(dialog.getByRole('list', { name: 'Витрати' }).getByText('Системна').first()).toBeVisible()
})
```

- [ ] **Step 2: Run the E2E test to verify it fails**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/scripts/cat-e2e.sh tests/e2e/categories.spec.ts`
Expected: FAIL — no "Manage categories" button.

- [ ] **Step 3: Write the list component**

Create `app/features/categories/components/CategoryList.vue`:

```vue
<script setup lang="ts">
import type { CategoryDto } from '~/shared/api/contract'
import { categorySwatchClass } from '~/shared/categories/colors'

defineProps<{ categories: CategoryDto[]; label: string; isPending: boolean; isError: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <div v-if="isPending" class="flex flex-col gap-2" aria-hidden="true">
    <Skeleton v-for="index in 5" :key="index" height="2.75rem" border-radius="10px" />
  </div>
  <ErrorState v-else-if="isError" @retry="emit('retry')" />
  <EmptyState v-else-if="categories.length === 0" :title="t('categories.list.empty')" />
  <ul v-else :aria-label="label" class="m-0 flex list-none flex-col p-0">
    <li
      v-for="category in categories"
      :key="category.id"
      class="flex min-h-12 items-center gap-3 border-b border-border py-1 last:border-b-0"
    >
      <span class="size-3.5 shrink-0 rounded-full" :class="categorySwatchClass(category.color)" aria-hidden="true" />
      <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ category.name }}</span>
      <span v-if="category.system" class="shrink-0 rounded-full bg-track px-2.5 py-1 text-xs font-semibold text-muted">
        {{ t('categories.system') }}
      </span>
    </li>
  </ul>
</template>
```

- [ ] **Step 4: Write the dialog**

Create `app/features/categories/components/CategoryManagerDialog.vue`:

```vue
<script setup lang="ts">
import { categoryKinds } from '~/shared/api/contract'
import { categoriesOfKind } from '~/shared/categories/select'
import { useCategories } from '~/shared/categories/useCategories'

const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const { categories, isPending, isError, refetch } = useCategories()
const tab = ref<string | number>('expense')

watch(visible, (open) => {
  if (open) tab.value = 'expense'
})
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('categories.dialog.title')"
    class="w-[calc(100vw-2rem)] max-w-[32rem]"
    :pt="{ content: { class: 'pb-2' } }"
  >
    <Tabs v-model:value="tab">
      <TabList>
        <Tab v-for="kind in categoryKinds" :key="kind" :value="kind" class="min-h-11 flex-1">
          {{ t(`categories.kind.${kind}`) }}
        </Tab>
      </TabList>
      <TabPanels class="px-0 pb-0">
        <TabPanel v-for="kind in categoryKinds" :key="kind" :value="kind">
          <div class="max-h-[60vh] overflow-y-auto">
            <CategoryList
              :categories="categoriesOfKind(categories, kind)"
              :label="t(`categories.kind.${kind}`)"
              :is-pending="isPending"
              :is-error="isError"
              @retry="refetch"
            />
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>
```

- [ ] **Step 5: Add the Settings entry**

Replace `app/pages/settings.vue` with:

```vue
<script setup lang="ts">
import { useCurrentUser } from '~/shared/user/useCurrentUser'

const { t } = useI18n()
const { user } = useCurrentUser()
const categoriesOpen = ref(false)

useHead({ title: () => t('navigation.settings') })
</script>

<template>
  <PageHeader :title="t('navigation.settings')" />
  <p v-if="user" class="m-0 text-sm text-muted" data-testid="current-user">{{ user.name }}</p>
  <section class="flex flex-col gap-5 rounded-(--radius-card) bg-surface p-5.5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span class="text-sm font-medium">{{ t('shared.language') }}</span>
      <LocaleSwitcher />
    </div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span class="text-sm font-medium">{{ t('shared.theme.label') }}</span>
      <ColorModeSwitcher />
    </div>
  </section>
  <section aria-labelledby="settings-data" class="flex flex-col gap-3 rounded-(--radius-card) bg-surface p-5.5">
    <h2 id="settings-data" class="m-0 mb-1 text-base font-semibold">{{ t('settings.data.title') }}</h2>
    <button
      type="button"
      class="flex min-h-12 items-center gap-2.5 rounded-(--radius-control) border border-border bg-surface px-4 text-left text-sm font-medium text-ink transition-colors hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      @click="categoriesOpen = true"
    >
      <AppIcon name="budgets" />
      {{ t('settings.data.manageCategories') }}
    </button>
  </section>
  <CategoryManagerDialog v-model:visible="categoriesOpen" />
</template>
```

- [ ] **Step 6: Run the E2E tests to verify they pass**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/scripts/cat-e2e.sh tests/e2e/categories.spec.ts tests/e2e/home.spec.ts`
Expected: PASS on `desktop` and `mobile`.

- [ ] **Step 7: Lint, typecheck, commit**

Run: `bunx biome check --write app/features/categories app/pages/settings.vue tests/e2e/categories.spec.ts && bun run lint && bun run typecheck 2>&1 | grep -c "error TS"` → lint clean, `0`.

```bash
git add app/features/categories app/pages/settings.vue tests/e2e/categories.spec.ts
git commit -m "feat: category manager dialog in settings"
```

---

### Task 5: Add, rename, recolour and delete categories

**Files:**
- Create: `app/features/categories/schemas/categorySchema.ts`, `app/features/categories/composables/useCategoryMutations.ts`, `app/features/categories/components/CategoryColorPicker.vue`, `app/features/categories/components/CategoryEditor.vue`, `tests/unit/features/categories/schemas.test.ts`
- Modify: `app/features/categories/components/CategoryList.vue`, `app/features/categories/components/CategoryManagerDialog.vue`, `app/shared/components/AppIcon.vue`, `app/shared/types/icon.ts`, `tests/e2e/categories.spec.ts`

**Interfaces:**
- Consumes: Task 3 and Task 4 outputs; `invalidateAfter(queryClient, 'categories')`; `useNotify`, `useServerErrors`, `focusFirstInvalid`, `FormRow` (shared, auto-imported); PrimeVue `useConfirm` (auto-imported).
- Produces:
  - `categorySchema.ts`: `CATEGORY_NAME_MAX = 40`, `type CategoryForm = { name: string; color: CategoryColor }`, `isUniqueName(takenNames: () => readonly string[]): (value: unknown) => boolean`, `categoryRules(t, takenNames)`, `suggestColor(categories: readonly { color: CategoryColor }[]): CategoryColor`
  - `useCategoryMutations()` → `{ create, update, remove }` (TanStack mutations; update takes `{ id, input }`)
  - `CategoryColorPicker` `v-model: CategoryColor`, props `{ labelledBy: string }`
  - `CategoryEditor` props `{ kind: CategoryKind; category?: CategoryDto; takenNames: string[]; defaultColor: CategoryColor }`, emits `done`, `cancel`
  - `CategoryList` gains prop `editingId?: string`, emits `edit` / `remove` with the category, and an `editor` slot rendered in place of the edited row
  - `AppIcon` `trash`

- [ ] **Step 1: Write the failing schema tests**

Create `tests/unit/features/categories/schemas.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import {
  CATEGORY_NAME_MAX,
  categoryRules,
  isUniqueName,
  suggestColor,
} from '../../../../app/features/categories/schemas/categorySchema'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

describe('category form rules', () => {
  it('compares names ignoring case and surrounding spaces', () => {
    const unique = isUniqueName(() => ['Spożywcze', 'Inne'])
    expect(unique(' spożywcze ')).toBe(false)
    expect(unique('INNE')).toBe(false)
    expect(unique('Książki')).toBe(true)
    expect(unique('')).toBe(true)
  })

  it('reports required, too long and taken names with i18n keys', () => {
    const rules = categoryRules((key) => key, () => ['Inne'])
    expect(validate(rules.name.required, '')).toBe(false)
    expect(message(rules.name.required)).toBe('validation.required')
    expect(validate(rules.name.maxLength, 'x'.repeat(CATEGORY_NAME_MAX))).toBe(true)
    expect(validate(rules.name.maxLength, 'x'.repeat(CATEGORY_NAME_MAX + 1))).toBe(false)
    expect(message(rules.name.maxLength)).toBe('validation.nameTooLong')
    expect(validate(rules.name.unique, 'inne')).toBe(false)
    expect(message(rules.name.unique)).toBe('validation.categoryNameTaken')
    expect(validate(rules.color.required, 'chart-3')).toBe(true)
  })

  it('suggests the least used colour, the first token on ties', () => {
    expect(suggestColor([])).toBe('chart-1')
    expect(suggestColor([{ color: 'chart-1' }, { color: 'chart-2' }])).toBe('chart-3')
    expect(
      suggestColor([
        { color: 'chart-1' },
        { color: 'chart-1' },
        { color: 'chart-2' },
        { color: 'chart-3' },
        { color: 'chart-4' },
        { color: 'chart-5' },
        { color: 'chart-6' },
      ]),
    ).toBe('chart-2')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/unit/features/categories/schemas.test.ts`
Expected: FAIL — cannot resolve `categorySchema`.

- [ ] **Step 3: Write the schema**

Create `app/features/categories/schemas/categorySchema.ts`:

```ts
import { helpers, maxLength, required } from '@vuelidate/validators'
import { type CategoryColor, categoryColors } from '../../../shared/api/contract'

export const CATEGORY_NAME_MAX = 40

export type CategoryForm = { name: string; color: CategoryColor }

type Translate = (key: string) => string

const normalized = (name: string): string => name.trim().toLocaleLowerCase()

export const isUniqueName =
  (takenNames: () => readonly string[]) =>
  (value: unknown): boolean =>
    typeof value !== 'string' || !takenNames().some((name) => normalized(name) === normalized(value))

export const categoryRules = (t: Translate, takenNames: () => readonly string[]) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  return {
    name: {
      required: requiredField,
      maxLength: helpers.withMessage(() => t('validation.nameTooLong'), maxLength(CATEGORY_NAME_MAX)),
      unique: helpers.withMessage(() => t('validation.categoryNameTaken'), isUniqueName(takenNames)),
    },
    color: { required: requiredField },
  }
}

export function suggestColor(categories: readonly { color: CategoryColor }[]): CategoryColor {
  const usage = (color: CategoryColor) => categories.filter((category) => category.color === color).length
  return categoryColors.reduce<CategoryColor>((best, color) => (usage(color) < usage(best) ? color : best), 'chart-1')
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/unit/features/categories/schemas.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Extend the E2E test with the editing flows**

Append to `tests/e2e/categories.spec.ts`:

```ts
test('adds, renames, recolours and deletes a category', async ({ page }) => {
  const dialog = await openManager(page)
  const expense = dialog.getByRole('list', { name: 'Expenses' })
  await expect(expense.getByRole('listitem')).toHaveCount(11)
  await dialog.getByRole('button', { name: 'Add category' }).click()
  const form = dialog.getByRole('form', { name: 'New category' })
  const name = form.getByLabel('Name', { exact: true })
  await expect(name).toBeFocused()
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form.getByText('This field is required.')).toBeVisible()
  await name.fill(' spożywcze ')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form.getByText('A category with this name already exists.')).toBeVisible()
  await expect(name).toBeFocused()
  await name.fill('Książki')
  await form.getByRole('radio', { name: 'Color 4' }).check()
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Category added')).toBeVisible()
  await expect(form).toBeHidden()
  await expect(expense.getByRole('listitem')).toHaveCount(12)

  await expense.getByRole('button', { name: 'Edit Książki' }).click()
  const edit = dialog.getByRole('form', { name: 'Edit category' })
  await expect(edit.getByRole('radio', { name: 'Color 4' })).toBeChecked()
  await edit.getByLabel('Name', { exact: true }).fill('Książki i prasa')
  await edit.getByRole('radio', { name: 'Color 2' }).check()
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Category updated')).toBeVisible()
  await expect(expense.getByRole('listitem').filter({ hasText: 'Książki i prasa' })).toBeVisible()

  await expense.getByRole('button', { name: 'Delete Książki i prasa' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('will move to “Inne”')
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Category deleted')).toBeVisible()
  await expect(expense.getByRole('listitem')).toHaveCount(11)
  await expect(expense.getByText('Książki i prasa')).toHaveCount(0)
})

test('system categories can be renamed but not deleted', async ({ page }) => {
  const dialog = await openManager(page)
  const expense = dialog.getByRole('list', { name: 'Expenses' })
  await expect(expense.getByRole('button', { name: 'Delete Inne' })).toHaveCount(0)
  await expect(expense.getByRole('button', { name: 'Delete Przelewy' })).toHaveCount(0)
  await expect(expense.getByRole('button', { name: 'Delete Sport' })).toBeVisible()
  await expense.getByRole('button', { name: 'Edit Inne' }).click()
  const edit = dialog.getByRole('form', { name: 'Edit category' })
  await edit.getByLabel('Name', { exact: true }).fill('Różne')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Category updated')).toBeVisible()
  await expect(expense.getByRole('listitem').filter({ hasText: 'Różne' })).toContainText('System')
})

test('adds an income category in the income tab', async ({ page }) => {
  const dialog = await openManager(page)
  await dialog.getByRole('tab', { name: 'Income' }).click()
  await dialog.getByRole('button', { name: 'Add category' }).click()
  const form = dialog.getByRole('form', { name: 'New category' })
  await form.getByLabel('Name', { exact: true }).fill('Spożywcze')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Category added')).toBeVisible()
  await expect(dialog.getByRole('list', { name: 'Income' }).getByRole('listitem')).toHaveCount(9)
  await dialog.getByRole('tab', { name: 'Expenses' }).click()
  await expect(dialog.getByRole('list', { name: 'Expenses' }).getByRole('listitem')).toHaveCount(11)
})
```

- [ ] **Step 6: Add the trash icon**

In `app/shared/types/icon.ts` add `| 'trash'` after `| 'edit'`. In `app/shared/components/AppIcon.vue` add after the `edit` path:

```vue
    <path v-else-if="name === 'trash'" d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
```

- [ ] **Step 7: Write the mutations composable**

Create `app/features/categories/composables/useCategoryMutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { CategoryInput } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { categoriesApi } from '~/shared/categories/categoriesApi'

export function useCategoryMutations() {
  const api = categoriesApi(useApi())
  const queryClient = useQueryClient()
  const onSuccess = () => invalidateAfter(queryClient, 'categories')

  return {
    create: useMutation({ mutationFn: api.create, onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: CategoryInput }) => api.update(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: api.remove, onSuccess }),
  }
}
```

- [ ] **Step 8: Write the colour picker**

Create `app/features/categories/components/CategoryColorPicker.vue`:

```vue
<script setup lang="ts">
import { type CategoryColor, categoryColors } from '~/shared/api/contract'
import { categorySwatchClass } from '~/shared/categories/colors'

defineProps<{ labelledBy: string }>()
const model = defineModel<CategoryColor>({ required: true })
const { t } = useI18n()
</script>

<template>
  <div role="radiogroup" :aria-labelledby="labelledBy" class="flex flex-wrap gap-1">
    <label
      v-for="(color, index) in categoryColors"
      :key="color"
      class="flex size-11 cursor-pointer items-center justify-center"
    >
      <input
        v-model="model"
        type="radio"
        name="category-color"
        :value="color"
        :aria-label="t('categories.form.colorOption', { index: index + 1 })"
        class="size-7 cursor-pointer appearance-none rounded-full border border-border outline-offset-2 checked:outline-2 checked:outline-ink focus-visible:outline-2 focus-visible:outline-accent"
        :class="categorySwatchClass(color)"
      >
    </label>
  </div>
</template>
```

- [ ] **Step 9: Write the inline editor**

Create `app/features/categories/components/CategoryEditor.vue`:

```vue
<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { CategoryColor, CategoryDto, CategoryInput, CategoryKind } from '~/shared/api/contract'
import { type CategoryForm, categoryRules } from '../schemas/categorySchema'

const props = defineProps<{
  kind: CategoryKind
  category?: CategoryDto
  takenNames: string[]
  defaultColor: CategoryColor
}>()
const emit = defineEmits<{ done: []; cancel: [] }>()
const { t } = useI18n()
const notify = useNotify()
const server = useServerErrors()
const { create, update } = useCategoryMutations()

const fields = ['name', 'color'] as const
type Field = (typeof fields)[number]

const form = reactive<CategoryForm>({
  name: props.category?.name ?? '',
  color: props.category?.color ?? props.defaultColor,
})
const v$ = useVuelidate(
  categoryRules(t, () => props.takenNames),
  form,
)
const formEl = ref<HTMLFormElement | null>(null)
const saving = computed(() => create.isPending.value || update.isPending.value)
const title = computed(() => (props.category ? t('categories.form.editTitle') : t('categories.form.createTitle')))

const errorsOf = (field: Field) => [
  ...v$.value[field].$errors.map((error) => String(unref(error.$message))),
  ...server.messages(field),
]

function touch(field: Field) {
  v$.value[field].$touch()
  server.clear(field)
}

async function showServerErrors(error: unknown) {
  if (server.apply(error, fields)) {
    await nextTick()
    focusFirstInvalid(formEl.value)
  } else notify.error(error)
}

const finish = (message: string) => {
  notify.success(message)
  emit('done')
}

async function submit() {
  server.clear()
  if (!(await v$.value.$validate())) {
    await nextTick()
    focusFirstInvalid(formEl.value)
    return
  }
  const input: CategoryInput = { name: form.name.trim(), kind: props.category?.kind ?? props.kind, color: form.color }
  const category = props.category
  if (category) {
    update.mutate(
      { id: category.id, input },
      { onSuccess: () => finish(t('categories.toast.updated')), onError: showServerErrors },
    )
  } else {
    create.mutate(input, { onSuccess: () => finish(t('categories.toast.created')), onError: showServerErrors })
  }
}

onMounted(() => formEl.value?.querySelector<HTMLInputElement>('#category-name')?.focus())
</script>

<template>
  <form
    ref="formEl"
    :aria-label="title"
    class="flex w-full flex-col gap-3 rounded-(--radius-control) border border-border bg-bg p-3"
    novalidate
    @submit.prevent="submit"
    @keydown.esc.stop.prevent="emit('cancel')"
  >
    <FormRow id="category-name" :label="t('categories.form.name')" :errors="errorsOf('name')">
      <template #default="{ invalid, describedBy }">
        <InputText
          id="category-name"
          v-model="form.name"
          autocomplete="off"
          :invalid="invalid"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
          fluid
          @blur="touch('name')"
        />
      </template>
    </FormRow>
    <FormRow id="category-color" :label="t('categories.form.color')" :errors="errorsOf('color')">
      <template #default="{ labelId }">
        <CategoryColorPicker v-model="form.color" :labelled-by="labelId" />
      </template>
    </FormRow>
    <div class="flex justify-end gap-2">
      <Button
        :label="t('shared.actions.cancel')"
        severity="secondary"
        outlined
        class="min-h-11"
        @click="emit('cancel')"
      />
      <Button type="submit" :label="t('shared.actions.save')" class="min-h-11" :loading="saving" :disabled="saving" />
    </div>
  </form>
</template>
```

- [ ] **Step 10: Add row actions and the editor slot to the list**

Replace `app/features/categories/components/CategoryList.vue` with:

```vue
<script setup lang="ts">
import type { CategoryDto } from '~/shared/api/contract'
import { categorySwatchClass } from '~/shared/categories/colors'

defineProps<{
  categories: CategoryDto[]
  label: string
  isPending: boolean
  isError: boolean
  editingId?: string
}>()
const emit = defineEmits<{ retry: []; edit: [category: CategoryDto]; remove: [category: CategoryDto] }>()
const { t } = useI18n()
const iconButton =
  'flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) text-muted transition-colors hover:text-ink focus-visible:text-ink'
</script>

<template>
  <div v-if="isPending" class="flex flex-col gap-2" aria-hidden="true">
    <Skeleton v-for="index in 5" :key="index" height="2.75rem" border-radius="10px" />
  </div>
  <ErrorState v-else-if="isError" @retry="emit('retry')" />
  <EmptyState v-else-if="categories.length === 0" :title="t('categories.list.empty')" />
  <ul v-else :aria-label="label" class="m-0 flex list-none flex-col p-0">
    <li
      v-for="category in categories"
      :key="category.id"
      class="flex min-h-12 items-center gap-3 border-b border-border py-1 last:border-b-0"
    >
      <slot v-if="category.id === editingId" name="editor" />
      <template v-else>
        <span class="size-3.5 shrink-0 rounded-full" :class="categorySwatchClass(category.color)" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ category.name }}</span>
        <span
          v-if="category.system"
          class="shrink-0 rounded-full bg-track px-2.5 py-1 text-xs font-semibold text-muted"
        >
          {{ t('categories.system') }}
        </span>
        <div class="-mr-2 flex shrink-0">
          <button
            type="button"
            :class="iconButton"
            :aria-label="t('categories.actions.edit', { name: category.name })"
            @click="emit('edit', category)"
          >
            <AppIcon name="edit" />
          </button>
          <button
            v-if="!category.system"
            type="button"
            :class="iconButton"
            :aria-label="t('categories.actions.delete', { name: category.name })"
            @click="emit('remove', category)"
          >
            <AppIcon name="trash" />
          </button>
        </div>
      </template>
    </li>
  </ul>
</template>
```

- [ ] **Step 11: Wire editing and deleting into the dialog**

Replace `app/features/categories/components/CategoryManagerDialog.vue` with:

```vue
<script setup lang="ts">
import { type CategoryDto, type CategoryKind, categoryKinds } from '~/shared/api/contract'
import { categoriesOfKind } from '~/shared/categories/select'
import { useCategories } from '~/shared/categories/useCategories'
import { suggestColor } from '../schemas/categorySchema'

type Editing = { kind: CategoryKind; category?: CategoryDto }

const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const notify = useNotify()
const confirm = useConfirm()
const { categories, isPending, isError, refetch } = useCategories()
const { remove } = useCategoryMutations()

const tab = ref<string | number>('expense')
const editing = ref<Editing>()

const activeKind = computed<CategoryKind>(() => (tab.value === 'income' ? 'income' : 'expense'))
const listOf = (kind: CategoryKind) => categoriesOfKind(categories.value, kind)
const takenNames = computed(() => {
  const current = editing.value
  if (!current) return []
  return listOf(current.kind)
    .filter((category) => category.id !== current.category?.id)
    .map((category) => category.name)
})
const defaultColor = computed(() => suggestColor(listOf(activeKind.value)))
const creating = (kind: CategoryKind) => editing.value !== undefined && !editing.value.category && editing.value.kind === kind

watch(visible, (open) => {
  if (open) {
    tab.value = 'expense'
    editing.value = undefined
  }
})

watch(tab, () => {
  editing.value = undefined
})

const stopEditing = () => {
  editing.value = undefined
}

function confirmDelete(category: CategoryDto) {
  const other = listOf(category.kind).find((item) => item.system === 'other')
  confirm.require({
    header: t('categories.confirm.deleteTitle'),
    message: t('categories.confirm.deleteMessage', { name: category.name, other: other?.name ?? '' }),
    acceptLabel: t('categories.actions.confirmDelete'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      remove.mutate(category.id, {
        onSuccess: () => {
          if (editing.value?.category?.id === category.id) stopEditing()
          notify.success(t('categories.toast.deleted'))
        },
        onError: (error) => notify.error(error),
      }),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('categories.dialog.title')"
    class="w-[calc(100vw-2rem)] max-w-[32rem]"
    :pt="{ content: { class: 'pb-2' } }"
  >
    <Tabs v-model:value="tab">
      <TabList>
        <Tab v-for="kind in categoryKinds" :key="kind" :value="kind" class="min-h-11 flex-1">
          {{ t(`categories.kind.${kind}`) }}
        </Tab>
      </TabList>
      <TabPanels class="px-0 pb-0">
        <TabPanel v-for="kind in categoryKinds" :key="kind" :value="kind" class="flex flex-col gap-3">
          <CategoryEditor
            v-if="creating(kind)"
            :kind="kind"
            :taken-names="takenNames"
            :default-color="defaultColor"
            @done="stopEditing"
            @cancel="stopEditing"
          />
          <Button
            v-else
            text
            class="min-h-11 self-start"
            :disabled="isPending || isError"
            @click="editing = { kind }"
          >
            <AppIcon name="plus" :size="16" :stroke-width="2.2" />
            {{ t('categories.actions.add') }}
          </Button>
          <div class="max-h-[60vh] overflow-y-auto">
            <CategoryList
              :categories="listOf(kind)"
              :label="t(`categories.kind.${kind}`)"
              :is-pending="isPending"
              :is-error="isError"
              :editing-id="editing?.category?.id"
              @retry="refetch"
              @edit="(category) => (editing = { kind: category.kind, category })"
              @remove="confirmDelete"
            >
              <template #editor>
                <CategoryEditor
                  v-if="editing?.category"
                  :key="editing.category.id"
                  :kind="kind"
                  :category="editing.category"
                  :taken-names="takenNames"
                  :default-color="defaultColor"
                  @done="stopEditing"
                  @cancel="stopEditing"
                />
              </template>
            </CategoryList>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>
```

- [ ] **Step 12: Run unit and E2E tests**

Run: `bun test tests/unit` → all pass.
Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/scripts/cat-e2e.sh tests/e2e/categories.spec.ts`
Expected: PASS (5 tests × `desktop` and `mobile`).

- [ ] **Step 13: Lint, typecheck, commit**

Run: `bunx biome check --write app/features/categories app/shared/components/AppIcon.vue app/shared/types/icon.ts tests/unit/features/categories tests/e2e/categories.spec.ts && bun run lint && bun run typecheck 2>&1 | grep -c "error TS"` → lint clean, `0`.

```bash
git add app/features/categories app/shared/components/AppIcon.vue app/shared/types/icon.ts tests/unit/features/categories tests/e2e/categories.spec.ts
git commit -m "feat: add, rename, recolour and delete categories"
```

---

### Task 6: Pull request

- [ ] Rebase on `origin/develop`, fold fix commits into their task commits, verify the tree is unchanged.
- [ ] Run `bun run lint`, `bun run typecheck`, `bun test tests/unit`, `bun run build`, and the full E2E suite (`cat-e2e.sh` with no arguments).
- [ ] `git push --force-with-lease -u origin feature/categories`, open the PR to `develop` with `gh pr create` (title `feat: categories and the category manager`, body below), wait for `check-source-branch`, then `gh pr merge <n> --rebase`.

PR body:

```markdown
## What changed and why

- Categories per user in the mock backend: expense and income, a colour taken from the chart palette, and two system categories ("other" for each kind and "transfer") that cannot be deleted or change kind.
- Every new user gets a starter set named in their language; both demo users have their own seeded sets (Anna in Polish, Oleh in Ukrainian).
- `GET/POST /v1/categories` and `PUT/DELETE /v1/categories/{id}`. Names are unique per kind, case-insensitively. Deleting a used category moves its references to "other" of the same kind; transactions will plug into this in the next step.
- Shared category data for pickers and labels in `app/shared/categories`, including the colour mapping to the chart tokens.
- Settings gets a "Data" section with "Manage categories", which opens a dialog with expense and income tabs to add, rename, recolour and delete categories.

## How to test

1. `bun install`, `bun run dev`, open `/settings` and click "Manage categories".
2. Switch between the expense and income tabs; system categories are marked and have no delete button.
3. Add a category, try a name that already exists in any letter case, rename and recolour it, then delete it and read the confirmation.
4. Repeat in `/pl/settings`, `/ru/settings`, `/uk/settings`, in the dark theme and at phone width.
5. `bun test tests/unit` and the Playwright suite pass.
```
