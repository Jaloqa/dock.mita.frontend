# Transactions Implementation Plan

**Goal:** Deliver transactions end to end: the mock backend (`Transaction` per user with the rate, account amount and base amount fixed at save time, filters, sorting, paging, ledger and category integration, about six months of seeded history for both demo users), the `/transactions` screen (desktop table with filters, summary, sorting, "show more", CSV export; mobile cards grouped by day with filters in a drawer), the add/edit dialog opened from the header and the sidebar, and the full-screen mobile add screen `/transactions/new` with a numeric keypad.

**Architecture:** The mock backend gains a `transactions` table, pricing helpers in `mocks/transactions.ts` (rate for the date unless the client sends one, account amount, base amount), a ledger entry so balances include transactions, a `categoryReferences` entry so deleting a category moves transactions to "other", and handlers for `/v1/transactions`. The seed generates a deterministic history per calendar day and lowers each seeded opening balance by the account's net transaction movement, so today's balances stay exactly as designed. On the frontend `app/features/transactions` owns the API module, query keys, composables (infinite list, mutations, dialog state, CSV export, screen state), pure utils (filters → query, day grouping, CSV, keypad), Vuelidate schemas and components. The dialog is mounted once in the default layout and opened through `useTransactionDialog()`; the full-screen add page uses a new `focus` layout.

**Tech Stack:** Nuxt 4, TypeScript strict, TanStack Query (`useInfiniteQuery`, `keepPreviousData`), TanStack Table 9 (`@tanstack/vue-table`, `rowSortingFeature`, manual sorting), Vuelidate, PrimeVue 4 (`Dialog`, `Drawer`, `Select`, `SelectButton`, `InputNumber`, `InputText`, `DatePicker`, `Skeleton`, `Toast`, `ConfirmDialog`), vue-i18n, Tailwind 4, Bun (`bun test`), Playwright, Biome.

**Spec:** `docs/superpowers/specs/2026-10-15-frontend-mocks-design.md` (section 1 `Transaction` and rules, section 2 endpoints and invalidation, section 3 Transactions and New/edit transaction, section 4 forms and errors, section 5 step 4).

## Global Constraints

- Code, identifiers, commit messages in English; no comments except for a genuinely controversial decision; no tool attribution and no `Co-Authored-By` trailers in commits or files.
- API paths start with `/v1/`; errors are RFC 9457 ProblemDetails; validation messages are i18n keys under `validation.*`.
- The frontend never sends `userId`; every handler filters by the session user; a foreign or missing id returns `404`.
- `Transaction` = `id`, `kind` (`expense` / `income`), `date`, `title`, `note`, `categoryId`, `accountId`, `amount` + `currency` as entered (minor units, always > 0), `accountAmount` (account currency), `rate` (entered currency → account currency, `1` when equal), `baseAmount` (user base currency). Saving resolves the rate for the date unless the client sends one; stored amounts never change when rates change.
- Validation: account and category must belong to the user; the category kind must equal the transaction kind; the `transfer` system category is never allowed; amount > 0; date at most one year ahead (`oneYearAhead`); archived accounts are refused unless an edited transaction already uses that account.
- Balances include transactions through `mocks/ledger.ts`; category usage and reassignment go through `categoryReferences`; a transaction change invalidates `transactions`, `accounts`, `categories`, `budgets`, `overview`, `reports`.
- Lists are paginated (`{ items, page, pageSize, total }` plus `sum` and `currency` for transactions); the screen uses `useInfiniteQuery` for "show more"; CSV export pages through `GET /v1/transactions` with the active filters (no export endpoint).
- Every user-facing string goes through i18n with keys in `en`, `pl`, `ru`, `uk` (the parity test enforces it). Seeded titles are user data in each demo user's language (Anna Polish, Oleh Ukrainian).
- The UI never shows `ApiError.title` raw: unknown errors map by status (`useNotify().error`), field errors are shown through their i18n keys.
- Consumers of `useUserSettings` gate on `isPending` / `isError` before using `monthStart` or the base currency.
- Data queries run on the client only in mock mode — no `suspense()` or server prefetch.
- Accessibility: semantic elements, labels for every input, `aria-invalid` + `aria-describedby` on invalid fields, focus moves to the first invalid field on submit, touch targets at least 44px, keyboard access for rows and the keypad.
- Only libraries from `docs/STACK.md`; PrimeVue stays on 4.x; components use design tokens, never raw hex values; amounts use `font-mono`, income amounts use `text-accent`.
- Code under `mocks/`, `app/shared/api/{contract,invalidation}.ts`, `app/features/transactions/utils` and `app/features/transactions/schemas` uses plain relative imports (no Nuxt auto-imports, no `~` alias) so it runs in Bun.
- Biome (`bun run lint`) and `nuxt typecheck` (0 `error TS` lines) must pass before every commit.

## Review Focus

- A client-supplied rate is used only for cross-currency transactions; the base amount always follows the path entered currency → account currency → base currency, and reading a row after the base currency changed converts it with the rate of its date instead of returning an amount in the wrong currency. Pinned in Task 1.
- Editing an old transaction that sits on an archived account succeeds; moving any transaction onto an archived account fails. Pinned in Task 1.
- Seeding on any day of the year keeps today's balances equal to the designed ones and never produces a negative opening balance. Pinned in Task 2.
- The dialog in edit mode keeps the stored (possibly corrected) rate after opening; changing the currency or the account currency re-prefills it. Pinned by Task 4 code and its E2E.
- Sorting is server-side (`manualSorting`) over the whole filtered set, not the loaded pages. Pinned in Task 5.
- CSV contains every filtered transaction across pages, neutralises spreadsheet formulas and escapes quotes. Pinned in Task 3 and Task 5.

---

## File map

| File | Responsibility |
|---|---|
| `app/shared/api/contract.ts` | `TransactionSort`, `transactionSorts`, `TransactionDto`, `TransactionInput`, `TransactionQuery`, `TransactionPage` |
| `mocks/db.ts` | `TransactionRow`, `MockState.transactions` |
| `mocks/transactions.ts` | `priceTransaction`, `baseCurrencyOf`, `baseAmountOf`, `signed` |
| `mocks/ledger.ts` | `transactionMovements` in `ledgers` |
| `mocks/categories.ts` | transactions entry in `categoryReferences` |
| `mocks/handlers/transactions.ts` | `GET/POST /v1/transactions`, `GET/PUT/DELETE /v1/transactions/{id}` |
| `mocks/seed/transactions.ts` | deterministic six-month history, `withTransactionHistory` |
| `mocks/seed/index.ts`, `mocks/handlers/index.ts` | wiring |
| `app/shared/api/invalidation.ts` | `transactions` change |
| `app/shared/components/AppIcon.vue`, `app/shared/types/icon.ts` | `download`, `search`, `filter`, `close`, `arrowUp`, `arrowDown`, `backspace` |
| `app/features/transactions/api/*` | `transactionsApi`, `transactionKeys` |
| `app/features/transactions/utils/*` | `filters.ts`, `group.ts`, `csv.ts`, `keypad.ts`, `download.ts` |
| `app/features/transactions/schemas/transactionSchema.ts` | dialog and quick-add rules |
| `app/features/transactions/composables/*` | `useTransactions`, `useTransactionMutations`, `useTransactionDialog`, `useTransactionExport`, `useTransactionsScreen` |
| `app/features/transactions/types.ts` | `TransactionView` |
| `app/features/transactions/components/*` | `TransactionDialog`, `TransactionSearch`, `TransactionKindTabs`, `TransactionFilterFields`, `TransactionSummary`, `TransactionTable`, `TransactionDayList`, `QuickAddForm`, `QuickAddKeypad` |
| `app/layouts/default.vue`, `app/layouts/focus.vue` | dialog mount; full-screen layout |
| `app/shared/components/AppSidebar.vue` | "New transaction" button |
| `app/pages/transactions/index.vue`, `app/pages/transactions/new.vue` | screens |
| `i18n/locales/*.json` | `transactions.*`, new `validation.*` codes |

All shell commands run inside WSL in `~/dock.mita.frontend` on branch `feature/transactions` through the helper: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/wsl-run.sh '<command>'`. E2E: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/scripts/tx-e2e.sh <playwright args>` (starts a dev server on port 3100, warms up the routes, runs the official Playwright container, stops the server).

---
### Task 1: Transactions in the mock backend

**Files:**
- Modify: `app/shared/api/contract.ts`, `mocks/db.ts`, `mocks/ledger.ts`, `mocks/categories.ts`, `mocks/seed/index.ts`, `mocks/handlers/index.ts`
- Create: `mocks/transactions.ts`, `mocks/handlers/transactions.ts`
- Test: `tests/unit/mocks/transactions.test.ts`

**Interfaces:**
- Consumes: `Page`, `CategoryKind`, `categoryKinds` (`contract.ts`); `Currency`, `convertMinor`; `isIsoDate`, `todayIso`; `ownCategories`, `categoryReferences`; `ledgers`; `rateOn`, `roundRate`; `paginate`; `badRequest`, `notFound`; `newId`; `collectErrors`, `isCurrency`, `isMissing`, `objectBody`; `oneYearAhead` (`mocks/handlers/transfers.ts`).
- Produces:
  - contract: `type TransactionSort = '-date' | 'date' | '-amount' | 'amount'`, `transactionSorts`, `TransactionDto`, `TransactionInput`, `TransactionQuery`, `TransactionPage = Page<TransactionDto> & { sum: number; currency: Currency }`
  - db: `TransactionRow = TransactionDto & { userId: string; accountCurrency: Currency; baseCurrency: Currency }`, `MockState.transactions`
  - `mocks/transactions.ts`: `priceTransaction(rates, input): Price`, `baseCurrencyOf(state, userId)`, `baseAmountOf(state, row, base)`, `signed(row, amount)`
  - `mocks/ledger.ts`: `transactionMovements`
  - `mocks/handlers/transactions.ts`: `TRANSACTION_TITLE_MAX = 100`, `TRANSACTION_NOTE_MAX = 200`, `registerTransactionHandlers(router)`
  - `GET /v1/transactions?search=&categoryId=&accountId=&kind=&from=&to=&sort=&page=&pageSize=` → `TransactionPage` (default page size 20, max 100, default sort `-date`; `sum` is the signed base-currency sum of the whole filtered set, income positive; `currency` is the current base currency; `baseAmount` of every item is in that currency). Search matches title, note and category name case-insensitively, or the amount when the search is a number (`86`, `86.4`, `86,40`). Amount sorts compare base amounts (magnitude); ties fall back to newest first.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/mocks/transactions.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import type { AccountDto, CategoryDto, Page, TransactionDto, TransactionPage } from '../../../app/shared/api/contract'
import { convertMinor } from '../../../app/shared/money/money'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import { createMockApi, type MockApi } from '../../../mocks/api'
import { createDb, type KeyValueStorage, STORAGE_KEY } from '../../../mocks/db'
import { defaultHandlers } from '../../../mocks/handlers'
import { oneYearAhead } from '../../../mocks/handlers/transfers'
import { rateOn } from '../../../mocks/rates'
import { seedState } from '../../../mocks/seed'

const today = todayIso()
const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)
const field = (name: string, code: string) => ({ problem: { status: 400, errors: { [name]: [code] } } })

const api = (): MockApi => {
  const mock = createMockApi({ register: defaultHandlers })
  mock.db.state.transactions = []
  return mock
}

const lidl = {
  kind: 'expense',
  date: today,
  title: 'Lidl',
  categoryId: 'cat_anna_expense_groceries',
  accountId: 'acc_anna_card',
  amount: 14_230,
  currency: 'PLN',
}

const create = (mock: MockApi, body: unknown) =>
  mock.handle({ method: 'POST', path: '/v1/transactions', body }) as Promise<TransactionDto>
const list = (mock: MockApi, query?: Record<string, string>) =>
  mock.handle({ method: 'GET', path: '/v1/transactions', query }) as Promise<TransactionPage>
const titles = async (mock: MockApi, query: Record<string, string>) =>
  (await list(mock, query)).items.map((item) => item.title)
const balanceOf = async (mock: MockApi, id: string) =>
  ((await mock.handle({ method: 'GET', path: '/v1/accounts' })) as Page<AccountDto>).items.find(
    (account) => account.id === id,
  )?.balance ?? 0

describe('transactions', () => {
  it('creates an expense in the account currency and lowers the balance', async () => {
    const mock = api()
    const before = await balanceOf(mock, 'acc_anna_card')
    const created = await create(mock, { ...lidl, title: '  Lidl  ', note: '  ' })
    expect(created).toMatchObject({
      kind: 'expense',
      date: today,
      title: 'Lidl',
      note: null,
      amount: 14_230,
      currency: 'PLN',
      accountAmount: 14_230,
      rate: 1,
      baseAmount: 14_230,
    })
    expect(created.id).toStartWith('txn_')
    expect(Object.keys(created).sort()).toEqual([
      'accountAmount',
      'accountId',
      'amount',
      'baseAmount',
      'categoryId',
      'currency',
      'date',
      'id',
      'kind',
      'note',
      'rate',
      'title',
    ])
    expect(await balanceOf(mock, 'acc_anna_card')).toBe(before - 14_230)
  })

  it('adds income to the balance and stores an empty title when none is given', async () => {
    const mock = api()
    const before = await balanceOf(mock, 'acc_anna_card')
    const { title: _title, ...body } = lidl
    const created = await create(mock, {
      ...body,
      kind: 'income',
      categoryId: 'cat_anna_income_salary',
      amount: 740_000,
    })
    expect(created).toMatchObject({ kind: 'income', title: '' })
    expect(await balanceOf(mock, 'acc_anna_card')).toBe(before + 740_000)
  })

  it('converts a EUR payment from a PLN card with the rate of the date unless one is given', async () => {
    const mock = api()
    const date = addDaysIso(today, -3)
    const rate = rateOn(mock.db.state.rates, date, 'EUR', 'PLN')
    const body = { ...lidl, date, currency: 'EUR', amount: 5_000 }
    expect(await create(mock, body)).toMatchObject({
      currency: 'EUR',
      amount: 5_000,
      rate,
      accountAmount: convertMinor(5_000, rate),
      baseAmount: convertMinor(5_000, rate),
    })
    expect(await create(mock, { ...body, rate: 4.5 })).toMatchObject({
      rate: 4.5,
      accountAmount: 22_500,
      baseAmount: 22_500,
    })
  })

  it('ignores a client rate when the currencies are equal', async () => {
    expect(await create(api(), { ...lidl, rate: 3 })).toMatchObject({ rate: 1, accountAmount: 14_230 })
  })

  it('converts into the base currency through the account currency', async () => {
    const mock = api()
    const usdEur = rateOn(mock.db.state.rates, today, 'USD', 'EUR')
    const eurPln = rateOn(mock.db.state.rates, today, 'EUR', 'PLN')
    const created = await create(mock, { ...lidl, accountId: 'acc_anna_eur', currency: 'USD', amount: 10_000 })
    const accountAmount = convertMinor(10_000, usdEur)
    expect(created).toMatchObject({ rate: usdEur, accountAmount, baseAmount: convertMinor(accountAmount, eurPln) })
  })

  it('keeps stored amounts when rates change later', async () => {
    const mock = api()
    const created = await create(mock, { ...lidl, currency: 'EUR', amount: 5_000 })
    for (const row of mock.db.state.rates) row.value *= 2
    expect((await list(mock)).items[0]).toMatchObject({
      rate: created.rate,
      accountAmount: created.accountAmount,
      baseAmount: created.baseAmount,
    })
  })

  it('reports base amounts in the current base currency after it changes', async () => {
    const mock = api()
    await create(mock, lidl)
    const settings = mock.db.state.settings.find((row) => row.userId === 'usr_anna')
    if (!settings) throw new Error('seed has no settings for Anna')
    settings.baseCurrency = 'EUR'
    const page = await list(mock)
    const expected = convertMinor(14_230, rateOn(mock.db.state.rates, today, 'PLN', 'EUR'))
    expect(page).toMatchObject({ currency: 'EUR', sum: -expected })
    expect(page.items[0]?.baseAmount).toBe(expected)
  })

  it('validates fields with i18n codes', async () => {
    const mock = api()
    expect(await failure(create(mock, {}))).toMatchObject({
      problem: {
        status: 400,
        errors: {
          kind: ['validation.required'],
          date: ['validation.required'],
          categoryId: ['validation.required'],
          accountId: ['validation.required'],
          amount: ['validation.required'],
          currency: ['validation.required'],
        },
      },
    })
    expect(
      await failure(
        create(mock, {
          ...lidl,
          kind: 'transfer',
          date: '2026-02-30',
          amount: 0,
          currency: 'GBP',
          rate: -1,
          title: 'x'.repeat(101),
          note: 'y'.repeat(201),
        }),
      ),
    ).toMatchObject({
      problem: {
        errors: {
          kind: ['validation.invalidValue'],
          date: ['validation.invalidValue'],
          amount: ['validation.positiveAmount'],
          currency: ['validation.invalidValue'],
          rate: ['validation.invalidValue'],
          title: ['validation.titleTooLong'],
          note: ['validation.noteTooLong'],
        },
      },
    })
    expect(await failure(create(mock, { ...lidl, date: addDaysIso(oneYearAhead(today), 1) }))).toMatchObject(
      field('date', 'validation.dateTooFar'),
    )
    expect(await create(mock, { ...lidl, date: oneYearAhead(today), title: 'z'.repeat(100) })).toMatchObject({
      date: oneYearAhead(today),
    })
    for (const amount of [100_000_000_001, 12.5, '100']) {
      expect(await failure(create(mock, { ...lidl, amount }))).toMatchObject(field('amount', 'validation.invalidValue'))
    }
  })

  it('requires an own category of the same kind and never the transfer category', async () => {
    const mock = api()
    expect(await failure(create(mock, { ...lidl, categoryId: 'cat_anna_income_salary' }))).toMatchObject(
      field('categoryId', 'validation.categoryKindMismatch'),
    )
    for (const categoryId of ['cat_oleh_expense_groceries', 'cat_anna_expense_transfer', 'cat_missing']) {
      expect(await failure(create(mock, { ...lidl, categoryId }))).toMatchObject(
        field('categoryId', 'validation.unknownCategory'),
      )
    }
  })

  it('refuses archived accounts for new transactions but keeps one on edit', async () => {
    const mock = api()
    expect(await failure(create(mock, { ...lidl, accountId: 'acc_oleh_card' }))).toMatchObject(
      field('accountId', 'validation.unknownAccount'),
    )
    const onCash = await create(mock, { ...lidl, accountId: 'acc_anna_cash' })
    const onCard = await create(mock, lidl)
    const cash = mock.db.state.accounts.find((row) => row.id === 'acc_anna_cash')
    if (!cash) throw new Error('seed has no cash account')
    cash.archived = true
    expect(await failure(create(mock, { ...lidl, accountId: 'acc_anna_cash' }))).toMatchObject(
      field('accountId', 'validation.archivedAccount'),
    )
    expect(
      await mock.handle({
        method: 'PUT',
        path: `/v1/transactions/${onCash.id}`,
        body: { ...lidl, accountId: 'acc_anna_cash', title: 'Żabka' },
      }),
    ).toMatchObject({ title: 'Żabka', accountId: 'acc_anna_cash' })
    expect(
      await failure(
        mock.handle({
          method: 'PUT',
          path: `/v1/transactions/${onCard.id}`,
          body: { ...lidl, accountId: 'acc_anna_cash' },
        }),
      ),
    ).toMatchObject(field('accountId', 'validation.archivedAccount'))
  })

  it('reads, updates and deletes an own transaction and returns 404 for others', async () => {
    const mock = api()
    const created = await create(mock, { ...lidl, note: 'Weekly' })
    const path = `/v1/transactions/${created.id}`
    expect(await mock.handle({ method: 'GET', path })).toEqual(created)
    expect(await mock.handle({ method: 'PUT', path, body: { ...lidl, amount: 10_000 } })).toMatchObject({
      id: created.id,
      amount: 10_000,
      accountAmount: 10_000,
      note: null,
    })
    expect(await mock.handle({ method: 'DELETE', path })).toBeUndefined()
    expect(await failure(mock.handle({ method: 'GET', path }))).toMatchObject({ problem: { status: 404 } })
    const foreign = await create(mock, lidl)
    await mock.handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_oleh' } })
    for (const method of ['GET', 'PUT', 'DELETE'] as const) {
      expect(
        await failure(mock.handle({ method, path: `/v1/transactions/${foreign.id}`, body: lidl })),
      ).toMatchObject({ problem: { status: 404 } })
    }
    expect((await list(mock)).total).toBe(0)
  })

  it('lists newest first with paging, a total and the signed sum in the base currency', async () => {
    const mock = api()
    await create(mock, { ...lidl, date: addDaysIso(today, -2), amount: 1_000 })
    const newest = await create(mock, { ...lidl, amount: 2_000 })
    await create(mock, {
      ...lidl,
      kind: 'income',
      categoryId: 'cat_anna_income_salary',
      date: addDaysIso(today, -1),
      amount: 50_000,
    })
    const page = await list(mock, { pageSize: '2' })
    expect(page).toMatchObject({ page: 1, pageSize: 2, total: 3, sum: 47_000, currency: 'PLN' })
    expect(page.items[0]?.id).toBe(newest.id)
    expect(page.items.map((item) => item.date)).toEqual([today, addDaysIso(today, -1)])
    expect((await list(mock, { page: '2', pageSize: '2' })).items).toHaveLength(1)
    expect(await failure(list(mock, { pageSize: '101' }))).toMatchObject(field('pageSize', 'validation.invalidValue'))
  })

  it('filters by kind, category, account, period and search', async () => {
    const mock = api()
    await create(mock, { ...lidl, date: addDaysIso(today, -40) })
    await create(mock, { ...lidl, title: 'Żabka', accountId: 'acc_anna_cash', amount: 2_460, note: 'Bułki' })
    await create(mock, { ...lidl, title: '', categoryId: 'cat_anna_expense_cafes', amount: 3_600 })
    await create(mock, {
      ...lidl,
      kind: 'income',
      title: 'Pensja',
      categoryId: 'cat_anna_income_salary',
      amount: 740_000,
    })
    expect(await titles(mock, { kind: 'income' })).toEqual(['Pensja'])
    expect(await titles(mock, { categoryId: 'cat_anna_expense_cafes' })).toEqual([''])
    expect(await titles(mock, { accountId: 'acc_anna_cash' })).toEqual(['Żabka'])
    expect(await titles(mock, { from: addDaysIso(today, -41), to: addDaysIso(today, -39) })).toEqual(['Lidl'])
    expect(await titles(mock, { search: ' LIDL ' })).toEqual(['Lidl'])
    expect(await titles(mock, { search: 'bułki' })).toEqual(['Żabka'])
    expect(await titles(mock, { search: 'kawiar' })).toEqual([''])
    expect(await titles(mock, { search: '24,6' })).toEqual(['Żabka'])
    expect(await titles(mock, { search: '7400' })).toEqual(['Pensja'])
    expect(await failure(list(mock, { kind: 'transfer', from: 'yesterday', to: '2026-13-01', sort: 'title' }))).toMatchObject({
      problem: {
        status: 400,
        errors: {
          kind: ['validation.invalidValue'],
          from: ['validation.invalidValue'],
          to: ['validation.invalidValue'],
          sort: ['validation.invalidValue'],
        },
      },
    })
  })

  it('sorts by date or by the amount in the base currency', async () => {
    const mock = api()
    await create(mock, { ...lidl, title: 'small', amount: 1_000, date: addDaysIso(today, -1) })
    await create(mock, { ...lidl, title: 'euro', currency: 'EUR', amount: 1_000, date: addDaysIso(today, -2) })
    await create(mock, { ...lidl, title: 'big', amount: 3_000 })
    expect(await titles(mock, { sort: '-date' })).toEqual(['big', 'small', 'euro'])
    expect(await titles(mock, { sort: 'date' })).toEqual(['euro', 'small', 'big'])
    expect(await titles(mock, { sort: '-amount' })).toEqual(['euro', 'big', 'small'])
    expect(await titles(mock, { sort: 'amount' })).toEqual(['small', 'big', 'euro'])
  })

  it('marks the category as used and moves transactions to other when it is deleted', async () => {
    const mock = api()
    const created = await create(mock, { ...lidl, categoryId: 'cat_anna_expense_sport' })
    const categories = (await mock.handle({ method: 'GET', path: '/v1/categories' })) as Page<CategoryDto>
    expect(categories.items.find((category) => category.id === 'cat_anna_expense_sport')?.inUse).toBe(true)
    await mock.handle({ method: 'DELETE', path: '/v1/categories/cat_anna_expense_sport' })
    expect(await mock.handle({ method: 'GET', path: `/v1/transactions/${created.id}` })).toMatchObject({
      categoryId: 'cat_anna_expense_other',
    })
  })

  it('keeps an account with transactions from being deleted', async () => {
    const mock = api()
    const account = (await mock.handle({
      method: 'POST',
      path: '/v1/accounts',
      body: { name: 'Travel', type: 'cash', currency: 'EUR', openingBalance: 0 },
    })) as AccountDto
    await create(mock, { ...lidl, accountId: account.id })
    expect(await failure(mock.handle({ method: 'DELETE', path: `/v1/accounts/${account.id}` }))).toMatchObject(
      field('id', 'validation.accountInUse'),
    )
  })

  it('starts from the seed when the stored database has no transactions table', () => {
    const { transactions: _transactions, ...older } = seedState()
    const storage: KeyValueStorage = {
      getItem: (key) => (key === STORAGE_KEY ? JSON.stringify(older) : null),
      setItem: () => {},
    }
    expect(Array.isArray(createDb(storage, seedState).state.transactions)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/unit/mocks/transactions.test.ts`
Expected: FAIL — `POST /v1/transactions` returns 404 / `transactions` is not part of the state.

- [ ] **Step 3: Add the contract types**

Append to `app/shared/api/contract.ts`:

```ts
export type TransactionSort = '-date' | 'date' | '-amount' | 'amount'

export const transactionSorts: readonly TransactionSort[] = ['-date', 'date', '-amount', 'amount']

export type TransactionDto = {
  id: string
  kind: CategoryKind
  date: string
  title: string
  note: string | null
  categoryId: string
  accountId: string
  amount: number
  currency: Currency
  accountAmount: number
  rate: number
  baseAmount: number
}

export type TransactionInput = {
  kind: CategoryKind
  date: string
  title?: string
  note?: string
  categoryId: string
  accountId: string
  amount: number
  currency: Currency
  rate?: number
}

export type TransactionQuery = {
  search?: string
  categoryId?: string
  accountId?: string
  kind?: CategoryKind
  from?: string
  to?: string
  sort?: TransactionSort
}

export type TransactionPage = Page<TransactionDto> & { sum: number; currency: Currency }
```

- [ ] **Step 4: Add the table to the mock database and the seed**

In `mocks/db.ts`: extend the contract import with `TransactionDto`, add `import type { Currency } from '../app/shared/money/money'`, add after `CategoryRow`:

```ts
export type TransactionRow = TransactionDto & { userId: string; accountCurrency: Currency; baseCurrency: Currency }
```

and add `transactions: TransactionRow[]` as the last field of `MockState`.

In `mocks/seed/index.ts` add `transactions: [],` as the last property of the returned state (Task 2 replaces it with the seeded history).

- [ ] **Step 5: Write the pricing helpers**

Create `mocks/transactions.ts`:

```ts
import { type Currency, convertMinor } from '../app/shared/money/money'
import type { MockState, RateRow, TransactionRow } from './db'
import { rateOn, roundRate } from './rates'

export type PriceInput = {
  date: string
  amount: number
  currency: Currency
  accountCurrency: Currency
  baseCurrency: Currency
  rate?: number
}

export type Price = Pick<TransactionRow, 'rate' | 'accountAmount' | 'baseAmount' | 'accountCurrency' | 'baseCurrency'>

export function priceTransaction(rates: readonly RateRow[], input: PriceInput): Price {
  const rate =
    input.currency === input.accountCurrency
      ? 1
      : input.rate !== undefined
        ? roundRate(input.rate)
        : rateOn(rates, input.date, input.currency, input.accountCurrency)
  const accountAmount = convertMinor(input.amount, rate)
  const baseAmount =
    input.currency === input.baseCurrency
      ? input.amount
      : convertMinor(accountAmount, rateOn(rates, input.date, input.accountCurrency, input.baseCurrency))
  return {
    rate,
    accountAmount,
    baseAmount,
    accountCurrency: input.accountCurrency,
    baseCurrency: input.baseCurrency,
  }
}

export const baseCurrencyOf = (state: MockState, userId: string): Currency =>
  state.settings.find((row) => row.userId === userId)?.baseCurrency ?? 'PLN'

export function baseAmountOf(state: MockState, row: TransactionRow, base: Currency): number {
  if (row.baseCurrency === base) return row.baseAmount
  if (row.currency === base) return row.amount
  return convertMinor(row.accountAmount, rateOn(state.rates, row.date, row.accountCurrency, base))
}

export const signed = (row: Pick<TransactionRow, 'kind'>, amount: number): number =>
  row.kind === 'income' ? amount : -amount
```

- [ ] **Step 6: Plug transactions into the ledger and the category registry**

In `mocks/ledger.ts` add before `ledgers` and extend the array:

```ts
export const transactionMovements: Ledger = (state, userId) =>
  state.transactions
    .filter((row) => row.userId === userId)
    .map((row) => ({
      accountId: row.accountId,
      amount: row.kind === 'income' ? row.accountAmount : -row.accountAmount,
    }))

export const ledgers: Ledger[] = [transferMovements, transactionMovements]
```

In `mocks/categories.ts` replace `export const categoryReferences: CategoryReference[] = []` with:

```ts
const transactionReference: CategoryReference = {
  usedCategoryIds: (state, userId) =>
    new Set(state.transactions.filter((row) => row.userId === userId).map((row) => row.categoryId)),
  reassign: (state, userId, fromId, toId) => {
    for (const row of state.transactions) {
      if (row.userId === userId && row.categoryId === fromId) row.categoryId = toId
    }
  },
}

export const categoryReferences: CategoryReference[] = [transactionReference]
```

- [ ] **Step 7: Write the handlers**

Create `mocks/handlers/transactions.ts`:

```ts
import {
  type CategoryKind,
  categoryKinds,
  type TransactionDto,
  type TransactionPage,
  type TransactionSort,
  transactionSorts,
} from '../../app/shared/api/contract'
import type { Currency } from '../../app/shared/money/money'
import { isIsoDate, todayIso } from '../../app/shared/period/period'
import { ownCategories } from '../categories'
import type { AccountRow, CategoryRow, MockDb, TransactionRow } from '../db'
import { badRequest, notFound } from '../errors'
import { newId } from '../ids'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'
import { baseAmountOf, baseCurrencyOf, priceTransaction, signed } from '../transactions'
import { collectErrors, isCurrency, isMissing, objectBody } from '../validation'
import { oneYearAhead } from './transfers'

export const TRANSACTION_TITLE_MAX = 100
export const TRANSACTION_NOTE_MAX = 200
const MAX_AMOUNT = 100_000_000_000
const AMOUNT_SEARCH = /^\d+(?:[.,]\d{0,2})?$/

type Errors = ReturnType<typeof collectErrors>
type Fields = Omit<TransactionRow, 'id' | 'userId'>
type Filters = {
  search?: string
  categoryId?: string
  accountId?: string
  kind?: CategoryKind
  from?: string
  to?: string
  sort: TransactionSort
}
type Ranked = { row: TransactionRow; index: number; base: number }

const isKind = (value: unknown): value is CategoryKind => categoryKinds.includes(value as CategoryKind)

const isSort = (value: unknown): value is TransactionSort => transactionSorts.includes(value as TransactionSort)

function checkText(value: unknown, field: string, max: number, tooLong: string, errors: Errors): void {
  if (isMissing(value)) return
  if (typeof value !== 'string') errors.add(field, 'validation.invalidValue')
  else if (value.trim().length > max) errors.add(field, tooLong)
}

function checkCategory(own: readonly CategoryRow[], value: unknown, kind: unknown, errors: Errors): void {
  if (isMissing(value)) {
    errors.add('categoryId', 'validation.required')
    return
  }
  const category = own.find((row) => row.id === value)
  if (!category || category.system === 'transfer') errors.add('categoryId', 'validation.unknownCategory')
  else if (isKind(kind) && category.kind !== kind) errors.add('categoryId', 'validation.categoryKindMismatch')
}

function checkAccount(
  db: MockDb,
  userId: string,
  value: unknown,
  existing: TransactionRow | undefined,
  errors: Errors,
): AccountRow | undefined {
  if (isMissing(value)) {
    errors.add('accountId', 'validation.required')
    return undefined
  }
  const account = db.state.accounts.find((row) => row.id === value && row.userId === userId)
  if (!account) errors.add('accountId', 'validation.unknownAccount')
  else if (account.archived && account.id !== existing?.accountId) errors.add('accountId', 'validation.archivedAccount')
  return account
}

function validateTransaction(db: MockDb, userId: string, body: unknown, existing?: TransactionRow): Fields {
  const { kind, date, title, note, categoryId, accountId, amount, currency, rate } = objectBody(body)
  const errors = collectErrors()
  if (isMissing(kind)) errors.add('kind', 'validation.required')
  else if (!isKind(kind)) errors.add('kind', 'validation.invalidValue')
  if (isMissing(date)) errors.add('date', 'validation.required')
  else if (!isIsoDate(date)) errors.add('date', 'validation.invalidValue')
  else if (date > oneYearAhead(todayIso())) errors.add('date', 'validation.dateTooFar')
  checkText(title, 'title', TRANSACTION_TITLE_MAX, 'validation.titleTooLong', errors)
  checkText(note, 'note', TRANSACTION_NOTE_MAX, 'validation.noteTooLong', errors)
  checkCategory(ownCategories(db, userId), categoryId, kind, errors)
  const account = checkAccount(db, userId, accountId, existing, errors)
  if (isMissing(amount)) errors.add('amount', 'validation.required')
  else if (!Number.isSafeInteger(amount) || (amount as number) > MAX_AMOUNT) {
    errors.add('amount', 'validation.invalidValue')
  } else if ((amount as number) <= 0) errors.add('amount', 'validation.positiveAmount')
  if (isMissing(currency)) errors.add('currency', 'validation.required')
  else if (!isCurrency(currency)) errors.add('currency', 'validation.invalidValue')
  if (!isMissing(rate) && (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0)) {
    errors.add('rate', 'validation.invalidValue')
  }
  errors.throwIfAny()
  const target = account as AccountRow
  const day = date as string
  const price = priceTransaction(db.state.rates, {
    date: day,
    amount: amount as number,
    currency: currency as Currency,
    accountCurrency: target.currency,
    baseCurrency: baseCurrencyOf(db.state, userId),
    ...(typeof rate === 'number' ? { rate } : {}),
  })
  if (price.accountAmount <= 0) badRequest({ rate: ['validation.positiveAmount'] })
  const trimmedNote = typeof note === 'string' ? note.trim() : ''
  return {
    kind: kind as CategoryKind,
    date: day,
    title: typeof title === 'string' ? title.trim() : '',
    note: trimmedNote === '' ? null : trimmedNote,
    categoryId: categoryId as string,
    accountId: target.id,
    amount: amount as number,
    currency: currency as Currency,
    ...price,
  }
}

function readFilters(query: Record<string, string>): Filters {
  const errors = collectErrors()
  if (query.kind !== undefined && !isKind(query.kind)) errors.add('kind', 'validation.invalidValue')
  if (query.from !== undefined && !isIsoDate(query.from)) errors.add('from', 'validation.invalidValue')
  if (query.to !== undefined && !isIsoDate(query.to)) errors.add('to', 'validation.invalidValue')
  if (query.sort !== undefined && !isSort(query.sort)) errors.add('sort', 'validation.invalidValue')
  errors.throwIfAny()
  const search = query.search?.trim().toLocaleLowerCase()
  return {
    search: search === '' ? undefined : search,
    categoryId: query.categoryId,
    accountId: query.accountId,
    kind: query.kind as CategoryKind | undefined,
    from: query.from,
    to: query.to,
    sort: (query.sort as TransactionSort | undefined) ?? '-date',
  }
}

function matchesSearch(row: TransactionRow, search: string, categoryName: string): boolean {
  if ([row.title, row.note ?? '', categoryName].some((text) => text.toLocaleLowerCase().includes(search))) return true
  return AMOUNT_SEARCH.test(search) && (row.amount / 100).toFixed(2).startsWith(search.replace(',', '.'))
}

const matches = (row: TransactionRow, filters: Filters, categoryName: string): boolean =>
  (filters.kind === undefined || row.kind === filters.kind) &&
  (filters.categoryId === undefined || row.categoryId === filters.categoryId) &&
  (filters.accountId === undefined || row.accountId === filters.accountId) &&
  (filters.from === undefined || row.date >= filters.from) &&
  (filters.to === undefined || row.date <= filters.to) &&
  (filters.search === undefined || matchesSearch(row, filters.search, categoryName))

const newestFirst = (a: Ranked, b: Ranked): number => b.row.date.localeCompare(a.row.date) || b.index - a.index

const comparators: Record<TransactionSort, (a: Ranked, b: Ranked) => number> = {
  '-date': newestFirst,
  date: (a, b) => a.row.date.localeCompare(b.row.date) || a.index - b.index,
  '-amount': (a, b) => b.base - a.base || newestFirst(a, b),
  amount: (a, b) => a.base - b.base || newestFirst(a, b),
}

const toDto = (row: TransactionRow, baseAmount: number): TransactionDto => ({
  id: row.id,
  kind: row.kind,
  date: row.date,
  title: row.title,
  note: row.note,
  categoryId: row.categoryId,
  accountId: row.accountId,
  amount: row.amount,
  currency: row.currency,
  accountAmount: row.accountAmount,
  rate: row.rate,
  baseAmount,
})

const ownTransaction = (db: MockDb, userId: string, id: string | undefined): TransactionRow =>
  db.state.transactions.find((row) => row.id === id && row.userId === userId) ?? notFound()

export function registerTransactionHandlers(router: MockRouter) {
  router.on('GET', '/v1/transactions', ({ db, userId, query }): TransactionPage => {
    const filters = readFilters(query)
    const base = baseCurrencyOf(db.state, userId)
    const names = new Map(ownCategories(db, userId).map((row) => [row.id, row.name]))
    const ranked: Ranked[] = []
    for (const [index, row] of db.state.transactions.entries()) {
      if (row.userId === userId && matches(row, filters, names.get(row.categoryId) ?? '')) {
        ranked.push({ row, index, base: baseAmountOf(db.state, row, base) })
      }
    }
    ranked.sort(comparators[filters.sort])
    const sum = ranked.reduce((total, entry) => total + signed(entry.row, entry.base), 0)
    const page = paginate(
      ranked.map((entry) => toDto(entry.row, entry.base)),
      query,
      { defaultPageSize: 20, maxPageSize: 100 },
    )
    return { ...page, sum, currency: base }
  })

  router.on('GET', '/v1/transactions/:id', ({ db, userId, params }) => {
    const row = ownTransaction(db, userId, params.id)
    return toDto(row, baseAmountOf(db.state, row, baseCurrencyOf(db.state, userId)))
  })

  router.on('POST', '/v1/transactions', ({ db, userId, body }) => {
    const row: TransactionRow = { id: newId('txn'), userId, ...validateTransaction(db, userId, body) }
    db.state.transactions.push(row)
    db.save()
    return toDto(row, row.baseAmount)
  })

  router.on('PUT', '/v1/transactions/:id', ({ db, userId, params, body }) => {
    const row = ownTransaction(db, userId, params.id)
    Object.assign(row, validateTransaction(db, userId, body, row))
    db.save()
    return toDto(row, row.baseAmount)
  })

  router.on('DELETE', '/v1/transactions/:id', ({ db, userId, params }) => {
    const row = ownTransaction(db, userId, params.id)
    db.state.transactions = db.state.transactions.filter((transaction) => transaction.id !== row.id)
    db.save()
  })
}
```

In `mocks/handlers/index.ts` import `registerTransactionHandlers` from `./transactions` and append it to `defaultHandlers`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `bun test tests/unit` → all pass (the new file and every existing mock test).

- [ ] **Step 9: Lint, typecheck, commit**

Run: `bunx biome check --write app/shared/api/contract.ts mocks tests/unit/mocks/transactions.test.ts && bun run lint && bun run typecheck 2>&1 | grep -c "error TS"` → lint clean, `0`.

```bash
git add app/shared/api/contract.ts mocks tests/unit/mocks/transactions.test.ts
git commit -m "feat: transactions with rates, filters and sorting in the mock backend"
```

---
### Task 2: Six months of seeded transactions for both demo users

**Files:**
- Create: `mocks/seed/transactions.ts`
- Modify: `mocks/seed/index.ts`, `tests/unit/mocks/categories.test.ts`, `tests/unit/mocks/categoryMutations.test.ts`
- Test: `tests/unit/mocks/seedTransactions.test.ts`

**Interfaces:**
- Consumes: `priceTransaction` (Task 1), `TransactionRow`, `AccountRow`, `RateRow`, `SettingsRow`, `addDaysIso`, `demoAccounts`, `demoSettings`, `seedRates`.
- Produces: `TRANSACTION_HISTORY_DAYS = 182`, `demoTransactions(today, accounts, rates, settings): TransactionRow[]` (oldest first, ids `txn_seed_<anna|oleh>_<n>`), `withTransactionHistory(accounts, transactions): AccountRow[]` (opening balance minus the account's net transaction movement, so balances computed by the ledger stay as designed).

The history is a pure function of the calendar day: a small seeded generator keyed by `userId:date` decides the random parts, so two seeds made on different days agree on the days they share (like the rate table). Fixed monthly events follow the design: salary on the 10th, rent on the 5th, MZK monthly ticket on the 14th; groceries at Biedronka (Mon, Thu), Lidl (Sat), Żabka (random, cash); cafes; a holiday in Barcelona paid from the EUR account and a few EUR payments from the PLN card. Oleh lives in UAH (salary on the 10th, rent on the 5th, Сільпо/АТБ/Novus, Uklon, Aroma Kava) with USD subscriptions and freelance income paid into the UAH card.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/mocks/seedTransactions.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import type { TransactionPage } from '../../../app/shared/api/contract'
import { addDaysIso } from '../../../app/shared/period/period'
import { createMockApi } from '../../../mocks/api'
import { defaultHandlers } from '../../../mocks/handlers'
import { accountBalances } from '../../../mocks/ledger'
import { seedState } from '../../../mocks/seed'
import { TRANSACTION_HISTORY_DAYS } from '../../../mocks/seed/transactions'

const seedDays = ['2026-10-16', '2026-03-01', '2026-12-31', '2027-02-28', '2027-07-09']
const users = ['usr_anna', 'usr_oleh']

describe('seeded transactions', () => {
  it.each(seedDays)('keeps the designed balances and non-negative opening balances when seeded on %s', (today) => {
    const state = seedState(today)
    const anna = accountBalances(state, 'usr_anna')
    const oleh = accountBalances(state, 'usr_oleh')
    expect(anna.get('acc_anna_card')).toBe(882_040)
    expect(anna.get('acc_anna_cash')).toBe(94_000)
    expect(anna.get('acc_anna_savings')).toBe(1_400_000)
    expect(oleh.get('acc_oleh_card')).toBe(2_450_000)
    expect(oleh.get('acc_oleh_cash')).toBe(720_000)
    for (const account of state.accounts) expect(account.openingBalance).toBeGreaterThanOrEqual(0)
  })

  it.each(seedDays)('covers about six months for both users up to %s', (today) => {
    const state = seedState(today)
    for (const userId of users) {
      const dates = state.transactions
        .filter((row) => row.userId === userId)
        .map((row) => row.date)
        .sort()
      expect(dates.length).toBeGreaterThan(200)
      expect((dates[0] ?? '') >= addDaysIso(today, -TRANSACTION_HISTORY_DAYS)).toBe(true)
      expect((dates[0] ?? '') <= addDaysIso(today, -175)).toBe(true)
      expect((dates.at(-1) ?? '') <= today).toBe(true)
    }
  })

  it('pays salary on the 10th and rent on the 5th every month', () => {
    const anna = seedState('2026-10-16').transactions.filter((row) => row.userId === 'usr_anna')
    const salary = anna.filter((row) => row.categoryId === 'cat_anna_income_salary')
    expect(salary.length).toBeGreaterThanOrEqual(6)
    expect(salary.every((row) => row.date.endsWith('-10') && row.amount === 740_000)).toBe(true)
    const rent = anna.filter((row) => row.title === 'Czynsz')
    expect(rent.length).toBeGreaterThanOrEqual(6)
    expect(rent.every((row) => row.date.endsWith('-05') && row.amount === 210_000)).toBe(true)
    const shops = new Set(anna.filter((row) => row.categoryId === 'cat_anna_expense_groceries').map((row) => row.title))
    expect(shops).toEqual(new Set(['Biedronka', 'Lidl', 'Żabka', 'Mercadona']))
  })

  it('has a few EUR payments from the PLN card converted at the rate of their day', () => {
    const anna = seedState('2026-10-16').transactions.filter((row) => row.userId === 'usr_anna')
    const eurFromCard = anna.filter((row) => row.currency === 'EUR' && row.accountId === 'acc_anna_card')
    expect(eurFromCard.length).toBeGreaterThanOrEqual(3)
    for (const row of eurFromCard) {
      expect(row.accountCurrency).toBe('PLN')
      expect(row.rate).toBeGreaterThan(4)
      expect(row.baseAmount).toBe(row.accountAmount)
    }
  })

  it('gives Oleh a UAH life with some USD', () => {
    const oleh = seedState('2026-10-16').transactions.filter((row) => row.userId === 'usr_oleh')
    expect(oleh.every((row) => row.baseCurrency === 'UAH')).toBe(true)
    const usd = oleh.filter((row) => row.currency === 'USD')
    expect(usd.length).toBeGreaterThanOrEqual(6)
    expect(usd.some((row) => row.kind === 'income')).toBe(true)
    expect(oleh.some((row) => row.categoryId === 'cat_oleh_expense_subscriptions')).toBe(true)
    expect(oleh.filter((row) => row.categoryId === 'cat_oleh_income_salary').every((row) => row.date.endsWith('-10'))).toBe(
      true,
    )
  })

  it('references only own categories of the same kind and own accounts', () => {
    const state = seedState('2026-10-16')
    for (const row of state.transactions) {
      const category = state.categories.find((candidate) => candidate.id === row.categoryId)
      expect(category?.userId).toBe(row.userId)
      expect(category?.kind).toBe(row.kind)
      expect(category?.system).not.toBe('transfer')
      expect(state.accounts.find((account) => account.id === row.accountId)?.userId).toBe(row.userId)
      expect(row.amount).toBeGreaterThan(0)
      expect(row.accountAmount).toBeGreaterThan(0)
      expect(row.baseAmount).toBeGreaterThan(0)
    }
  })

  it('produces the same transactions for a day whenever it is seeded', () => {
    const day = (today: string) =>
      seedState(today)
        .transactions.filter((row) => row.date === '2026-09-01')
        .map(({ id: _id, ...row }) => row)
    expect(day('2026-10-16').length).toBeGreaterThan(0)
    expect(day('2026-10-16')).toEqual(day('2026-10-20'))
  })

  it('serves the seeded history through the list endpoint', async () => {
    const mock = createMockApi({ register: defaultHandlers })
    const page = (await mock.handle({
      method: 'GET',
      path: '/v1/transactions',
      query: { search: 'Biedronka', pageSize: 5 },
    })) as TransactionPage
    expect(page.total).toBeGreaterThan(10)
    expect(page.items.every((item) => item.title === 'Biedronka')).toBe(true)
    expect(page.sum).toBeLessThan(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/unit/mocks/seedTransactions.test.ts`
Expected: FAIL — `mocks/seed/transactions` does not exist.

- [ ] **Step 3: Write the seed**

Create `mocks/seed/transactions.ts`:

```ts
import type { CategoryKind } from '../../app/shared/api/contract'
import type { Currency } from '../../app/shared/money/money'
import { addDaysIso } from '../../app/shared/period/period'
import type { AccountRow, RateRow, SettingsRow, TransactionRow } from '../db'
import { priceTransaction } from '../transactions'

export const TRANSACTION_HISTORY_DAYS = 182

type Planned = {
  kind: CategoryKind
  title: string
  category: string
  account: string
  amount: number
  currency?: Currency
  note?: string
}

type Extra = Pick<Planned, 'currency' | 'note'>

type Day = {
  daysAgo: number
  dayOfMonth: number
  month: number
  weekday: number
  chance(probability: number): boolean
  between(min: number, max: number): number
  pick<T>(items: readonly T[]): T
}

const hash = (text: string): number => {
  let value = 2_166_136_261
  for (const char of text) value = Math.imul(value ^ (char.codePointAt(0) ?? 0), 16_777_619)
  return value >>> 0
}

const generator = (seed: number) => {
  let state = seed
  return (): number => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

function dayOf(userId: string, iso: string, daysAgo: number): Day {
  const random = generator(hash(`${userId}:${iso}`))
  return {
    daysAgo,
    dayOfMonth: Number(iso.slice(8, 10)),
    month: Number(iso.slice(5, 7)),
    weekday: new Date(`${iso}T00:00:00Z`).getUTCDay(),
    chance: (probability) => random() < probability,
    between: (min, max) => Math.round((min + random() * (max - min)) / 10) * 10,
    pick: <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T,
  }
}

const expense = (title: string, category: string, account: string, amount: number, extra: Extra = {}): Planned => ({
  kind: 'expense',
  title,
  category,
  account,
  amount,
  ...extra,
})

const income = (title: string, category: string, account: string, amount: number, extra: Extra = {}): Planned => ({
  kind: 'income',
  title,
  category,
  account,
  amount,
  ...extra,
})

function annaDay(day: Day): Planned[] {
  const card = 'acc_anna_card'
  const cash = 'acc_anna_cash'
  const eur = 'acc_anna_eur'
  const items: Planned[] = []
  const date = day.dayOfMonth
  if (date === 1) items.push(expense('Karnet na siłownię', 'sport', card, 12_900))
  if (date === 2) items.push(expense('Internet UPC', 'housing', card, 5_900))
  if (date === 3 && day.month % 2 === 0) items.push(income('Zlecenie — projekt logo', 'freelance', card, 80_000))
  if (date === 5) items.push(expense('Czynsz', 'housing', card, 210_000))
  if (date === 8) items.push(expense('Steam', 'leisure', card, 1_999, { currency: 'EUR' }))
  if (date === 10) items.push(income('Wynagrodzenie', 'salary', card, 740_000))
  if (date === 12) items.push(expense('Apteka', 'health', cash, day.between(2_500, 6_000)))
  if (date === 14) items.push(expense('Bilet miesięczny MZK', 'transport', card, 9_200))
  if (date === 17) items.push(expense('Rossmann', 'shopping', card, day.between(4_000, 12_000)))
  if (date === 18) items.push(expense('Abonament Play', 'other', card, 5_900))
  if (date === 19 && day.month % 2 === 1) items.push(expense('Dentysta', 'health', card, 35_000))
  if (date === 20) items.push(expense('Prąd — Tauron', 'housing', card, day.between(15_000, 21_000)))
  if (date === 22 && day.month % 2 === 1) items.push(expense('Prezent dla mamy', 'gifts', card, day.between(10_000, 20_000)))
  if (date === 24 && day.chance(0.6)) items.push(expense('Zalando', 'shopping', card, day.between(15_000, 35_000)))
  if (date === 26 && day.chance(0.3)) items.push(income('Zwrot — Zalando', 'refund', card, day.between(8_000, 15_000)))
  if (date === 28) items.push(income('Odsetki', 'interest', 'acc_anna_savings', day.between(2_400, 3_200)))
  if (day.weekday === 1 || day.weekday === 4) items.push(expense('Biedronka', 'groceries', card, day.between(6_000, 16_000)))
  if (day.weekday === 6) items.push(expense('Lidl', 'groceries', card, day.between(9_000, 22_000)))
  if (day.weekday === 6 && day.chance(0.5)) {
    items.push(expense('Restauracja Pod Aniołem', 'leisure', card, day.between(9_000, 16_000)))
  }
  if (day.chance(0.25)) items.push(expense('Żabka', 'groceries', cash, day.between(1_200, 3_500)))
  if (day.chance(0.2)) {
    const cafe = day.pick(['Starbucks', 'Costa Coffee', 'Kawiarnia Rozrusznik'])
    items.push(expense(cafe, 'cafes', day.chance(0.5) ? cash : card, day.between(1_400, 4_200)))
  }
  if (day.weekday === 5 && day.chance(0.5)) {
    items.push(expense(day.pick(['Kino Helios', 'Teatr Polski']), 'leisure', card, day.between(3_800, 9_000)))
  }
  if (day.chance(0.07)) items.push(expense('Bolt', 'transport', card, day.between(1_800, 4_500)))
  if (day.daysAgo === 118) {
    items.push(expense('Laptop — Media Expert', 'shopping', card, 429_900, { note: 'Nowy laptop do pracy' }))
  }
  if (day.daysAgo === 60) items.push(expense('Booking.com — hotel Barcelona', 'leisure', card, 42_000, { currency: 'EUR' }))
  if (day.daysAgo === 59) {
    items.push(expense('Ryanair', 'transport', card, 17_800, { currency: 'EUR', note: 'Kraków – Barcelona, 2 osoby' }))
  }
  if (day.daysAgo >= 45 && day.daysAgo <= 51) {
    items.push(expense('Mercadona', 'groceries', eur, day.between(1_500, 4_500)))
    items.push(expense(day.pick(['Tapas 24', 'Café de la Ópera', 'Bar Cañete']), 'cafes', eur, day.between(1_800, 5_500)))
    if (day.chance(0.5)) items.push(expense('Metro Barcelona', 'transport', eur, 1_135))
  }
  return items
}

function olehDay(day: Day): Planned[] {
  const card = 'acc_oleh_card'
  const cash = 'acc_oleh_cash'
  const items: Planned[] = []
  const date = day.dayOfMonth
  if (date === 1) items.push(expense('Проїзний на метро', 'transport', card, 130_000))
  if (date === 3) items.push(expense('Київстар', 'other', card, 25_000))
  if (date === 5) items.push(expense('Оренда квартири', 'housing', card, 1_400_000))
  if (date === 7) items.push(expense('Комунальні послуги', 'housing', card, day.between(180_000, 260_000)))
  if (date === 10) items.push(income('Зарплата', 'salary', card, 3_200_000))
  if (date === 12) items.push(expense('Netflix', 'subscriptions', card, 999, { currency: 'USD' }))
  if (date === 16) items.push(expense('iCloud', 'subscriptions', card, 299, { currency: 'USD' }))
  if (date === 18) items.push(expense('Аптека АНЦ', 'health', card, day.between(30_000, 90_000)))
  if (date === 21) items.push(expense('Rozetka', 'shopping', card, day.between(80_000, 300_000)))
  if (date === 25 && day.month % 3 === 0) {
    items.push(income('Фриланс — Upwork', 'freelance', card, 45_000, { currency: 'USD' }))
  }
  if (date === 28) items.push(income('Відсотки по депозиту', 'interest', 'acc_oleh_usd', day.between(250, 400)))
  if (day.weekday === 2 || day.weekday === 6) items.push(expense('Сільпо', 'groceries', card, day.between(60_000, 180_000)))
  if (day.weekday === 4) items.push(expense('АТБ', 'groceries', card, day.between(30_000, 90_000)))
  if (day.chance(0.1)) items.push(expense('Novus', 'groceries', cash, day.between(20_000, 60_000)))
  if (day.chance(0.3)) items.push(expense('Aroma Kava', 'cafes', cash, day.between(7_000, 16_000)))
  if (day.chance(0.1)) items.push(expense('Львівські круасани', 'cafes', card, day.between(15_000, 32_000)))
  if (day.chance(0.2)) items.push(expense('Uklon', 'transport', card, day.between(12_000, 35_000)))
  if (day.weekday === 6 && day.chance(0.4)) {
    const place = day.pick(['Multiplex', 'Планета Кіно', 'Концерт у Docker Pub'])
    items.push(expense(place, 'leisure', card, day.between(25_000, 60_000)))
  }
  if (day.daysAgo === 96) items.push(expense('Подарунок сестрі', 'gifts', card, 250_000, { note: 'День народження' }))
  return items
}

const planners = [
  { userId: 'usr_anna', short: 'anna', plan: annaDay },
  { userId: 'usr_oleh', short: 'oleh', plan: olehDay },
] as const

export function demoTransactions(
  today: string,
  accounts: readonly AccountRow[],
  rates: readonly RateRow[],
  settings: readonly SettingsRow[],
): TransactionRow[] {
  const rows: TransactionRow[] = []
  const counters = new Map<string, number>()
  for (let daysAgo = TRANSACTION_HISTORY_DAYS; daysAgo >= 0; daysAgo -= 1) {
    const date = addDaysIso(today, -daysAgo)
    for (const planner of planners) {
      const baseCurrency = settings.find((row) => row.userId === planner.userId)?.baseCurrency ?? 'PLN'
      for (const planned of planner.plan(dayOf(planner.userId, date, daysAgo))) {
        const account = accounts.find((row) => row.id === planned.account)
        if (!account) throw new Error(`Unknown seed account ${planned.account}`)
        const currency = planned.currency ?? account.currency
        const number = (counters.get(planner.short) ?? 0) + 1
        counters.set(planner.short, number)
        rows.push({
          id: `txn_seed_${planner.short}_${number}`,
          userId: planner.userId,
          kind: planned.kind,
          date,
          title: planned.title,
          note: planned.note ?? null,
          categoryId: `cat_${planner.short}_${planned.kind}_${planned.category}`,
          accountId: account.id,
          amount: planned.amount,
          currency,
          ...priceTransaction(rates, {
            date,
            amount: planned.amount,
            currency,
            accountCurrency: account.currency,
            baseCurrency,
          }),
        })
      }
    }
  }
  return rows
}

export const withTransactionHistory = (
  accounts: readonly AccountRow[],
  transactions: readonly TransactionRow[],
): AccountRow[] =>
  accounts.map((account) => ({
    ...account,
    openingBalance: transactions
      .filter((row) => row.accountId === account.id)
      .reduce(
        (opening, row) => opening - (row.kind === 'income' ? row.accountAmount : -row.accountAmount),
        account.openingBalance,
      ),
  }))
```

The amounts are tuned so that every opening balance stays non-negative for any seed day; if the guard test fails, lower the planned spending/income gap of the offending user (never the designed balances in `mocks/seed/accounts.ts`, which the accounts tests pin).

- [ ] **Step 4: Wire the seed**

Replace the body of `seedState` in `mocks/seed/index.ts` (add the imports of `demoTransactions` and `withTransactionHistory` from `./transactions`):

```ts
export const seedState = (today: string = todayIso()): MockState => {
  const rates = seedRates(today)
  const settings = demoSettings()
  const designed = demoAccounts()
  const transactions = demoTransactions(today, designed, rates, settings)
  return {
    version: 1,
    activeUserId: 'usr_anna',
    simulateErrors: false,
    users: demoUsers(),
    settings,
    rates,
    accounts: withTransactionHistory(designed, transactions),
    transfers: demoTransfers(today, designed, rates),
    categories: demoCategories(),
    transactions,
  }
}
```

- [ ] **Step 5: Update tests that assumed unused seeded categories**

In `tests/unit/mocks/categories.test.ts` replace the test `'never exposes userId'` with:

```ts
  it('never exposes userId and reports seeded usage', async () => {
    const [category] = (await list(api())).items
    expect(Object.keys(category ?? {}).sort()).toEqual(['color', 'id', 'inUse', 'kind', 'name', 'system'])
    expect(category).toMatchObject({ name: 'Spożywcze', inUse: true })
  })
```

In `tests/unit/mocks/categoryMutations.test.ts` replace the first two lines of the body of `'changes the kind of a user category only while it is unused'` (the seeded Sport category now has transactions) with:

```ts
    const mock = api()
    const created = (await create(mock, books)) as CategoryDto
    expect(await update(mock, created.id, { ...books, kind: 'income' })).toMatchObject({ kind: 'income' })
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun test tests/unit` → all pass.

- [ ] **Step 7: Lint, typecheck, commit**

Run: `bunx biome check --write mocks tests/unit/mocks && bun run lint && bun run typecheck 2>&1 | grep -c "error TS"` → lint clean, `0`.

```bash
git add mocks tests/unit/mocks
git commit -m "feat: six months of seeded transactions for both demo users"
```

---
### Task 3: Transaction data, pure helpers, rules, icons and translations

**Files:**
- Modify: `app/shared/api/invalidation.ts`, `app/shared/components/AppIcon.vue`, `app/shared/types/icon.ts`, `i18n/locales/{en,pl,ru,uk}.json`
- Create: `app/features/transactions/api/transactionsApi.ts`, `app/features/transactions/api/keys.ts`, `app/features/transactions/utils/{filters,group,csv,keypad,download}.ts`, `app/features/transactions/schemas/transactionSchema.ts`, `app/features/transactions/composables/{useTransactions,useTransactionMutations,useTransactionDialog,useTransactionExport}.ts`
- Test: `tests/unit/features/transactions/{filters,group,csv,keypad,schemas}.test.ts`

**Interfaces:**
- Consumes: contract types from Task 1; `useApi`, `invalidateAfter`, `useNotify`, `useCategories`, `useAccounts`, `periodFor`, `shiftPeriod`, `addDaysIso`, `todayIso`.
- Produces:
  - `DataChange` gains `'transactions'` → `[['transactions'], ['accounts'], ['categories'], ['budgets'], ['overview'], ['reports']]`
  - icons `download`, `search`, `filter`, `close`, `arrowUp`, `arrowDown`, `backspace`
  - `transactionsApi(api)`: `list(query & { page; pageSize })`, `get(id)`, `create(input)`, `update(id, input)`, `remove(id)`; `transactionKeys.all`, `transactionKeys.list(query)`
  - `utils/filters.ts`: `type KindFilter = CategoryKind | 'all'`, `periodPresets`, `type PeriodPreset`, `type TransactionFilters`, `defaultFilters()`, `isDefaultFilters(filters)`, `periodRange(preset, today, monthStart)`, `periodKeyOf(preset, today, monthStart)`, `toQuery(filters, sort, today, monthStart)`
  - `utils/group.ts`: `signedAmount`, `signedAccountAmount`, `signedBaseAmount`, `type DayGroup<T>`, `groupByDay(items, transactionOf)`
  - `utils/csv.ts`: `csvColumns`, `type CsvColumn`, `csvText`, `csvCell`, `toCsv`, `decimal`, `type CsvContext`, `transactionsCsv(items, context)`, `collectPages(fetchPage)`
  - `utils/keypad.ts`: `type KeypadKey`, `isDigit`, `MAX_INTEGER_DIGITS = 9`, `pressKey(entry, key)`, `entryToMinor(entry)`, `decimalSeparator(locale)`, `formatEntry(entry, locale, currency)`
  - `utils/download.ts`: `downloadText(fileName, content, type)`
  - schema: `TRANSACTION_TITLE_MAX = 100`, `TRANSACTION_NOTE_MAX = 200`, `type TransactionForm`, `isPositiveOrEmpty`, `notAfter`, `isPositiveMinor`, `transactionRules(t, { crossCurrency, maxDate })`, `quickAddRules(t)`
  - composables (auto-imported): `useTransactions(query, { enabled })` → `{ items, total, sum, currency, isPending, isError, isFetching, refetch, hasNextPage, isFetchingNextPage, fetchNextPage }`, `TRANSACTIONS_PAGE_SIZE = 20`; `useTransactionMutations()` → `{ create, update, remove }`; `useTransactionDialog()` → `{ state, openCreate(kind?), openEdit(transaction), close() }`; `useTransactionExport()` → `{ exporting, exportCsv(query) }`, `EXPORT_PAGE_SIZE = 100`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/features/transactions/filters.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import {
  defaultFilters,
  isDefaultFilters,
  periodKeyOf,
  periodRange,
  toQuery,
} from '../../../../app/features/transactions/utils/filters'

describe('transaction filters', () => {
  it('turns period presets into date ranges of financial periods', () => {
    expect(periodRange('thisPeriod', '2026-10-16', 1)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(periodRange('thisPeriod', '2026-10-05', 10)).toEqual({ from: '2026-09-10', to: '2026-10-09' })
    expect(periodRange('lastPeriod', '2026-01-03', 1)).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(periodRange('last3Months', '2026-10-16', 1)).toEqual({ from: '2026-08-01', to: '2026-10-31' })
    expect(periodRange('thisYear', '2026-10-16', 10)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(periodRange('all', '2026-10-16', 1)).toEqual({})
  })

  it('names the month of single-period presets only', () => {
    expect(periodKeyOf('thisPeriod', '2026-10-05', 10)).toBe('2026-09')
    expect(periodKeyOf('lastPeriod', '2026-10-16', 1)).toBe('2026-09')
    expect(periodKeyOf('all', '2026-10-16', 1)).toBeUndefined()
  })

  it('builds a query with only the active filters', () => {
    expect(toQuery(defaultFilters(), '-date', '2026-10-16', 1)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
      sort: '-date',
    })
    expect(
      toQuery(
        { search: '  lidl ', categoryId: 'cat_1', accountId: 'acc_1', kind: 'expense', period: 'all' },
        'amount',
        '2026-10-16',
        1,
      ),
    ).toEqual({ search: 'lidl', categoryId: 'cat_1', accountId: 'acc_1', kind: 'expense', sort: 'amount' })
  })

  it('knows when filters are untouched', () => {
    expect(isDefaultFilters(defaultFilters())).toBe(true)
    expect(isDefaultFilters({ ...defaultFilters(), search: '   ' })).toBe(true)
    expect(isDefaultFilters({ ...defaultFilters(), kind: 'income' })).toBe(false)
    expect(isDefaultFilters({ ...defaultFilters(), period: 'all' })).toBe(false)
  })
})
```

Create `tests/unit/features/transactions/group.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import {
  groupByDay,
  signedAccountAmount,
  signedAmount,
  signedBaseAmount,
} from '../../../../app/features/transactions/utils/group'
import type { TransactionDto } from '../../../../app/shared/api/contract'

const transaction = (id: string, date: string, kind: TransactionDto['kind'], baseAmount: number): TransactionDto => ({
  id,
  kind,
  date,
  title: id,
  note: null,
  categoryId: 'cat',
  accountId: 'acc',
  amount: baseAmount,
  currency: 'PLN',
  accountAmount: baseAmount,
  rate: 1,
  baseAmount,
})

describe('day grouping', () => {
  it('signs amounts by kind', () => {
    const expense = transaction('a', '2026-10-16', 'expense', 500)
    const income = transaction('b', '2026-10-16', 'income', 700)
    expect([signedAmount(expense), signedAccountAmount(expense), signedBaseAmount(expense)]).toEqual([-500, -500, -500])
    expect(signedBaseAmount(income)).toBe(700)
  })

  it('groups in order of first appearance with signed base sums', () => {
    const items = [
      transaction('a', '2026-10-16', 'expense', 8_640),
      transaction('b', '2026-10-16', 'expense', 9_200),
      transaction('c', '2026-10-10', 'income', 740_000),
      transaction('d', '2026-10-16', 'income', 1_000),
    ]
    const groups = groupByDay(items, (item) => item)
    expect(groups.map((group) => [group.date, group.items.map((item) => item.id), group.sum])).toEqual([
      ['2026-10-16', ['a', 'b', 'd'], -16_840],
      ['2026-10-10', ['c'], 740_000],
    ])
  })
})
```

Create `tests/unit/features/transactions/csv.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import {
  collectPages,
  csvCell,
  csvColumns,
  csvText,
  toCsv,
  transactionsCsv,
} from '../../../../app/features/transactions/utils/csv'
import type { TransactionDto } from '../../../../app/shared/api/contract'

const eurLunch: TransactionDto = {
  id: 'txn_1',
  kind: 'expense',
  date: '2026-10-14',
  title: 'Lunch, "Tapas"',
  note: '=SUM(A1)',
  categoryId: 'cat_cafes',
  accountId: 'acc_card',
  amount: 2_550,
  currency: 'EUR',
  accountAmount: 10_889,
  rate: 4.27,
  baseAmount: 10_889,
}

describe('csv', () => {
  it('quotes cells with separators, quotes or line breaks', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell(12.5)).toBe('12.5')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
  })

  it('neutralises spreadsheet formulas in text', () => {
    expect(csvText('=1+1')).toBe("'=1+1")
    expect(csvText('+48 600')).toBe("'+48 600")
    expect(csvText('-x')).toBe("'-x")
    expect(csvText('@me')).toBe("'@me")
    expect(csvText('Lidl')).toBe('Lidl')
  })

  it('joins rows with CRLF after a byte order mark', () => {
    expect(toCsv([['a', 1], ['b', 2]])).toBe('﻿a,1\r\nb,2\r\n')
  })

  it('writes one signed row per transaction with names and currencies', () => {
    const csv = transactionsCsv([eurLunch, { ...eurLunch, id: 'txn_2', kind: 'income', title: '', note: null }], {
      header: (column) => column.toUpperCase(),
      kind: (kind) => (kind === 'income' ? 'Income' : 'Expense'),
      categoryName: () => 'Cafes',
      account: () => ({ name: 'Main card', currency: 'PLN' }),
      baseCurrency: 'PLN',
    })
    expect(csv.slice(1).split('\r\n')).toEqual([
      csvColumns.map((column) => column.toUpperCase()).join(','),
      '2026-10-14,Expense,"Lunch, ""Tapas""",Cafes,Main card,-25.50,EUR,-108.89,PLN,4.27,-108.89,PLN,\'=SUM(A1)',
      '2026-10-14,Income,,Cafes,Main card,25.50,EUR,108.89,PLN,4.27,108.89,PLN,',
      '',
    ])
  })

  it('collects every page until the total is reached', async () => {
    const requested: number[] = []
    const pages = await collectPages(async (page) => {
      requested.push(page)
      return { items: page < 3 ? [page, page] : [page], page, pageSize: 2, total: 5 }
    })
    expect(requested).toEqual([1, 2, 3])
    expect(pages.flatMap((page) => page.items)).toEqual([1, 1, 2, 2, 3])
  })

  it('stops on an empty page', async () => {
    const pages = await collectPages(async (page) => ({ items: [], page, pageSize: 100, total: 0 }))
    expect(pages).toHaveLength(1)
  })
})
```

Create `tests/unit/features/transactions/keypad.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import {
  decimalSeparator,
  entryToMinor,
  formatEntry,
  type KeypadKey,
  pressKey,
} from '../../../../app/features/transactions/utils/keypad'

const type = (keys: KeypadKey[], start = '') => keys.reduce(pressKey, start)

describe('keypad', () => {
  it('types digits, one decimal separator and at most two fraction digits', () => {
    expect(type(['8', '6', 'decimal', '4', '0', '9'])).toBe('86.40')
    expect(type(['decimal', '5'])).toBe('0.5')
    expect(type(['1', 'decimal', 'decimal', '2'])).toBe('1.2')
  })

  it('replaces a leading zero and limits the whole part to nine digits', () => {
    expect(type(['0', '0', '7'])).toBe('7')
    expect(type(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'])).toBe('123456789')
  })

  it('erases the last character', () => {
    expect(type(['backspace'], '86.4')).toBe('86.')
    expect(type(['backspace', 'backspace'], '86.')).toBe('8')
    expect(type(['backspace'], '')).toBe('')
  })

  it('converts the entry to minor units', () => {
    expect(entryToMinor('')).toBe(0)
    expect(entryToMinor('0.')).toBe(0)
    expect(entryToMinor('86.4')).toBe(8_640)
    expect(entryToMinor('86.45')).toBe(8_645)
    expect(entryToMinor('7400')).toBe(740_000)
  })

  it('shows the entry with the locale separator inside the currency format', () => {
    expect(decimalSeparator('pl')).toBe(',')
    expect(decimalSeparator('en')).toBe('.')
    expect(formatEntry('86.4', 'pl', 'PLN').replace(/\s/g, ' ')).toBe('86,4 zł')
    expect(formatEntry('', 'en', 'EUR')).toBe('€0')
  })
})
```

Create `tests/unit/features/transactions/schemas.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import {
  isPositiveMinor,
  isPositiveOrEmpty,
  notAfter,
  quickAddRules,
  TRANSACTION_NOTE_MAX,
  TRANSACTION_TITLE_MAX,
  transactionRules,
} from '../../../../app/features/transactions/schemas/transactionSchema'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

const limit = new Date(2027, 9, 16)

describe('transaction form rules', () => {
  it('accepts positive amounts only', () => {
    expect(isPositiveOrEmpty(null)).toBe(true)
    expect(isPositiveOrEmpty(0.01)).toBe(true)
    expect(isPositiveOrEmpty(0)).toBe(false)
    expect(isPositiveMinor(1)).toBe(true)
    expect(isPositiveMinor(0)).toBe(false)
    expect(isPositiveMinor(1.5)).toBe(false)
  })

  it('limits the date', () => {
    expect(notAfter(() => limit)(new Date(2027, 9, 16))).toBe(true)
    expect(notAfter(() => limit)(new Date(2027, 9, 17))).toBe(false)
    expect(notAfter(() => limit)(null)).toBe(true)
  })

  it('requires a rate only for another currency', () => {
    let cross = false
    const rules = transactionRules((key) => key, { crossCurrency: () => cross, maxDate: () => limit })
    expect(validate(rules.rate.required, null)).toBe(true)
    cross = true
    expect(validate(rules.rate.required, null)).toBe(false)
    expect(validate(rules.rate.positive, -1)).toBe(false)
  })

  it('checks lengths and maps failures to translation keys', () => {
    const rules = transactionRules((key) => key, { crossCurrency: () => false, maxDate: () => limit })
    expect(validate(rules.title.maxLength, 'a'.repeat(TRANSACTION_TITLE_MAX))).toBe(true)
    expect(validate(rules.title.maxLength, 'a'.repeat(TRANSACTION_TITLE_MAX + 1))).toBe(false)
    expect(validate(rules.note.maxLength, 'a'.repeat(TRANSACTION_NOTE_MAX + 1))).toBe(false)
    expect(message(rules.amount.required)).toBe('validation.required')
    expect(message(rules.amount.positive)).toBe('validation.positiveAmount')
    expect(message(rules.date.notTooFar)).toBe('validation.dateTooFar')
    expect(message(rules.title.maxLength)).toBe('validation.titleTooLong')
    expect(message(rules.note.maxLength)).toBe('validation.noteTooLong')
    expect(message(rules.categoryId.required)).toBe('validation.required')
  })

  it('needs an amount, a category and an account on the quick add screen', () => {
    const rules = quickAddRules((key) => key)
    expect(validate(rules.amount.positive, 0)).toBe(false)
    expect(message(rules.amount.positive)).toBe('validation.positiveAmount')
    expect(validate(rules.categoryId.required, null)).toBe(false)
    expect(validate(rules.accountId.required, 'acc')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/unit/features/transactions`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Write the pure helpers**

Create `app/features/transactions/utils/filters.ts`:

```ts
import type { CategoryKind, TransactionQuery, TransactionSort } from '../../../shared/api/contract'
import { type MonthStart, periodFor, shiftPeriod } from '../../../shared/period/period'

export type KindFilter = CategoryKind | 'all'

export const periodPresets = ['thisPeriod', 'lastPeriod', 'last3Months', 'thisYear', 'all'] as const

export type PeriodPreset = (typeof periodPresets)[number]

export type TransactionFilters = {
  search: string
  categoryId: string | null
  accountId: string | null
  kind: KindFilter
  period: PeriodPreset
}

export const defaultFilters = (): TransactionFilters => ({
  search: '',
  categoryId: null,
  accountId: null,
  kind: 'all',
  period: 'thisPeriod',
})

export const isDefaultFilters = (filters: TransactionFilters): boolean =>
  filters.search.trim() === '' &&
  filters.categoryId === null &&
  filters.accountId === null &&
  filters.kind === 'all' &&
  filters.period === 'thisPeriod'

export function periodRange(preset: PeriodPreset, today: string, monthStart: MonthStart): { from?: string; to?: string } {
  const current = periodFor(today, monthStart)
  switch (preset) {
    case 'thisPeriod':
      return { from: current.from, to: current.to }
    case 'lastPeriod': {
      const last = shiftPeriod(current.key, -1, monthStart)
      return { from: last.from, to: last.to }
    }
    case 'last3Months':
      return { from: shiftPeriod(current.key, -2, monthStart).from, to: current.to }
    case 'thisYear':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` }
    case 'all':
      return {}
  }
}

export function periodKeyOf(preset: PeriodPreset, today: string, monthStart: MonthStart): string | undefined {
  const current = periodFor(today, monthStart)
  if (preset === 'thisPeriod') return current.key
  if (preset === 'lastPeriod') return shiftPeriod(current.key, -1, monthStart).key
  return undefined
}

export function toQuery(
  filters: TransactionFilters,
  sort: TransactionSort,
  today: string,
  monthStart: MonthStart,
): TransactionQuery {
  const search = filters.search.trim()
  return {
    ...(search ? { search } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.kind !== 'all' ? { kind: filters.kind } : {}),
    ...periodRange(filters.period, today, monthStart),
    sort,
  }
}
```

Create `app/features/transactions/utils/group.ts`:

```ts
import type { TransactionDto } from '../../../shared/api/contract'

type Signed = Pick<TransactionDto, 'kind'>

const sign = (transaction: Signed, amount: number): number => (transaction.kind === 'income' ? amount : -amount)

export const signedAmount = (transaction: Signed & Pick<TransactionDto, 'amount'>): number =>
  sign(transaction, transaction.amount)

export const signedAccountAmount = (transaction: Signed & Pick<TransactionDto, 'accountAmount'>): number =>
  sign(transaction, transaction.accountAmount)

export const signedBaseAmount = (transaction: Signed & Pick<TransactionDto, 'baseAmount'>): number =>
  sign(transaction, transaction.baseAmount)

export type DayGroup<T> = { date: string; items: T[]; sum: number }

export function groupByDay<T>(items: readonly T[], transactionOf: (item: T) => TransactionDto): DayGroup<T>[] {
  const groups = new Map<string, DayGroup<T>>()
  for (const item of items) {
    const transaction = transactionOf(item)
    const group = groups.get(transaction.date) ?? { date: transaction.date, items: [], sum: 0 }
    group.items.push(item)
    group.sum += signedBaseAmount(transaction)
    groups.set(transaction.date, group)
  }
  return [...groups.values()]
}
```

Create `app/features/transactions/utils/csv.ts`:

```ts
import type { CategoryKind, Page, TransactionDto } from '../../../shared/api/contract'
import type { Currency } from '../../../shared/money/money'
import { signedAccountAmount, signedAmount, signedBaseAmount } from './group'

export const csvColumns = [
  'date',
  'kind',
  'title',
  'category',
  'account',
  'amount',
  'currency',
  'accountAmount',
  'accountCurrency',
  'rate',
  'baseAmount',
  'baseCurrency',
  'note',
] as const

export type CsvColumn = (typeof csvColumns)[number]

export type CsvValue = string | number

export type CsvContext = {
  header: (column: CsvColumn) => string
  kind: (kind: CategoryKind) => string
  categoryName: (id: string) => string
  account: (id: string) => { name: string; currency: Currency } | undefined
  baseCurrency: Currency
}

const FORMULA_START = /^[=+\-@\t\r]/

export const csvText = (value: string): string => (FORMULA_START.test(value) ? `'${value}` : value)

export const csvCell = (value: CsvValue): string => {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export const toCsv = (rows: readonly (readonly CsvValue[])[]): string =>
  `﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`

export const decimal = (minor: number): string => (minor / 100).toFixed(2)

export function transactionsCsv(items: readonly TransactionDto[], context: CsvContext): string {
  return toCsv([
    csvColumns.map(context.header),
    ...items.map((item) => {
      const account = context.account(item.accountId)
      return [
        item.date,
        context.kind(item.kind),
        csvText(item.title),
        csvText(context.categoryName(item.categoryId)),
        csvText(account?.name ?? ''),
        decimal(signedAmount(item)),
        item.currency,
        decimal(signedAccountAmount(item)),
        account?.currency ?? '',
        item.rate,
        decimal(signedBaseAmount(item)),
        context.baseCurrency,
        csvText(item.note ?? ''),
      ]
    }),
  ])
}

type Paged = Pick<Page<unknown>, 'items' | 'page' | 'pageSize' | 'total'>

export async function collectPages<P extends Paged>(
  fetchPage: (page: number) => Promise<P>,
  page = 1,
  collected: readonly P[] = [],
): Promise<P[]> {
  const result = await fetchPage(page)
  const pages = [...collected, result]
  const done = result.items.length === 0 || result.page * result.pageSize >= result.total
  return done ? pages : collectPages(fetchPage, page + 1, pages)
}
```

Create `app/features/transactions/utils/keypad.ts`:

```ts
import type { Currency } from '../../../shared/money/money'

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

export type KeypadKey = Digit | 'decimal' | 'backspace'

export const MAX_INTEGER_DIGITS = 9

export const isDigit = (value: string): value is Digit => /^\d$/.test(value)

export function pressKey(entry: string, key: KeypadKey): string {
  if (key === 'backspace') return entry.slice(0, -1)
  if (key === 'decimal') return entry.includes('.') ? entry : `${entry || '0'}.`
  const [integer = '', fraction] = entry.split('.')
  if (fraction !== undefined) return fraction.length >= 2 ? entry : entry + key
  if (integer === '0') return key
  return integer.length >= MAX_INTEGER_DIGITS ? entry : entry + key
}

export function entryToMinor(entry: string): number {
  const [integer = '', fraction = ''] = entry.split('.')
  return Number(integer || '0') * 100 + Number(fraction.padEnd(2, '0').slice(0, 2))
}

export const decimalSeparator = (locale: string): string =>
  new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.'

const NUMBER_PARTS = new Set(['integer', 'group', 'decimal', 'fraction'])

export function formatEntry(entry: string, locale: string, currency: Currency): string {
  const digits = (entry || '0').replace('.', decimalSeparator(locale))
  let placed = false
  return new Intl.NumberFormat(locale, { style: 'currency', currency })
    .formatToParts(1)
    .map((part) => {
      if (!NUMBER_PARTS.has(part.type)) return part.value
      if (placed) return ''
      placed = true
      return digits
    })
    .join('')
}
```

`formatEntry` deliberately bypasses `n()`: it must show the digits exactly as typed (a trailing separator, one fraction digit), which a number formatter cannot do; it still takes the currency symbol and its position from the locale.

Create `app/features/transactions/utils/download.ts`:

```ts
export function downloadText(fileName: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
```

- [ ] **Step 4: Write the schema**

Create `app/features/transactions/schemas/transactionSchema.ts`:

```ts
import { helpers, maxLength, minValue, required, requiredIf } from '@vuelidate/validators'
import type { CategoryKind } from '../../../shared/api/contract'
import type { Currency } from '../../../shared/money/money'

export const TRANSACTION_TITLE_MAX = 100
export const TRANSACTION_NOTE_MAX = 200

export type TransactionForm = {
  kind: CategoryKind
  amount: number | null
  currency: Currency
  rate: number | null
  categoryId: string | null
  accountId: string | null
  date: Date | null
  title: string
  note: string
}

type Translate = (key: string) => string

export const isPositiveOrEmpty = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'number' && value > 0)

export const isPositiveMinor = (value: unknown): boolean =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

export const notAfter =
  (limit: () => Date) =>
  (value: unknown): boolean =>
    !(value instanceof Date) || value.getTime() <= limit().getTime()

export const transactionRules = (t: Translate, options: { crossCurrency: () => boolean; maxDate: () => Date }) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  return {
    kind: { required: requiredField },
    amount: {
      required: requiredField,
      positive: helpers.withMessage(() => t('validation.positiveAmount'), minValue(0.01)),
    },
    currency: { required: requiredField },
    rate: {
      required: helpers.withMessage(() => t('validation.required'), requiredIf(options.crossCurrency)),
      positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveOrEmpty),
    },
    categoryId: { required: requiredField },
    accountId: { required: requiredField },
    date: {
      required: requiredField,
      notTooFar: helpers.withMessage(() => t('validation.dateTooFar'), notAfter(options.maxDate)),
    },
    title: { maxLength: helpers.withMessage(() => t('validation.titleTooLong'), maxLength(TRANSACTION_TITLE_MAX)) },
    note: { maxLength: helpers.withMessage(() => t('validation.noteTooLong'), maxLength(TRANSACTION_NOTE_MAX)) },
  }
}

export const quickAddRules = (t: Translate) => {
  const requiredField = helpers.withMessage(() => t('validation.required'), required)
  return {
    amount: { positive: helpers.withMessage(() => t('validation.positiveAmount'), isPositiveMinor) },
    categoryId: { required: requiredField },
    accountId: { required: requiredField },
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test tests/unit/features/transactions` → all pass.

- [ ] **Step 6: Write the API module, keys and composables**

Create `app/features/transactions/api/transactionsApi.ts`:

```ts
import type { ApiClient } from '~/shared/api/client'
import type { TransactionDto, TransactionInput, TransactionPage, TransactionQuery } from '~/shared/api/contract'

const transactionPath = (id: string) => `/v1/transactions/${encodeURIComponent(id)}`

export const transactionsApi = (api: ApiClient) => ({
  list: (query: TransactionQuery & { page: number; pageSize: number }) =>
    api.get<TransactionPage>('/v1/transactions', query),
  get: (id: string) => api.get<TransactionDto>(transactionPath(id)),
  create: (body: TransactionInput) => api.post<TransactionDto>('/v1/transactions', body),
  update: (id: string, body: TransactionInput) => api.put<TransactionDto>(transactionPath(id), body),
  remove: (id: string) => api.delete(transactionPath(id)),
})
```

Create `app/features/transactions/api/keys.ts`:

```ts
import type { TransactionQuery } from '~/shared/api/contract'

export const transactionKeys = {
  all: ['transactions'],
  list: (query: TransactionQuery) => ['transactions', 'list', query] as const,
} as const
```

Create `app/features/transactions/composables/useTransactions.ts`:

```ts
import { keepPreviousData, useInfiniteQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { TransactionQuery } from '~/shared/api/contract'
import { transactionKeys } from '../api/keys'
import { transactionsApi } from '../api/transactionsApi'

export const TRANSACTIONS_PAGE_SIZE = 20

export function useTransactions(
  query: MaybeRefOrGetter<TransactionQuery>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const api = transactionsApi(useApi())
  const result = useInfiniteQuery({
    queryKey: computed(() => transactionKeys.list(toValue(query))),
    queryFn: ({ pageParam, queryKey }) =>
      api.list({ ...queryKey[2], page: pageParam, pageSize: TRANSACTIONS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled: computed(() => toValue(options.enabled ?? true)),
    placeholderData: keepPreviousData,
  })
  const first = computed(() => result.data.value?.pages[0])

  return {
    items: computed(() => result.data.value?.pages.flatMap((page) => page.items) ?? []),
    total: computed(() => first.value?.total),
    sum: computed(() => first.value?.sum),
    currency: computed(() => first.value?.currency),
    isPending: result.isPending,
    isError: result.isError,
    isFetching: result.isFetching,
    refetch: result.refetch,
    hasNextPage: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    fetchNextPage: () => result.fetchNextPage(),
  }
}
```

Create `app/features/transactions/composables/useTransactionMutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { TransactionInput } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { transactionsApi } from '../api/transactionsApi'

export function useTransactionMutations() {
  const api = transactionsApi(useApi())
  const queryClient = useQueryClient()
  const onSuccess = () => invalidateAfter(queryClient, 'transactions')

  return {
    create: useMutation({ mutationFn: api.create, onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: TransactionInput }) => api.update(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: api.remove, onSuccess }),
  }
}
```

Create `app/features/transactions/composables/useTransactionDialog.ts`:

```ts
import type { CategoryKind, TransactionDto } from '~/shared/api/contract'

type DialogState = { open: boolean; kind: CategoryKind; transaction?: TransactionDto }

export function useTransactionDialog() {
  const state = useState<DialogState>('transaction-dialog', () => ({ open: false, kind: 'expense' }))

  return {
    state,
    openCreate: (kind: CategoryKind = 'expense') => {
      state.value = { open: true, kind }
    },
    openEdit: (transaction: TransactionDto) => {
      state.value = { open: true, kind: transaction.kind, transaction }
    },
    close: () => {
      state.value = { ...state.value, open: false }
    },
  }
}
```

Create `app/features/transactions/composables/useTransactionExport.ts`:

```ts
import { useAccounts } from '~/shared/accounts/useAccounts'
import type { TransactionQuery } from '~/shared/api/contract'
import { useCategories } from '~/shared/categories/useCategories'
import { todayIso } from '~/shared/period/period'
import { transactionsApi } from '../api/transactionsApi'
import { collectPages, transactionsCsv } from '../utils/csv'
import { downloadText } from '../utils/download'

export const EXPORT_PAGE_SIZE = 100

export function useTransactionExport() {
  const api = transactionsApi(useApi())
  const { t } = useI18n()
  const notify = useNotify()
  const { nameOf } = useCategories()
  const { accounts } = useAccounts()
  const exporting = ref(false)

  async function exportCsv(query: TransactionQuery) {
    if (exporting.value) return
    exporting.value = true
    try {
      const pages = await collectPages((page) => api.list({ ...query, page, pageSize: EXPORT_PAGE_SIZE }))
      const items = pages.flatMap((page) => page.items)
      const byId = new Map(accounts.value.map((account) => [account.id, account]))
      const csv = transactionsCsv(items, {
        header: (column) => t(`transactions.csv.${column}`),
        kind: (kind) => t(`transactions.kindSingle.${kind}`),
        categoryName: (id) => nameOf(id) ?? '',
        account: (id) => byId.get(id),
        baseCurrency: pages[0]?.currency ?? 'PLN',
      })
      downloadText(`mita-transactions-${todayIso()}.csv`, csv, 'text/csv;charset=utf-8')
      notify.success(t('transactions.toast.exported', { count: items.length }, items.length))
    } catch (error) {
      notify.error(error)
    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportCsv }
}
```

In `app/shared/api/invalidation.ts` add `'transactions'` to `DataChange` and the entry:

```ts
  transactions: [['transactions'], ['accounts'], ['categories'], ['budgets'], ['overview'], ['reports']],
```

- [ ] **Step 7: Add the icons**

In `app/shared/types/icon.ts` append `| 'download' | 'search' | 'filter' | 'close' | 'arrowUp' | 'arrowDown' | 'backspace'`. In `app/shared/components/AppIcon.vue` add after the `trash` branch:

```vue
    <path v-else-if="name === 'download'" d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </template>
    <path v-else-if="name === 'filter'" d="M4 6h16M7 12h10M10 18h4" />
    <path v-else-if="name === 'close'" d="M6 6l12 12M18 6L6 18" />
    <path v-else-if="name === 'arrowUp'" d="M12 19V5M6 11l6-6 6 6" />
    <path v-else-if="name === 'arrowDown'" d="M12 5v14M6 13l6 6 6-6" />
    <path v-else-if="name === 'backspace'" d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM12 9l6 6M18 9l-6 6" />
```

- [ ] **Step 8: Add the translations**

In each locale file insert a `"transactions"` object between `"categories"` and `"validation"`, and add three keys at the end of `"validation"`. Keep the key order identical in all four files.

`en.json`:

```json
  "transactions": {
    "actions": {
      "add": "Add transaction",
      "addFirst": "Add your first transaction",
      "export": "Export CSV",
      "filters": "Filters",
      "resetFilters": "Reset filters",
      "apply": "Show results",
      "showMore": "Show more",
      "delete": "Delete"
    },
    "filters": {
      "label": "Filters",
      "search": "Search",
      "searchPlaceholder": "Title, note or amount",
      "category": "Category",
      "allCategories": "All categories",
      "account": "Account",
      "allAccounts": "All accounts",
      "kind": "Type",
      "period": "Period"
    },
    "kind": { "all": "All", "expense": "Expenses", "income": "Income" },
    "kindSingle": { "expense": "Expense", "income": "Income" },
    "period": {
      "thisPeriod": "This month",
      "lastPeriod": "Last month",
      "last3Months": "Last 3 months",
      "thisYear": "This year",
      "all": "All time"
    },
    "summary": {
      "label": "Filter summary",
      "found": "Found: {count}",
      "count": "{count} transaction | {count} transactions",
      "total": "Total: {amount}"
    },
    "table": {
      "label": "Transactions",
      "date": "Date",
      "description": "Description",
      "category": "Category",
      "account": "Account",
      "amount": "Amount"
    },
    "list": { "label": "Transactions by day" },
    "converted": "≈ {amount}",
    "day": { "today": "Today", "yesterday": "Yesterday" },
    "empty": {
      "title": "No transactions yet",
      "description": "Record income and expenses to see where your money goes.",
      "filteredTitle": "Nothing found",
      "filteredDescription": "No transactions match these filters."
    },
    "dialog": {
      "createTitle": "New transaction",
      "editTitle": "Edit transaction",
      "kind": "Type",
      "amount": "Amount",
      "currency": "Currency",
      "rate": "Exchange rate ({from} → {to})",
      "rateHint": "How many {to} equal 1 {from} on the selected date. You can correct it.",
      "accountAmount": "On the account: {amount}",
      "category": "Category",
      "account": "Account",
      "date": "Date",
      "title": "Description",
      "note": "Note",
      "noAccounts": "Add an account first to record transactions.",
      "goToAccounts": "Go to accounts"
    },
    "add": {
      "close": "Close",
      "amount": "Amount",
      "categories": "Category",
      "dateButton": "Date: {value}",
      "accountButton": "Account: {value}",
      "chooseDate": "Choose a date",
      "chooseAccount": "Choose an account",
      "keypad": "Keypad",
      "backspace": "Erase",
      "decimal": "Decimal separator"
    },
    "confirm": { "deleteTitle": "Delete transaction?", "deleteMessage": "“{title}” will be deleted permanently." },
    "toast": {
      "created": "Transaction saved",
      "updated": "Transaction updated",
      "deleted": "Transaction deleted",
      "exported": "Exported {count} transaction | Exported {count} transactions"
    },
    "csv": {
      "date": "Date",
      "kind": "Type",
      "title": "Description",
      "category": "Category",
      "account": "Account",
      "amount": "Amount",
      "currency": "Currency",
      "accountAmount": "Account amount",
      "accountCurrency": "Account currency",
      "rate": "Exchange rate",
      "baseAmount": "Amount in base currency",
      "baseCurrency": "Base currency",
      "note": "Note"
    }
  },
```

and in `"validation"`: `"titleTooLong": "Use at most 100 characters.", "unknownCategory": "This category is not available.", "categoryKindMismatch": "Choose a category of the same type."`

`pl.json`:

```json
  "transactions": {
    "actions": {
      "add": "Dodaj operację",
      "addFirst": "Dodaj pierwszą operację",
      "export": "Eksport CSV",
      "filters": "Filtry",
      "resetFilters": "Wyczyść filtry",
      "apply": "Pokaż wyniki",
      "showMore": "Pokaż więcej",
      "delete": "Usuń"
    },
    "filters": {
      "label": "Filtry",
      "search": "Szukaj",
      "searchPlaceholder": "Nazwa, notatka lub kwota",
      "category": "Kategoria",
      "allCategories": "Wszystkie kategorie",
      "account": "Konto",
      "allAccounts": "Wszystkie konta",
      "kind": "Typ",
      "period": "Okres"
    },
    "kind": { "all": "Wszystkie", "expense": "Wydatki", "income": "Przychody" },
    "kindSingle": { "expense": "Wydatek", "income": "Przychód" },
    "period": {
      "thisPeriod": "Ten miesiąc",
      "lastPeriod": "Poprzedni miesiąc",
      "last3Months": "Ostatnie 3 miesiące",
      "thisYear": "Ten rok",
      "all": "Cały okres"
    },
    "summary": {
      "label": "Podsumowanie filtra",
      "found": "Znaleziono: {count}",
      "count": "{count} operacja | {count} operacje | {count} operacji",
      "total": "Suma: {amount}"
    },
    "table": {
      "label": "Operacje",
      "date": "Data",
      "description": "Opis",
      "category": "Kategoria",
      "account": "Konto",
      "amount": "Kwota"
    },
    "list": { "label": "Operacje według dni" },
    "converted": "≈ {amount}",
    "day": { "today": "Dzisiaj", "yesterday": "Wczoraj" },
    "empty": {
      "title": "Brak operacji",
      "description": "Zapisuj przychody i wydatki, aby widzieć, na co idą pieniądze.",
      "filteredTitle": "Nic nie znaleziono",
      "filteredDescription": "Żadna operacja nie pasuje do filtrów."
    },
    "dialog": {
      "createTitle": "Nowa operacja",
      "editTitle": "Edycja operacji",
      "kind": "Typ",
      "amount": "Kwota",
      "currency": "Waluta",
      "rate": "Kurs wymiany ({from} → {to})",
      "rateHint": "Ile {to} to 1 {from} w wybranym dniu. Możesz go poprawić.",
      "accountAmount": "Na koncie: {amount}",
      "category": "Kategoria",
      "account": "Konto",
      "date": "Data",
      "title": "Opis",
      "note": "Notatka",
      "noAccounts": "Najpierw dodaj konto, aby zapisywać operacje.",
      "goToAccounts": "Przejdź do kont"
    },
    "add": {
      "close": "Zamknij",
      "amount": "Kwota",
      "categories": "Kategoria",
      "dateButton": "Data: {value}",
      "accountButton": "Konto: {value}",
      "chooseDate": "Wybierz datę",
      "chooseAccount": "Wybierz konto",
      "keypad": "Klawiatura",
      "backspace": "Usuń znak",
      "decimal": "Separator dziesiętny"
    },
    "confirm": { "deleteTitle": "Usunąć operację?", "deleteMessage": "„{title}” zostanie usunięta na stałe." },
    "toast": {
      "created": "Operacja zapisana",
      "updated": "Operacja zaktualizowana",
      "deleted": "Operacja usunięta",
      "exported": "Wyeksportowano {count} operację | Wyeksportowano {count} operacje | Wyeksportowano {count} operacji"
    },
    "csv": {
      "date": "Data",
      "kind": "Typ",
      "title": "Opis",
      "category": "Kategoria",
      "account": "Konto",
      "amount": "Kwota",
      "currency": "Waluta",
      "accountAmount": "Kwota na koncie",
      "accountCurrency": "Waluta konta",
      "rate": "Kurs wymiany",
      "baseAmount": "Kwota w walucie bazowej",
      "baseCurrency": "Waluta bazowa",
      "note": "Notatka"
    }
  },
```

and in `"validation"`: `"titleTooLong"` — the same phrasing as the existing Polish `nameTooLong` with 100 instead of 40, `"unknownCategory": "Ta kategoria jest niedostępna.", "categoryKindMismatch": "Wybierz kategorię tego samego typu."`

`ru.json`:

```json
  "transactions": {
    "actions": {
      "add": "Добавить операцию",
      "addFirst": "Добавить первую операцию",
      "export": "Экспорт CSV",
      "filters": "Фильтры",
      "resetFilters": "Сбросить фильтры",
      "apply": "Показать результаты",
      "showMore": "Показать ещё",
      "delete": "Удалить"
    },
    "filters": {
      "label": "Фильтры",
      "search": "Поиск",
      "searchPlaceholder": "Название, заметка или сумма",
      "category": "Категория",
      "allCategories": "Все категории",
      "account": "Счёт",
      "allAccounts": "Все счета",
      "kind": "Тип",
      "period": "Период"
    },
    "kind": { "all": "Все", "expense": "Расходы", "income": "Доходы" },
    "kindSingle": { "expense": "Расход", "income": "Доход" },
    "period": {
      "thisPeriod": "Этот месяц",
      "lastPeriod": "Прошлый месяц",
      "last3Months": "Последние 3 месяца",
      "thisYear": "Этот год",
      "all": "Всё время"
    },
    "summary": {
      "label": "Итоги фильтра",
      "found": "Найдено: {count}",
      "count": "{count} операция | {count} операции | {count} операций",
      "total": "Сумма: {amount}"
    },
    "table": {
      "label": "Операции",
      "date": "Дата",
      "description": "Описание",
      "category": "Категория",
      "account": "Счёт",
      "amount": "Сумма"
    },
    "list": { "label": "Операции по дням" },
    "converted": "≈ {amount}",
    "day": { "today": "Сегодня", "yesterday": "Вчера" },
    "empty": {
      "title": "Операций пока нет",
      "description": "Записывайте доходы и расходы, чтобы видеть, куда уходят деньги.",
      "filteredTitle": "Ничего не найдено",
      "filteredDescription": "Нет операций, подходящих под фильтры."
    },
    "dialog": {
      "createTitle": "Новая операция",
      "editTitle": "Редактирование операции",
      "kind": "Тип",
      "amount": "Сумма",
      "currency": "Валюта",
      "rate": "Курс ({from} → {to})",
      "rateHint": "Сколько {to} стоит 1 {from} на выбранную дату. Курс можно исправить.",
      "accountAmount": "На счёте: {amount}",
      "category": "Категория",
      "account": "Счёт",
      "date": "Дата",
      "title": "Описание",
      "note": "Заметка",
      "noAccounts": "Сначала добавьте счёт, чтобы записывать операции.",
      "goToAccounts": "Перейти к счетам"
    },
    "add": {
      "close": "Закрыть",
      "amount": "Сумма",
      "categories": "Категория",
      "dateButton": "Дата: {value}",
      "accountButton": "Счёт: {value}",
      "chooseDate": "Выберите дату",
      "chooseAccount": "Выберите счёт",
      "keypad": "Клавиатура",
      "backspace": "Стереть",
      "decimal": "Десятичный разделитель"
    },
    "confirm": { "deleteTitle": "Удалить операцию?", "deleteMessage": "«{title}» будет удалена навсегда." },
    "toast": {
      "created": "Операция сохранена",
      "updated": "Операция обновлена",
      "deleted": "Операция удалена",
      "exported": "Экспортирована {count} операция | Экспортированы {count} операции | Экспортировано {count} операций"
    },
    "csv": {
      "date": "Дата",
      "kind": "Тип",
      "title": "Описание",
      "category": "Категория",
      "account": "Счёт",
      "amount": "Сумма",
      "currency": "Валюта",
      "accountAmount": "Сумма на счёте",
      "accountCurrency": "Валюта счёта",
      "rate": "Курс",
      "baseAmount": "Сумма в базовой валюте",
      "baseCurrency": "Базовая валюта",
      "note": "Заметка"
    }
  },
```

and in `"validation"`: `"titleTooLong": "Не больше 100 символов.", "unknownCategory": "Эта категория недоступна.", "categoryKindMismatch": "Выберите категорию того же типа."`

`uk.json`:

```json
  "transactions": {
    "actions": {
      "add": "Додати операцію",
      "addFirst": "Додати першу операцію",
      "export": "Експорт CSV",
      "filters": "Фільтри",
      "resetFilters": "Скинути фільтри",
      "apply": "Показати результати",
      "showMore": "Показати ще",
      "delete": "Видалити"
    },
    "filters": {
      "label": "Фільтри",
      "search": "Пошук",
      "searchPlaceholder": "Назва, нотатка або сума",
      "category": "Категорія",
      "allCategories": "Усі категорії",
      "account": "Рахунок",
      "allAccounts": "Усі рахунки",
      "kind": "Тип",
      "period": "Період"
    },
    "kind": { "all": "Усі", "expense": "Витрати", "income": "Доходи" },
    "kindSingle": { "expense": "Витрата", "income": "Дохід" },
    "period": {
      "thisPeriod": "Цей місяць",
      "lastPeriod": "Минулий місяць",
      "last3Months": "Останні 3 місяці",
      "thisYear": "Цей рік",
      "all": "Увесь час"
    },
    "summary": {
      "label": "Підсумки фільтра",
      "found": "Знайдено: {count}",
      "count": "{count} операція | {count} операції | {count} операцій",
      "total": "Сума: {amount}"
    },
    "table": {
      "label": "Операції",
      "date": "Дата",
      "description": "Опис",
      "category": "Категорія",
      "account": "Рахунок",
      "amount": "Сума"
    },
    "list": { "label": "Операції за днями" },
    "converted": "≈ {amount}",
    "day": { "today": "Сьогодні", "yesterday": "Учора" },
    "empty": {
      "title": "Операцій поки немає",
      "description": "Записуйте доходи й витрати, щоб бачити, куди йдуть гроші.",
      "filteredTitle": "Нічого не знайдено",
      "filteredDescription": "Немає операцій, що відповідають фільтрам."
    },
    "dialog": {
      "createTitle": "Нова операція",
      "editTitle": "Редагування операції",
      "kind": "Тип",
      "amount": "Сума",
      "currency": "Валюта",
      "rate": "Курс ({from} → {to})",
      "rateHint": "Скільки {to} коштує 1 {from} на вибрану дату. Курс можна виправити.",
      "accountAmount": "На рахунку: {amount}",
      "category": "Категорія",
      "account": "Рахунок",
      "date": "Дата",
      "title": "Опис",
      "note": "Нотатка",
      "noAccounts": "Спершу додайте рахунок, щоб записувати операції.",
      "goToAccounts": "Перейти до рахунків"
    },
    "add": {
      "close": "Закрити",
      "amount": "Сума",
      "categories": "Категорія",
      "dateButton": "Дата: {value}",
      "accountButton": "Рахунок: {value}",
      "chooseDate": "Виберіть дату",
      "chooseAccount": "Виберіть рахунок",
      "keypad": "Клавіатура",
      "backspace": "Стерти",
      "decimal": "Десятковий роздільник"
    },
    "confirm": { "deleteTitle": "Видалити операцію?", "deleteMessage": "«{title}» буде видалено назавжди." },
    "toast": {
      "created": "Операцію збережено",
      "updated": "Операцію оновлено",
      "deleted": "Операцію видалено",
      "exported": "Експортовано {count} операцію | Експортовано {count} операції | Експортовано {count} операцій"
    },
    "csv": {
      "date": "Дата",
      "kind": "Тип",
      "title": "Опис",
      "category": "Категорія",
      "account": "Рахунок",
      "amount": "Сума",
      "currency": "Валюта",
      "accountAmount": "Сума на рахунку",
      "accountCurrency": "Валюта рахунку",
      "rate": "Курс",
      "baseAmount": "Сума в базовій валюті",
      "baseCurrency": "Базова валюта",
      "note": "Нотатка"
    }
  },
```

and in `"validation"`: `"titleTooLong"` — the same phrasing as the existing Ukrainian `nameTooLong` with 100 instead of 40, `"unknownCategory": "Ця категорія недоступна.", "categoryKindMismatch": "Виберіть категорію того самого типу."`

- [ ] **Step 9: Run all unit tests**

Run: `bun test tests/unit` → all pass (including the locale parity test).

- [ ] **Step 10: Lint, typecheck, commit**

Run: `bunx biome check --write app/features/transactions app/shared i18n tests/unit/features/transactions && bun run lint && bun run typecheck 2>&1 | grep -c "error TS"` → lint clean, `0`.

```bash
git add app/features/transactions app/shared i18n tests/unit/features/transactions
git commit -m "feat: transaction data, filters, csv and keypad helpers and translations"
```

---
### Task 4: Add/edit dialog opened from the sidebar

**Files:**
- Create: `app/features/transactions/components/TransactionDialog.vue`, `tests/e2e/transactionDialog.spec.ts`
- Modify: `app/layouts/default.vue`, `app/shared/components/AppSidebar.vue`

**Interfaces:**
- Consumes: `useTransactionDialog`, `useTransactionMutations`, `transactionRules`, `TransactionForm` (Task 3); `useAccounts`, `useCategories`, `useRates`, `categorySwatchClass`, `useNotify`, `useServerErrors`, `focusFirstInvalid`, `FormRow`.
- Produces: `<TransactionDialog v-model:visible :transaction? :initial-kind?>` (create when `transaction` is absent, edit + delete otherwise); `AppSidebar` emits `addTransaction`; the default layout mounts the dialog lazily (first open) and binds it to `useTransactionDialog()`.

Behaviour: kind (SelectButton), amount + currency on one row, account (active accounts plus the edited transaction's own archived account), exchange rate shown only when the currency differs from the account currency (label with direction, prefilled for the date, editable, "On the account: …" preview), category (pickable categories of the kind with a colour swatch; switching kind picks the first category of the new kind), date (at most one year ahead), description, note. In create mode the account defaults to the first active account and the currency follows the account until the user picks a currency. In edit mode the stored rate is kept until the currency or the account currency changes.

- [ ] **Step 1: Write the failing E2E test**

Create `tests/e2e/transactionDialog.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test'

test.skip(({ isMobile }) => isMobile, 'the sidebar button exists on desktop only')

const card = (page: Page, name: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) })

const openDialog = async (page: Page) => {
  await page.getByRole('button', { name: 'New transaction' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await expect(dialog).toBeVisible()
  return dialog
}

test('a EUR expense from a PLN card lowers the card balance by the converted amount', async ({ page }) => {
  await page.goto('/accounts')
  await expect(card(page, 'Konto główne')).toContainText('PLN 8,820.40')
  const dialog = await openDialog(page)
  await expect(dialog.getByRole('combobox', { name: 'Account' })).toContainText('Konto główne · PLN')
  await dialog.getByLabel('Amount').pressSequentially('50')
  await dialog.getByRole('combobox', { name: 'Currency' }).click()
  await page.getByRole('option', { name: 'EUR', exact: true }).click()
  const rate = dialog.getByLabel('Exchange rate (EUR → PLN)')
  await expect(rate).toHaveValue(/^4\.\d+$/)
  await expect(dialog.getByText('How many PLN equal 1 EUR on the selected date.')).toBeVisible()
  await rate.fill('')
  await rate.pressSequentially('4')
  await expect(dialog.getByText('On the account: PLN 200.00')).toBeVisible()
  await dialog.getByLabel('Description').fill('Książki')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Transaction saved')).toBeVisible()
  await expect(card(page, 'Konto główne')).toContainText('PLN 8,620.40')
})

test('validates the amount before saving and focuses it', async ({ page }) => {
  await page.goto('/accounts')
  const dialog = await openDialog(page)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('This field is required.')).toBeVisible()
  await expect(dialog.getByLabel('Amount')).toBeFocused()
})

test('income offers income categories only', async ({ page }) => {
  await page.goto('/accounts')
  const dialog = await openDialog(page)
  const category = dialog.getByRole('combobox', { name: 'Category' })
  await expect(category).toContainText('Spożywcze')
  await dialog.getByRole('button', { name: 'Income', exact: true }).click()
  await expect(category).toContainText('Wynagrodzenie')
  await category.click()
  await expect(page.getByRole('option', { name: 'Premia' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Spożywcze' })).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'Przelewy' })).toHaveCount(0)
})
```

- [ ] **Step 2: Run the E2E test to verify it fails**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/scripts/tx-e2e.sh tests/e2e/transactionDialog.spec.ts`
Expected: FAIL — no "New transaction" button.

- [ ] **Step 3: Write the dialog**

Create `app/features/transactions/components/TransactionDialog.vue`:

```vue
<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { InputNumberInputEvent } from 'primevue/inputnumber'
import { useAccounts } from '~/shared/accounts/useAccounts'
import { type CategoryKind, categoryKinds, type TransactionDto, type TransactionInput } from '~/shared/api/contract'
import { categorySwatchClass } from '~/shared/categories/colors'
import { useCategories } from '~/shared/categories/useCategories'
import { convertMinor, currencies, fromMinor, toMinor } from '~/shared/money/money'
import { addDaysIso, fromLocalDate, todayIso, toLocalDate } from '~/shared/period/period'
import { useRates } from '~/shared/rates/useRates'
import { type TransactionForm, transactionRules } from '../schemas/transactionSchema'

const props = defineProps<{ transaction?: TransactionDto; initialKind?: CategoryKind }>()
const visible = defineModel<boolean>('visible', { required: true })
const { t, locale } = useI18n()
const { format } = useMoney()
const notify = useNotify()
const confirm = useConfirm()
const server = useServerErrors()
const { accounts, activeAccounts, isPending: accountsPending } = useAccounts()
const { pickable, nameOf } = useCategories()
const { create, update, remove } = useTransactionMutations()

const fields = ['kind', 'amount', 'currency', 'rate', 'categoryId', 'accountId', 'date', 'title', 'note'] as const
type Field = (typeof fields)[number]

const form = reactive<TransactionForm>({
  kind: 'expense',
  amount: null,
  currency: 'PLN',
  rate: null,
  categoryId: null,
  accountId: null,
  date: toLocalDate(todayIso()),
  title: '',
  note: '',
})
const formEl = ref<HTMLFormElement | null>(null)
const rateEdited = ref(false)
const currencyEdited = ref(false)
let syncing = false

const isEdit = computed(() => props.transaction !== undefined)
const saving = computed(() => create.isPending.value || update.isPending.value || remove.isPending.value)
const account = computed(() => accounts.value.find((row) => row.id === form.accountId))
const crossCurrency = computed(() => account.value !== undefined && account.value.currency !== form.currency)
const maxDate = computed(() => toLocalDate(addDaysIso(todayIso(), 365)))
const noAccounts = computed(() => !isEdit.value && !accountsPending.value && activeAccounts.value.length === 0)

const v$ = useVuelidate(
  transactionRules(t, { crossCurrency: () => crossCurrency.value, maxDate: () => maxDate.value }),
  form,
)

const rateDate = computed(() => (form.date ? fromLocalDate(form.date) : todayIso()))
const rates = useRates(() => account.value?.currency ?? 'PLN', { date: rateDate, enabled: crossCurrency })
const suggestedRate = computed(() => (crossCurrency.value ? rates.rateFrom(form.currency) : undefined))

const kindOptions = computed(() =>
  categoryKinds.map((kind) => ({ value: kind, label: t(`transactions.kindSingle.${kind}`) })),
)
const categoryOptions = computed(() => pickable(form.kind))
const accountOptions = computed(() => {
  const own = props.transaction ? accounts.value.find((row) => row.id === props.transaction?.accountId) : undefined
  const list = own?.archived ? [...activeAccounts.value, own] : activeAccounts.value
  return list.map((row) => ({ value: row.id, label: `${row.name} · ${row.currency}` }))
})
const rateCurrencies = computed(() => ({ from: form.currency, to: account.value?.currency ?? '' }))
const accountAmountText = computed(() => {
  const target = account.value
  if (!crossCurrency.value || !target || form.amount === null || form.amount <= 0) return undefined
  if (form.rate === null || form.rate <= 0) return undefined
  return t('transactions.dialog.accountAmount', {
    amount: format(convertMinor(toMinor(form.amount), form.rate), target.currency),
  })
})

watch(suggestedRate, (rate) => {
  if (!syncing && rate !== undefined && !rateEdited.value) form.rate = rate
})

watch([() => form.currency, () => account.value?.currency], () => {
  if (syncing) return
  rateEdited.value = false
  form.rate = suggestedRate.value ?? null
})

watch(
  () => form.accountId,
  () => {
    if (!syncing && !currencyEdited.value && account.value) form.currency = account.value.currency
  },
)

watch(categoryOptions, (options) => {
  if (!syncing && visible.value && !options.some((category) => category.id === form.categoryId)) {
    form.categoryId = options[0]?.id ?? null
  }
})

watch(activeAccounts, (list) => {
  const first = list[0]
  if (!syncing && visible.value && !isEdit.value && form.accountId === null && first) {
    form.accountId = first.id
    form.currency = first.currency
  }
})

async function reset() {
  syncing = true
  const transaction = props.transaction
  const kind = transaction?.kind ?? props.initialKind ?? 'expense'
  const first = activeAccounts.value[0]
  Object.assign(
    form,
    transaction
      ? {
          kind,
          amount: fromMinor(transaction.amount),
          currency: transaction.currency,
          rate: transaction.rate,
          categoryId: transaction.categoryId,
          accountId: transaction.accountId,
          date: toLocalDate(transaction.date),
          title: transaction.title,
          note: transaction.note ?? '',
        }
      : {
          kind,
          amount: null,
          currency: first?.currency ?? 'PLN',
          rate: null,
          categoryId: pickable(kind)[0]?.id ?? null,
          accountId: first?.id ?? null,
          date: toLocalDate(todayIso()),
          title: '',
          note: '',
        },
  )
  rateEdited.value = transaction !== undefined
  currencyEdited.value = transaction !== undefined && transaction.currency !== account.value?.currency
  server.clear()
  v$.value.$reset()
  await nextTick()
  syncing = false
  if (!transaction) form.rate = suggestedRate.value ?? null
}

watch(
  visible,
  (open) => {
    if (open) reset()
  },
  { immediate: true },
)

const errorsOf = (field: Field) => [
  ...v$.value[field].$errors.map((error) => String(unref(error.$message))),
  ...server.messages(field),
]

function touch(field: Field) {
  v$.value[field].$touch()
  server.clear(field)
}

const numberOrNull = (value: unknown) => (typeof value === 'number' ? value : null)

function onAmountInput(event: InputNumberInputEvent) {
  form.amount = numberOrNull(event.value)
}

function onRateInput(event: InputNumberInputEvent) {
  rateEdited.value = true
  form.rate = numberOrNull(event.value)
}

function onCurrencyChange() {
  currencyEdited.value = true
  touch('currency')
}

const close = (message: string) => {
  notify.success(message)
  visible.value = false
}

async function showServerErrors(error: unknown) {
  if (server.apply(error, fields)) {
    await nextTick()
    focusFirstInvalid(formEl.value)
  } else notify.error(error)
}

async function submit() {
  server.clear()
  if (!(await v$.value.$validate())) {
    await nextTick()
    focusFirstInvalid(formEl.value)
    return
  }
  const note = form.note.trim()
  const input: TransactionInput = {
    kind: form.kind,
    date: fromLocalDate(form.date as Date),
    title: form.title.trim(),
    categoryId: form.categoryId as string,
    accountId: form.accountId as string,
    amount: toMinor(form.amount ?? 0),
    currency: form.currency,
    ...(crossCurrency.value && form.rate !== null ? { rate: form.rate } : {}),
    ...(note ? { note } : {}),
  }
  const transaction = props.transaction
  if (transaction) {
    update.mutate(
      { id: transaction.id, input },
      { onSuccess: () => close(t('transactions.toast.updated')), onError: showServerErrors },
    )
  } else {
    create.mutate(input, { onSuccess: () => close(t('transactions.toast.created')), onError: showServerErrors })
  }
}

function confirmDelete() {
  const transaction = props.transaction
  if (!transaction) return
  confirm.require({
    header: t('transactions.confirm.deleteTitle'),
    message: t('transactions.confirm.deleteMessage', {
      title: transaction.title || (nameOf(transaction.categoryId) ?? ''),
    }),
    acceptLabel: t('transactions.actions.delete'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      remove.mutate(transaction.id, {
        onSuccess: () => close(t('transactions.toast.deleted')),
        onError: (error) => notify.error(error),
      }),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="isEdit ? t('transactions.dialog.editTitle') : t('transactions.dialog.createTitle')"
    class="w-[calc(100vw-2rem)] max-w-[32rem]"
  >
    <div v-if="noAccounts" class="flex flex-col items-start gap-3">
      <p class="m-0 text-sm text-muted">{{ t('transactions.dialog.noAccounts') }}</p>
      <NuxtLinkLocale to="/accounts" class="text-sm font-semibold text-accent" @click="visible = false">
        {{ t('transactions.dialog.goToAccounts') }}
      </NuxtLinkLocale>
    </div>
    <form v-else id="transaction-form" ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormRow id="transaction-kind" :label="t('transactions.dialog.kind')" :errors="errorsOf('kind')">
        <template #default="{ labelId }">
          <SelectButton
            id="transaction-kind"
            v-model="form.kind"
            :options="kindOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            :aria-labelledby="labelId"
          />
        </template>
      </FormRow>
      <div class="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
        <FormRow id="transaction-amount" :label="t('transactions.dialog.amount')" :errors="errorsOf('amount')">
          <template #default="{ invalid, describedBy }">
            <InputNumber
              v-model="form.amount"
              input-id="transaction-amount"
              mode="currency"
              :currency="form.currency"
              :locale="locale"
              :min-fraction-digits="2"
              :max-fraction-digits="2"
              :min="0"
              :invalid="invalid"
              :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
              fluid
              @input="onAmountInput"
              @blur="touch('amount')"
            />
          </template>
        </FormRow>
        <FormRow id="transaction-currency" :label="t('transactions.dialog.currency')" :errors="errorsOf('currency')">
          <template #default="{ invalid, describedBy, labelId }">
            <Select
              v-model="form.currency"
              input-id="transaction-currency"
              :options="[...currencies]"
              :invalid="invalid"
              :aria-labelledby="labelId"
              :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
              fluid
              @change="onCurrencyChange"
            />
          </template>
        </FormRow>
      </div>
      <FormRow id="transaction-account" :label="t('transactions.dialog.account')" :errors="errorsOf('accountId')">
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.accountId"
            input-id="transaction-account"
            :options="accountOptions"
            option-label="label"
            option-value="value"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            fluid
            @change="touch('accountId')"
          />
        </template>
      </FormRow>
      <FormRow
        v-if="crossCurrency"
        id="transaction-rate"
        :label="t('transactions.dialog.rate', rateCurrencies)"
        :errors="errorsOf('rate')"
        :hint="t('transactions.dialog.rateHint', rateCurrencies)"
      >
        <template #default="{ invalid, describedBy }">
          <InputNumber
            v-model="form.rate"
            input-id="transaction-rate"
            :locale="locale"
            :min-fraction-digits="2"
            :max-fraction-digits="6"
            :min="0"
            :invalid="invalid"
            :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
            fluid
            @input="onRateInput"
            @blur="touch('rate')"
          />
        </template>
      </FormRow>
      <p v-if="accountAmountText" class="m-0 font-mono text-sm text-muted" aria-live="polite">
        {{ accountAmountText }}
      </p>
      <FormRow id="transaction-category" :label="t('transactions.dialog.category')" :errors="errorsOf('categoryId')">
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.categoryId"
            input-id="transaction-category"
            :options="categoryOptions"
            option-label="name"
            option-value="id"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            fluid
            @change="touch('categoryId')"
          >
            <template #option="{ option }">
              <span class="flex items-center gap-2">
                <span class="size-2.5 rounded-full" :class="categorySwatchClass(option.color)" aria-hidden="true" />
                {{ option.name }}
              </span>
            </template>
          </Select>
        </template>
      </FormRow>
      <FormRow id="transaction-date" :label="t('transactions.dialog.date')" :errors="errorsOf('date')">
        <template #default="{ invalid, describedBy }">
          <DatePicker
            v-model="form.date"
            input-id="transaction-date"
            :date-format="t('shared.dateInputFormat')"
            :max-date="maxDate"
            :invalid="invalid"
            :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
            show-icon
            fluid
            @blur="touch('date')"
          />
        </template>
      </FormRow>
      <FormRow id="transaction-title" :label="t('transactions.dialog.title')" :errors="errorsOf('title')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="transaction-title"
            v-model="form.title"
            autocomplete="off"
            :invalid="invalid"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            fluid
            @blur="touch('title')"
          />
        </template>
      </FormRow>
      <FormRow id="transaction-note" :label="t('transactions.dialog.note')" :errors="errorsOf('note')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="transaction-note"
            v-model="form.note"
            autocomplete="off"
            :invalid="invalid"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            fluid
            @blur="touch('note')"
          />
        </template>
      </FormRow>
    </form>
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <div class="flex gap-2">
          <Button
            v-if="isEdit"
            :label="t('transactions.actions.delete')"
            severity="danger"
            text
            :disabled="saving"
            @click="confirmDelete"
          />
        </div>
        <div class="flex gap-2">
          <Button :label="t('shared.actions.cancel')" severity="secondary" outlined @click="visible = false" />
          <Button
            type="submit"
            form="transaction-form"
            :label="t('shared.actions.save')"
            :loading="saving"
            :disabled="saving || noAccounts"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>
```

- [ ] **Step 4: Mount the dialog in the layout and add the sidebar button**

Replace `app/layouts/default.vue`:

```vue
<script setup lang="ts">
const dialog = useTransactionDialog()
const mounted = ref(false)
const open = computed({
  get: () => dialog.state.value.open,
  set: (value: boolean) => {
    if (!value) dialog.close()
  },
})

watch(
  open,
  (value) => {
    if (value) mounted.value = true
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-h-dvh bg-bg">
    <AppSidebar @add-transaction="dialog.openCreate()" />
    <main class="flex min-w-0 max-w-310 flex-1 flex-col gap-6 px-5 pt-14 pb-28 lg:px-8 lg:pt-7 lg:pb-12">
      <slot />
    </main>
    <AppBottomNav />
    <TransactionDialog
      v-if="mounted"
      v-model:visible="open"
      :transaction="dialog.state.value.transaction"
      :initial-kind="dialog.state.value.kind"
    />
  </div>
</template>
```

In `app/shared/components/AppSidebar.vue` add `const emit = defineEmits<{ addTransaction: [] }>()` to the script and, right after the logo link in the template:

```vue
    <Button class="min-h-11 w-full justify-center" @click="emit('addTransaction')">
      <AppIcon name="plus" :size="16" :stroke-width="2.2" />
      {{ t('navigation.addTransaction') }}
    </Button>
```

- [ ] **Step 5: Run the E2E tests to verify they pass**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/scripts/tx-e2e.sh tests/e2e/transactionDialog.spec.ts tests/e2e/accounts.spec.ts tests/e2e/navigation.spec.ts`
Expected: PASS (dialog tests on `desktop`, skipped on `mobile`; accounts and navigation unchanged).

- [ ] **Step 6: Lint, typecheck, commit**

Run: `bunx biome check --write app/features/transactions app/layouts app/shared/components/AppSidebar.vue tests/e2e/transactionDialog.spec.ts && bun run lint && bun run typecheck 2>&1 | grep -c "error TS"` → lint clean, `0`.

```bash
git add app/features/transactions app/layouts app/shared/components/AppSidebar.vue tests/e2e/transactionDialog.spec.ts
git commit -m "feat: add and edit transactions in a dialog with a prefilled exchange rate"
```

---
### Task 5: Transactions screen on desktop

**Files:**
- Create: `app/features/transactions/types.ts`, `app/features/transactions/composables/useTransactionsScreen.ts`, `app/features/transactions/components/{TransactionSearch,TransactionKindTabs,TransactionFilterFields,TransactionSummary,TransactionTable}.vue`, `tests/e2e/transactions.spec.ts`
- Modify: `app/pages/transactions/index.vue`

**Interfaces:**
- Consumes: Task 3 utils and composables, `useTransactionDialog`, `useUserSettings`, `useCategories`, `useAccounts`, `categorySwatchClass`, `MoneyText`, `PageHeader`, `EmptyState`, `ErrorState`.
- Produces:
  - `type TransactionView = { transaction: TransactionDto; title: string; categoryName: string; categoryColor: string; accountName: string; accountCurrency?: Currency; initial: string }`
  - `useTransactionsScreen()` → `{ filters, sort, query, ready, rows, total, sum, currency, isPending, isError, isFiltered, hasNextPage, isFetchingNextPage, fetchNextPage, retry, resetFilters, categories, accounts, periodKey }`
  - `<TransactionSearch v-model :id :variant="'field' | 'bar'">` (debounced 300 ms), `<TransactionKindTabs v-model :variant="'segmented' | 'chips'">`, `<TransactionFilterFields :id-prefix :categories :accounts v-model:category-id v-model:account-id v-model:period>`, `<TransactionSummary :count :sum :currency>`, `<TransactionTable :rows v-model:sort @open>` (TanStack Table with `rowSortingFeature`, `manualSorting`, sorting on date and amount only, `aria-sort` on the headers).

- [ ] **Step 1: Write the failing E2E test**

Create `tests/e2e/transactions.spec.ts`:

```ts
import { readFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'

test.skip(({ isMobile }) => isMobile, 'the table and the filter panel are the desktop layout')

const filters = (page: Page) => page.getByRole('region', { name: 'Filters' })
const body = (page: Page) => page.getByRole('region', { name: 'Transactions' }).locator('tbody tr')

const showAllTime = async (page: Page) => {
  await filters(page).getByRole('combobox', { name: 'Period' }).click()
  await page.getByRole('option', { name: 'All time' }).click()
}

test('lists transactions with a summary and loads more on demand', async ({ page }) => {
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible()
  await showAllTime(page)
  await expect(body(page)).toHaveCount(20)
  const summary = page.getByRole('region', { name: 'Filter summary' })
  await expect(summary).toContainText(/Found: \d+ transactions/)
  await expect(summary).toContainText(/Total: [+-]PLN/)
  await page.getByRole('button', { name: 'Show more' }).click()
  await expect(body(page)).toHaveCount(40)
})

test('filters by search, type and category', async ({ page }) => {
  await page.goto('/transactions')
  await showAllTime(page)
  const search = filters(page).getByRole('searchbox', { name: 'Search' })
  await search.fill('Lidl')
  await expect(body(page).first()).toContainText('Lidl')
  await expect(body(page).filter({ hasNotText: 'Lidl' })).toHaveCount(0)
  await search.fill('')
  await filters(page).getByRole('button', { name: 'Income', exact: true }).click()
  await expect(body(page).filter({ hasText: 'Wynagrodzenie' }).first()).toBeVisible()
  await expect(body(page).filter({ hasText: 'Czynsz' })).toHaveCount(0)
  await filters(page).getByRole('button', { name: 'All', exact: true }).click()
  await filters(page).getByRole('combobox', { name: 'Category' }).click()
  await page.getByRole('option', { name: 'Mieszkanie' }).click()
  await expect(body(page).filter({ hasText: 'Czynsz' }).first()).toBeVisible()
  await expect(body(page).filter({ hasNotText: 'Mieszkanie' })).toHaveCount(0)
})

test('sorts by amount and by date on the server', async ({ page }) => {
  await page.goto('/transactions')
  await showAllTime(page)
  const amount = page.getByRole('columnheader', { name: 'Amount' })
  const date = page.getByRole('columnheader', { name: 'Date' })
  await expect(date).toHaveAttribute('aria-sort', 'descending')
  await amount.getByRole('button').click()
  await expect(amount).toHaveAttribute('aria-sort', 'descending')
  await expect(body(page).first()).toContainText('Wynagrodzenie')
  await amount.getByRole('button').click()
  await expect(amount).toHaveAttribute('aria-sort', 'ascending')
  await expect(body(page).first()).not.toContainText('Wynagrodzenie')
  await date.getByRole('button').click()
  await expect(date).toHaveAttribute('aria-sort', 'descending')
  await expect(amount).not.toHaveAttribute('aria-sort', /./)
})

test('adds a transaction from the header, edits it from its row and deletes it', async ({ page }) => {
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Add transaction' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await dialog.getByLabel('Amount').pressSequentially('12.5')
  await dialog.getByLabel('Description').fill('Kiosk Ruch')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Transaction saved')).toBeVisible()
  const row = body(page).filter({ hasText: 'Kiosk Ruch' })
  await expect(row).toContainText('-PLN 12.50')
  await expect(row).toContainText('Spożywcze')
  await row.getByRole('button', { name: 'Kiosk Ruch' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit transaction' })
  await expect(edit.getByLabel('Description')).toHaveValue('Kiosk Ruch')
  await edit.getByLabel('Note').fill('Gazeta')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Transaction updated')).toBeVisible()
  await expect(row).toContainText('Gazeta')
  await row.click()
  await page.getByRole('dialog', { name: 'Edit transaction' }).getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Transaction deleted')).toBeVisible()
  await expect(row).toHaveCount(0)
})

test('exports every filtered transaction as CSV', async ({ page }) => {
  await page.goto('/transactions')
  await showAllTime(page)
  await filters(page).getByRole('searchbox', { name: 'Search' }).fill('Lidl')
  await expect(body(page).filter({ hasNotText: 'Lidl' })).toHaveCount(0)
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^mita-transactions-\d{4}-\d{2}-\d{2}\.csv$/)
  const lines = readFileSync(await download.path(), 'utf8').trim().split('\r\n')
  expect(lines[0]).toBe(
    '﻿Date,Type,Description,Category,Account,Amount,Currency,Account amount,Account currency,Exchange rate,Amount in base currency,Base currency,Note',
  )
  expect(lines.length).toBeGreaterThan(21)
  expect(lines.slice(1).every((line) => line.includes(',Expense,Lidl,Spożywcze,Konto główne,'))).toBe(true)
  await expect(page.getByText(/^Exported \d+ transactions$/)).toBeVisible()
})

test('shows an empty state for filters without results and resets them', async ({ page }) => {
  await page.goto('/transactions')
  const search = filters(page).getByRole('searchbox', { name: 'Search' })
  await search.fill('zzzz')
  await expect(page.getByRole('heading', { name: 'Nothing found' })).toBeVisible()
  await page.getByRole('button', { name: 'Reset filters' }).click()
  await expect(search).toHaveValue('')
  await expect(page.getByRole('heading', { name: 'Nothing found' })).toHaveCount(0)
})

test('invites to add the first transaction when there are none', async ({ page }) => {
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Add transaction' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await dialog.getByLabel('Amount').pressSequentially('1')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Transaction saved')).toBeVisible()
  await page.evaluate(() => {
    const key = 'mita-mock-db-v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    state.transactions = []
    localStorage.setItem(key, JSON.stringify(state))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'No transactions yet' })).toBeVisible()
  await page.getByRole('button', { name: 'Add your first transaction' }).click()
  await expect(page.getByRole('dialog', { name: 'New transaction' })).toBeVisible()
})

test('transactions screen is localized', async ({ page }) => {
  await page.goto('/pl/transactions')
  await expect(page.getByRole('heading', { level: 1, name: 'Operacje' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dodaj operację' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Podsumowanie filtra' })).toContainText('Znaleziono')
})
```

- [ ] **Step 2: Run the E2E test to verify it fails**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/scripts/tx-e2e.sh tests/e2e/transactions.spec.ts`
Expected: FAIL — the page is still a placeholder.

- [ ] **Step 3: Write the view type and the screen composable**

Create `app/features/transactions/types.ts`:

```ts
import type { TransactionDto } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'

export type TransactionView = {
  transaction: TransactionDto
  title: string
  categoryName: string
  categoryColor: string
  accountName: string
  accountCurrency?: Currency
  initial: string
}
```

Create `app/features/transactions/composables/useTransactionsScreen.ts`:

```ts
import { useAccounts } from '~/shared/accounts/useAccounts'
import type { TransactionSort } from '~/shared/api/contract'
import { useCategories } from '~/shared/categories/useCategories'
import { todayIso } from '~/shared/period/period'
import { useUserSettings } from '~/shared/user/useUserSettings'
import type { TransactionView } from '../types'
import { defaultFilters, isDefaultFilters, periodKeyOf, type TransactionFilters, toQuery } from '../utils/filters'

export function useTransactionsScreen() {
  const settings = useUserSettings()
  const categories = useCategories()
  const accounts = useAccounts()
  const today = todayIso()
  const filters = ref<TransactionFilters>(defaultFilters())
  const sort = ref<TransactionSort>('-date')
  const ready = computed(() => !settings.isPending.value && !settings.isError.value)
  const query = computed(() => toQuery(filters.value, sort.value, today, settings.monthStart.value))
  const list = useTransactions(query, { enabled: ready })

  const accountsById = computed(() => new Map(accounts.accounts.value.map((account) => [account.id, account])))
  const rows = computed<TransactionView[]>(() =>
    list.items.value.map((transaction) => {
      const category = categories.byId.value.get(transaction.categoryId)
      const account = accountsById.value.get(transaction.accountId)
      const categoryName = category?.name ?? ''
      const title = transaction.title || categoryName
      return {
        transaction,
        title,
        categoryName,
        categoryColor: category?.color ?? '',
        accountName: account?.name ?? '',
        accountCurrency: account?.currency,
        initial: (categoryName || title).charAt(0).toLocaleUpperCase(),
      }
    }),
  )

  const isError = computed(
    () => settings.isError.value || list.isError.value || categories.isError.value || accounts.isError.value,
  )
  const isPending = computed(() => list.isPending.value || categories.isPending.value || accounts.isPending.value)

  function retry() {
    if (settings.isError.value) settings.refetch()
    if (categories.isError.value) categories.refetch()
    if (accounts.isError.value) accounts.refetch()
    if (list.isError.value) list.refetch()
  }

  return {
    filters,
    sort,
    query,
    ready,
    rows,
    total: list.total,
    sum: list.sum,
    currency: list.currency,
    isPending,
    isError,
    isFiltered: computed(() => !isDefaultFilters(filters.value)),
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: list.fetchNextPage,
    retry,
    resetFilters: () => {
      filters.value = defaultFilters()
    },
    categories: categories.categories,
    accounts: accounts.accounts,
    periodKey: computed(() => periodKeyOf(filters.value.period, today, settings.monthStart.value)),
  }
}
```

- [ ] **Step 4: Write the filter components**

Create `app/features/transactions/components/TransactionSearch.vue`:

```vue
<script setup lang="ts">
withDefaults(defineProps<{ id: string; variant?: 'field' | 'bar' }>(), { variant: 'field' })
const model = defineModel<string>({ required: true })
const { t } = useI18n()
const draft = ref(model.value)
let timer: ReturnType<typeof setTimeout> | undefined

watch(draft, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    model.value = value
  }, 300)
})

watch(model, (value) => {
  if (value !== draft.value) draft.value = value
})

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <label v-if="variant === 'field'" :for="id" class="flex min-w-0 flex-col gap-1.5 text-[13px] font-medium text-muted">
    {{ t('transactions.filters.search') }}
    <InputText
      :id="id"
      v-model="draft"
      type="search"
      autocomplete="off"
      :placeholder="t('transactions.filters.searchPlaceholder')"
      fluid
    />
  </label>
  <label
    v-else
    :for="id"
    class="flex min-h-11.5 items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 text-muted focus-within:border-accent"
  >
    <AppIcon name="search" />
    <span class="sr-only">{{ t('transactions.filters.search') }}</span>
    <input
      :id="id"
      v-model="draft"
      type="search"
      autocomplete="off"
      :placeholder="t('transactions.filters.searchPlaceholder')"
      class="min-w-0 flex-auto border-0 bg-transparent text-[15px] text-ink outline-none"
    />
  </label>
</template>
```

Create `app/features/transactions/components/TransactionKindTabs.vue`:

```vue
<script setup lang="ts">
import type { KindFilter } from '../utils/filters'

const props = withDefaults(defineProps<{ variant?: 'segmented' | 'chips' }>(), { variant: 'segmented' })
const model = defineModel<KindFilter>({ required: true })
const { t } = useI18n()
const options: KindFilter[] = ['all', 'expense', 'income']

const optionClass = (option: KindFilter) => {
  const active = model.value === option
  if (props.variant === 'chips') {
    return [
      'min-h-11 rounded-full border px-4 text-[13px] font-semibold',
      active ? 'border-deep bg-deep text-on-deep' : 'border-border bg-surface text-muted',
    ]
  }
  return [
    'min-h-11 rounded-lg px-3.5 text-[13px]',
    active ? 'bg-surface font-semibold text-ink' : 'bg-transparent font-medium text-muted',
  ]
}
</script>

<template>
  <div
    role="group"
    :aria-label="t('transactions.filters.kind')"
    :class="variant === 'chips' ? 'flex flex-wrap gap-2' : 'flex rounded-(--radius-control) bg-bg p-0.75'"
  >
    <button
      v-for="option in options"
      :key="option"
      type="button"
      :aria-pressed="model === option"
      :class="optionClass(option)"
      @click="model = option"
    >
      {{ t(`transactions.kind.${option}`) }}
    </button>
  </div>
</template>
```

Create `app/features/transactions/components/TransactionFilterFields.vue`:

```vue
<script setup lang="ts">
import { type AccountDto, type CategoryDto, categoryKinds } from '~/shared/api/contract'
import { type PeriodPreset, periodPresets } from '../utils/filters'

const props = defineProps<{ idPrefix: string; categories: CategoryDto[]; accounts: AccountDto[] }>()
const categoryId = defineModel<string | null>('categoryId', { required: true })
const accountId = defineModel<string | null>('accountId', { required: true })
const period = defineModel<PeriodPreset>('period', { required: true })
const { t } = useI18n()

const categoryGroups = computed(() =>
  categoryKinds
    .map((kind) => ({
      label: t(`transactions.kind.${kind}`),
      items: props.categories.filter((category) => category.kind === kind && category.system !== 'transfer'),
    }))
    .filter((group) => group.items.length > 0),
)
const accountOptions = computed(() => props.accounts.map((account) => ({ value: account.id, label: account.name })))
const periodOptions = computed(() =>
  periodPresets.map((preset) => ({ value: preset, label: t(`transactions.period.${preset}`) })),
)
</script>

<template>
  <FormRow :id="`${idPrefix}-category`" :label="t('transactions.filters.category')" class="min-w-0 flex-[1_1_150px]">
    <template #default="{ labelId }">
      <Select
        v-model="categoryId"
        :input-id="`${idPrefix}-category`"
        :options="categoryGroups"
        option-group-label="label"
        option-group-children="items"
        option-label="name"
        option-value="id"
        :placeholder="t('transactions.filters.allCategories')"
        show-clear
        :aria-labelledby="labelId"
        fluid
      />
    </template>
  </FormRow>
  <FormRow :id="`${idPrefix}-account`" :label="t('transactions.filters.account')" class="min-w-0 flex-[1_1_150px]">
    <template #default="{ labelId }">
      <Select
        v-model="accountId"
        :input-id="`${idPrefix}-account`"
        :options="accountOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('transactions.filters.allAccounts')"
        show-clear
        :aria-labelledby="labelId"
        fluid
      />
    </template>
  </FormRow>
  <FormRow :id="`${idPrefix}-period`" :label="t('transactions.filters.period')" class="min-w-0 flex-[1_1_150px]">
    <template #default="{ labelId }">
      <Select
        v-model="period"
        :input-id="`${idPrefix}-period`"
        :options="periodOptions"
        option-label="label"
        option-value="value"
        :aria-labelledby="labelId"
        fluid
      />
    </template>
  </FormRow>
</template>
```

Create `app/features/transactions/components/TransactionSummary.vue`:

```vue
<script setup lang="ts">
import type { Currency } from '~/shared/money/money'

defineProps<{ count: number; sum: number; currency: Currency }>()
const { t } = useI18n()
const { format } = useMoney()
</script>

<template>
  <section
    :aria-label="t('transactions.summary.label')"
    aria-live="polite"
    class="flex flex-wrap gap-x-6 gap-y-1 px-1 text-sm text-muted"
  >
    <i18n-t keypath="transactions.summary.found" tag="span" scope="global">
      <template #count>
        <strong class="font-semibold text-ink">{{ t('transactions.summary.count', { count }, count) }}</strong>
      </template>
    </i18n-t>
    <i18n-t keypath="transactions.summary.total" tag="span" scope="global">
      <template #amount>
        <strong class="font-mono font-medium text-ink">{{ format(sum, currency, { signed: true }) }}</strong>
      </template>
    </i18n-t>
  </section>
</template>
```

- [ ] **Step 5: Write the table**

Create `app/features/transactions/components/TransactionTable.vue`:

```vue
<script setup lang="ts">
import {
  createColumnHelper,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  type Updater,
  useTable,
} from '@tanstack/vue-table'
import type { TransactionDto, TransactionSort } from '~/shared/api/contract'
import { categorySwatchClass } from '~/shared/categories/colors'
import type { TransactionView } from '../types'
import { signedAccountAmount, signedAmount } from '../utils/group'

const props = defineProps<{ rows: TransactionView[] }>()
const sort = defineModel<TransactionSort>('sort', { required: true })
const emit = defineEmits<{ open: [transaction: TransactionDto] }>()
const { t, d } = useI18n()
const { format } = useMoney()

const features = tableFeatures({ rowSortingFeature })
const columnHelper = createColumnHelper<typeof features, TransactionView>()
const columns = [
  columnHelper.accessor((row) => row.transaction.date, { id: 'date', sortDescFirst: true }),
  columnHelper.accessor('title', { id: 'description', enableSorting: false }),
  columnHelper.accessor('categoryName', { id: 'category', enableSorting: false }),
  columnHelper.accessor('accountName', { id: 'account', enableSorting: false }),
  columnHelper.accessor((row) => row.transaction.baseAmount, { id: 'amount', sortDescFirst: true }),
]

const headerKeys: Record<string, string> = {
  date: 'transactions.table.date',
  description: 'transactions.table.description',
  category: 'transactions.table.category',
  account: 'transactions.table.account',
  amount: 'transactions.table.amount',
}

const toSorting = (value: TransactionSort): SortingState => [
  { id: value.endsWith('amount') ? 'amount' : 'date', desc: value.startsWith('-') },
]

function fromSorting(state: SortingState): TransactionSort {
  const [first] = state
  if (!first) return '-date'
  if (first.id === 'amount') return first.desc ? '-amount' : 'amount'
  return first.desc ? '-date' : 'date'
}

const data = computed(() => props.rows)
const state = computed(() => ({ sorting: toSorting(sort.value) }))

const table = useTable({
  features,
  columns,
  data,
  state,
  manualSorting: true,
  enableSortingRemoval: false,
  enableMultiSort: false,
  getRowId: (row) => row.transaction.id,
  onSortingChange: (updater: Updater<SortingState>) => {
    sort.value = fromSorting(typeof updater === 'function' ? updater(toSorting(sort.value)) : updater)
  },
})

const ariaSort = (direction: false | 'asc' | 'desc') =>
  direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined

const day = (iso: string) => d(new Date(`${iso}T00:00:00Z`), { day: '2-digit', month: '2-digit', timeZone: 'UTC' })

const converted = (row: TransactionView) =>
  row.accountCurrency && row.accountCurrency !== row.transaction.currency
    ? t('transactions.converted', {
        amount: format(signedAccountAmount(row.transaction), row.accountCurrency, { signed: true }),
      })
    : undefined
</script>

<template>
  <section :aria-label="t('transactions.table.label')" class="overflow-x-auto rounded-(--radius-card) bg-surface">
    <table class="w-full min-w-170 border-collapse">
      <thead>
        <tr v-for="group in table.getHeaderGroups()" :key="group.id">
          <th
            v-for="header in group.headers"
            :key="header.id"
            scope="col"
            :aria-sort="ariaSort(header.column.getIsSorted())"
            class="whitespace-nowrap border-b border-border px-4 py-1 text-xs font-semibold text-muted"
            :class="header.column.id === 'amount' ? 'text-right' : 'text-left'"
          >
            <button
              v-if="header.column.getCanSort()"
              type="button"
              class="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
              @click="header.column.getToggleSortingHandler()?.($event)"
            >
              {{ t(headerKeys[header.column.id] ?? '') }}
              <AppIcon
                v-if="header.column.getIsSorted()"
                :name="header.column.getIsSorted() === 'desc' ? 'arrowDown' : 'arrowUp'"
                :size="14"
              />
            </button>
            <span v-else class="inline-flex min-h-11 items-center">{{ t(headerKeys[header.column.id] ?? '') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          class="cursor-pointer transition-colors hover:bg-bg/60"
          @click="emit('open', row.original.transaction)"
        >
          <td class="whitespace-nowrap border-b border-bg px-4 py-3.5 font-mono text-[13px] text-muted">
            {{ day(row.original.transaction.date) }}
          </td>
          <td class="border-b border-bg px-4 py-3.5">
            <button
              type="button"
              class="text-left text-sm font-medium text-ink hover:text-accent"
              @click.stop="emit('open', row.original.transaction)"
            >
              {{ row.original.title }}
            </button>
            <span v-if="row.original.transaction.note" class="block text-xs text-muted">
              {{ row.original.transaction.note }}
            </span>
          </td>
          <td class="border-b border-bg px-4 py-3.5">
            <span
              class="inline-flex items-center gap-1.5 rounded-full bg-track px-2.5 py-1 text-xs font-semibold text-ink"
            >
              <span
                class="size-2 rounded-full"
                :class="categorySwatchClass(row.original.categoryColor)"
                aria-hidden="true"
              />
              {{ row.original.categoryName }}
            </span>
          </td>
          <td class="border-b border-bg px-4 py-3.5 text-[13px] text-muted">{{ row.original.accountName }}</td>
          <td class="whitespace-nowrap border-b border-bg px-4 py-3.5 text-right">
            <MoneyText
              :amount="signedAmount(row.original.transaction)"
              :currency="row.original.transaction.currency"
              signed
              class="text-sm"
            />
            <span v-if="converted(row.original)" class="block font-mono text-xs text-muted">
              {{ converted(row.original) }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
```

If the installed TanStack Table 9 typings name an option or method differently (check `node_modules/@tanstack/table-core/dist/features/row-sorting/rowSortingFeature.types.d.ts` and `dist/helpers/columnHelper.d.ts`), adapt the call while keeping the behaviour: server-side sorting, no removal, descending first, sortable date and amount only.

- [ ] **Step 6: Write the page**

Replace `app/pages/transactions/index.vue`:

```vue
<script setup lang="ts">
const { t, d } = useI18n()
const screen = useTransactionsScreen()
const { filters, sort, rows, total, sum, currency, isPending, isError, isFiltered, hasNextPage, isFetchingNextPage } =
  screen
const dialog = useTransactionDialog()
const exporter = useTransactionExport()

const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number)
  return d(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 15)), { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const eyebrow = computed(() => {
  const key = screen.periodKey.value
  return key ? monthLabel(key) : t(`transactions.period.${filters.value.period}`)
})

useHead({ title: () => t('navigation.transactions') })
</script>

<template>
  <PageHeader :title="t('navigation.transactions')" :eyebrow="eyebrow">
    <template #actions>
      <Button
        severity="secondary"
        outlined
        class="min-h-11"
        :loading="exporter.exporting.value"
        :disabled="!screen.ready.value"
        @click="exporter.exportCsv(screen.query.value)"
      >
        <AppIcon name="download" :size="16" />
        {{ t('transactions.actions.export') }}
      </Button>
      <Button class="min-h-11" @click="dialog.openCreate()">
        <AppIcon name="plus" :size="16" :stroke-width="2.2" />
        {{ t('transactions.actions.add') }}
      </Button>
    </template>
  </PageHeader>
  <section
    :aria-label="t('transactions.filters.label')"
    class="flex flex-wrap items-end gap-3 rounded-(--radius-card) bg-surface px-5.5 py-4.5"
  >
    <TransactionSearch id="transactions-search" v-model="filters.search" class="flex-[2_1_240px]" />
    <TransactionFilterFields
      v-model:category-id="filters.categoryId"
      v-model:account-id="filters.accountId"
      v-model:period="filters.period"
      id-prefix="transactions"
      :categories="screen.categories.value"
      :accounts="screen.accounts.value"
    />
    <TransactionKindTabs v-model="filters.kind" />
  </section>
  <TransactionSummary
    v-if="!isPending && !isError && currency"
    :count="total ?? 0"
    :sum="sum ?? 0"
    :currency="currency"
  />
  <ErrorState v-if="isError" @retry="screen.retry" />
  <section v-else-if="isPending" class="flex flex-col gap-3 rounded-(--radius-card) bg-surface p-4" aria-hidden="true">
    <Skeleton v-for="index in 8" :key="index" height="2.75rem" />
  </section>
  <EmptyState
    v-else-if="rows.length === 0 && isFiltered"
    :title="t('transactions.empty.filteredTitle')"
    :description="t('transactions.empty.filteredDescription')"
  >
    <template #action>
      <Button :label="t('transactions.actions.resetFilters')" severity="secondary" outlined @click="screen.resetFilters" />
    </template>
  </EmptyState>
  <EmptyState
    v-else-if="rows.length === 0"
    :title="t('transactions.empty.title')"
    :description="t('transactions.empty.description')"
  >
    <template #action>
      <Button :label="t('transactions.actions.addFirst')" @click="dialog.openCreate()" />
    </template>
  </EmptyState>
  <template v-else>
    <TransactionTable v-model:sort="sort" :rows="rows" @open="dialog.openEdit" />
    <div v-if="hasNextPage" class="flex justify-center">
      <Button
        :label="t('transactions.actions.showMore')"
        severity="secondary"
        outlined
        class="min-h-11"
        :loading="isFetchingNextPage"
        @click="screen.fetchNextPage()"
      />
    </div>
  </template>
</template>
```

- [ ] **Step 7: Run the E2E tests to verify they pass**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/scripts/tx-e2e.sh tests/e2e/transactions.spec.ts tests/e2e/transactionDialog.spec.ts tests/e2e/navigation.spec.ts`
Expected: PASS on `desktop`, skipped transaction tests on `mobile`.

- [ ] **Step 8: Lint, typecheck, commit**

Run: `bunx biome check --write app/features/transactions app/pages/transactions tests/e2e/transactions.spec.ts && bun run lint && bun run typecheck 2>&1 | grep -c "error TS"` → lint clean, `0`.

```bash
git add app/features/transactions app/pages/transactions tests/e2e/transactions.spec.ts
git commit -m "feat: transactions table with filters, sorting, summary and CSV export"
```

---
### Task 6: Mobile transactions grouped by day with filters in a drawer

**Files:**
- Create: `app/features/transactions/components/TransactionDayList.vue`, `tests/e2e/transactionsMobile.spec.ts`
- Modify: `app/pages/transactions/index.vue`

**Interfaces:**
- Consumes: `groupByDay`, `signedAmount` (Task 3), `TransactionView`, `useTransactionsScreen` (Task 5), `TransactionSearch` (`variant="bar"`), `TransactionKindTabs` (`variant="chips"`), `TransactionFilterFields`.
- Produces: `<TransactionDayList :rows :currency @open>` — a region "Transactions by day" with one `h2` per day ("Today", "Yesterday" or the date) and the signed base-currency day sum, cards with the category initial, title, category and the signed amount; each card is a button that opens the edit dialog.

Layout switch is CSS only (`lg` breakpoint): the desktop filter panel, header buttons with labels and the table get `hidden lg:…`; the mobile search bar, chips, icon buttons and the day list get `lg:hidden`. Inputs that exist in both layouts use different ids. Below `lg` the add button is the bottom navigation "+" (Task 7), so the header shows only the export and filter icon buttons.

- [ ] **Step 1: Write the failing E2E test**

Create `tests/e2e/transactionsMobile.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test'

test.skip(({ isMobile }) => !isMobile, 'cards grouped by day are the mobile layout')

const list = (page: Page) => page.getByRole('region', { name: 'Transactions by day' })

const showAllTime = async (page: Page) => {
  await page.getByRole('button', { name: 'Filters' }).click()
  const drawer = page.getByRole('dialog', { name: 'Filters' })
  await drawer.getByRole('combobox', { name: 'Period' }).click()
  await page.getByRole('option', { name: 'All time' }).click()
  await drawer.getByRole('button', { name: 'Show results' }).click()
  await expect(drawer).toBeHidden()
}

test('groups transactions by day and filters them with chips, search and a drawer', async ({ page }) => {
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible()
  await showAllTime(page)
  await expect(list(page).getByRole('heading').first()).toBeVisible()
  await expect(page.getByRole('region', { name: 'Filter summary' })).toContainText(/Found: \d+ transactions/)
  await page.getByRole('button', { name: 'Income', exact: true }).click()
  await expect(list(page).getByRole('listitem').filter({ hasText: 'Wynagrodzenie' }).first()).toBeVisible()
  await expect(list(page).getByRole('listitem').filter({ hasText: 'Czynsz' })).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Search' }).fill('Odsetki')
  await expect(list(page).getByRole('listitem').first()).toContainText('Odsetki')
  await expect(list(page).getByRole('listitem').filter({ hasNotText: 'Odsetki' })).toHaveCount(0)
})

test('opens the edit dialog from a card', async ({ page }) => {
  await page.goto('/transactions')
  await showAllTime(page)
  await page.getByRole('searchbox', { name: 'Search' }).fill('Czynsz')
  await list(page).getByRole('listitem').first().getByRole('button').click()
  const dialog = page.getByRole('dialog', { name: 'Edit transaction' })
  await expect(dialog.getByLabel('Description')).toHaveValue('Czynsz')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})

test('resets the filters from the drawer', async ({ page }) => {
  await page.goto('/transactions')
  await showAllTime(page)
  await page.getByRole('button', { name: 'Filters' }).click()
  const drawer = page.getByRole('dialog', { name: 'Filters' })
  await drawer.getByRole('button', { name: 'Reset filters' }).click()
  await expect(drawer.getByRole('combobox', { name: 'Period' })).toContainText('This month')
})
```

- [ ] **Step 2: Run the E2E test to verify it fails**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/scripts/tx-e2e.sh tests/e2e/transactionsMobile.spec.ts`
Expected: FAIL — no "Filters" button.

- [ ] **Step 3: Write the day list**

Create `app/features/transactions/components/TransactionDayList.vue`:

```vue
<script setup lang="ts">
import type { TransactionDto } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'
import { addDaysIso, todayIso } from '~/shared/period/period'
import type { TransactionView } from '../types'
import { groupByDay, signedAmount } from '../utils/group'

const props = defineProps<{ rows: TransactionView[]; currency: Currency }>()
const emit = defineEmits<{ open: [transaction: TransactionDto] }>()
const { t, d } = useI18n()
const { format } = useMoney()
const today = todayIso()

const groups = computed(() => groupByDay(props.rows, (row) => row.transaction))

const label = (date: string) => {
  if (date === today) return t('transactions.day.today')
  if (date === addDaysIso(today, -1)) return t('transactions.day.yesterday')
  return d(new Date(`${date}T00:00:00Z`), 'dayMonth')
}
</script>

<template>
  <section :aria-label="t('transactions.list.label')" class="flex flex-col gap-3.5">
    <section
      v-for="group in groups"
      :key="group.date"
      :aria-labelledby="`transactions-day-${group.date}`"
      class="flex flex-col gap-1.5"
    >
      <div class="flex items-baseline justify-between gap-3 px-1 text-xs font-semibold text-muted">
        <h2 :id="`transactions-day-${group.date}`" class="m-0 text-xs font-semibold">{{ label(group.date) }}</h2>
        <span class="font-mono">{{ format(group.sum, currency, { signed: true }) }}</span>
      </div>
      <ul class="m-0 list-none rounded-(--radius-card) bg-surface px-4 py-0">
        <li v-for="(row, index) in group.items" :key="row.transaction.id" :class="{ 'border-t border-bg': index > 0 }">
          <button
            type="button"
            class="flex min-h-15 w-full items-center gap-3 py-3 text-left"
            @click="emit('open', row.transaction)"
          >
            <span
              class="flex size-9 flex-none items-center justify-center rounded-(--radius-control) bg-track text-[13px] font-bold text-ink"
              aria-hidden="true"
            >
              {{ row.initial }}
            </span>
            <span class="flex min-w-0 flex-auto flex-col gap-0.5">
              <span class="truncate text-sm font-medium text-ink">{{ row.title }}</span>
              <span class="truncate text-xs text-muted">{{ row.categoryName }}</span>
            </span>
            <MoneyText
              :amount="signedAmount(row.transaction)"
              :currency="row.transaction.currency"
              signed
              class="text-sm"
            />
          </button>
        </li>
      </ul>
    </section>
  </section>
</template>
```

- [ ] **Step 4: Make the page responsive**

Replace `app/pages/transactions/index.vue`:

```vue
<script setup lang="ts">
const { t, d } = useI18n()
const screen = useTransactionsScreen()
const { filters, sort, rows, total, sum, currency, isPending, isError, isFiltered, hasNextPage, isFetchingNextPage } =
  screen
const dialog = useTransactionDialog()
const exporter = useTransactionExport()
const filtersOpen = ref(false)

const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number)
  return d(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 15)), { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const eyebrow = computed(() => {
  const key = screen.periodKey.value
  return key ? monthLabel(key) : t(`transactions.period.${filters.value.period}`)
})

const exportCsv = () => exporter.exportCsv(screen.query.value)

useHead({ title: () => t('navigation.transactions') })
</script>

<template>
  <PageHeader :title="t('navigation.transactions')" :eyebrow="eyebrow">
    <template #actions>
      <Button
        severity="secondary"
        outlined
        class="hidden min-h-11 lg:inline-flex"
        :loading="exporter.exporting.value"
        :disabled="!screen.ready.value"
        @click="exportCsv"
      >
        <AppIcon name="download" :size="16" />
        {{ t('transactions.actions.export') }}
      </Button>
      <Button class="hidden min-h-11 lg:inline-flex" @click="dialog.openCreate()">
        <AppIcon name="plus" :size="16" :stroke-width="2.2" />
        {{ t('transactions.actions.add') }}
      </Button>
      <Button
        severity="secondary"
        outlined
        class="size-11 lg:hidden"
        :aria-label="t('transactions.actions.filters')"
        @click="filtersOpen = true"
      >
        <AppIcon name="filter" :size="20" />
      </Button>
      <Button
        severity="secondary"
        outlined
        class="size-11 lg:hidden"
        :aria-label="t('transactions.actions.export')"
        :loading="exporter.exporting.value"
        :disabled="!screen.ready.value"
        @click="exportCsv"
      >
        <AppIcon name="download" :size="20" />
      </Button>
    </template>
  </PageHeader>
  <section
    :aria-label="t('transactions.filters.label')"
    class="hidden flex-wrap items-end gap-3 rounded-(--radius-card) bg-surface px-5.5 py-4.5 lg:flex"
  >
    <TransactionSearch id="transactions-search" v-model="filters.search" class="flex-[2_1_240px]" />
    <TransactionFilterFields
      v-model:category-id="filters.categoryId"
      v-model:account-id="filters.accountId"
      v-model:period="filters.period"
      id-prefix="transactions"
      :categories="screen.categories.value"
      :accounts="screen.accounts.value"
    />
    <TransactionKindTabs v-model="filters.kind" />
  </section>
  <div class="flex flex-col gap-3 lg:hidden">
    <TransactionSearch id="transactions-search-mobile" v-model="filters.search" variant="bar" />
    <TransactionKindTabs v-model="filters.kind" variant="chips" />
  </div>
  <TransactionSummary
    v-if="!isPending && !isError && currency"
    :count="total ?? 0"
    :sum="sum ?? 0"
    :currency="currency"
  />
  <ErrorState v-if="isError" @retry="screen.retry" />
  <div v-else-if="isPending" class="flex flex-col gap-3" aria-hidden="true">
    <section class="hidden flex-col gap-3 rounded-(--radius-card) bg-surface p-4 lg:flex">
      <Skeleton v-for="index in 8" :key="index" height="2.75rem" />
    </section>
    <div class="flex flex-col gap-3.5 lg:hidden">
      <Skeleton v-for="index in 3" :key="index" height="8rem" border-radius="16px" />
    </div>
  </div>
  <EmptyState
    v-else-if="rows.length === 0 && isFiltered"
    :title="t('transactions.empty.filteredTitle')"
    :description="t('transactions.empty.filteredDescription')"
  >
    <template #action>
      <Button
        :label="t('transactions.actions.resetFilters')"
        severity="secondary"
        outlined
        @click="screen.resetFilters"
      />
    </template>
  </EmptyState>
  <EmptyState
    v-else-if="rows.length === 0"
    :title="t('transactions.empty.title')"
    :description="t('transactions.empty.description')"
  >
    <template #action>
      <Button :label="t('transactions.actions.addFirst')" class="hidden lg:inline-flex" @click="dialog.openCreate()" />
      <NuxtLinkLocale
        to="/transactions/new"
        class="inline-flex min-h-11 items-center rounded-(--radius-control) bg-accent px-4 text-sm font-semibold text-on-accent no-underline lg:hidden"
      >
        {{ t('transactions.actions.addFirst') }}
      </NuxtLinkLocale>
    </template>
  </EmptyState>
  <template v-else>
    <TransactionTable v-model:sort="sort" class="hidden lg:block" :rows="rows" @open="dialog.openEdit" />
    <TransactionDayList v-if="currency" class="lg:hidden" :rows="rows" :currency="currency" @open="dialog.openEdit" />
    <div v-if="hasNextPage" class="flex justify-center">
      <Button
        :label="t('transactions.actions.showMore')"
        severity="secondary"
        outlined
        class="min-h-11"
        :loading="isFetchingNextPage"
        @click="screen.fetchNextPage()"
      />
    </div>
  </template>
  <Drawer
    v-model:visible="filtersOpen"
    position="bottom"
    :header="t('transactions.filters.label')"
    class="h-auto! rounded-t-(--radius-panel)"
  >
    <div class="flex flex-col gap-4">
      <TransactionFilterFields
        v-model:category-id="filters.categoryId"
        v-model:account-id="filters.accountId"
        v-model:period="filters.period"
        id-prefix="transactions-drawer"
        :categories="screen.categories.value"
        :accounts="screen.accounts.value"
      />
      <div class="flex gap-2">
        <Button
          :label="t('transactions.actions.resetFilters')"
          severity="secondary"
          outlined
          class="min-h-11 flex-1"
          @click="screen.resetFilters"
        />
        <Button :label="t('transactions.actions.apply')" class="min-h-11 flex-1" @click="filtersOpen = false" />
      </div>
    </div>
  </Drawer>
</template>
```

The "Add your first transaction" EmptyState action uses the dialog on desktop and the full-screen page on mobile; the desktop E2E (Task 5) clicks the visible button.

- [ ] **Step 5: Run the E2E tests to verify they pass**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/scripts/tx-e2e.sh tests/e2e/transactionsMobile.spec.ts tests/e2e/transactions.spec.ts`
Expected: PASS (mobile tests on `mobile`, desktop tests on `desktop`).

- [ ] **Step 6: Lint, typecheck, commit**

Run: `bunx biome check --write app/features/transactions app/pages/transactions tests/e2e/transactionsMobile.spec.ts && bun run lint && bun run typecheck 2>&1 | grep -c "error TS"` → lint clean, `0`.

```bash
git add app/features/transactions app/pages/transactions tests/e2e/transactionsMobile.spec.ts
git commit -m "feat: mobile transactions grouped by day with filters in a drawer"
```

---
### Task 7: Full-screen mobile add screen with a keypad

**Files:**
- Create: `app/layouts/focus.vue`, `app/features/transactions/components/QuickAddKeypad.vue`, `app/features/transactions/components/QuickAddForm.vue`
- Modify: `app/pages/transactions/new.vue`, `tests/e2e/transactionsMobile.spec.ts`

**Interfaces:**
- Consumes: `pressKey`, `entryToMinor`, `formatEntry`, `decimalSeparator`, `isDigit`, `KeypadKey` (Task 3), `quickAddRules`, `useTransactionMutations`, `useCategories`, `useAccounts`, `useServerErrors`, `useNotify`, `focusFirstInvalid`.
- Produces: layout `focus` (full-height surface, no navigation, content up to 430px wide, safe-area paddings); `<QuickAddKeypad :decimal-separator @press>`; `<QuickAddForm @close @done>` — expense/income switch, big amount (`output` labelled "Amount", sign and currency from the locale), category tiles (pickable categories of the kind, first one preselected, `aria-pressed`), date button opening a bottom Drawer with an inline DatePicker (at most one year ahead), account button opening a bottom Drawer with the active accounts (first one preselected), numeric keypad with locale decimal separator and backspace (physical keys `0-9`, `,`, `.`, `Backspace` work too), Save. The transaction is saved in the account currency with an empty title. The page goes back in history after save or close (to `/transactions` / `/` when there is no history entry).

- [ ] **Step 1: Extend the mobile E2E test**

Append to `tests/e2e/transactionsMobile.spec.ts`:

```ts
test('adds an expense on the full-screen keypad', async ({ page }) => {
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible()
  await page.getByRole('link', { name: 'New transaction' }).click()
  await expect(page).toHaveURL('/transactions/new')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Enter an amount above zero.')).toBeVisible()
  const keypad = page.getByRole('group', { name: 'Keypad' })
  for (const key of ['4', '2', 'Decimal separator', '5']) {
    await keypad.getByRole('button', { name: key, exact: true }).click()
  }
  await expect(page.getByLabel('Amount')).toHaveText(/^−PLN\s42\.5$/)
  await page.getByRole('button', { name: 'Kawiarnie' }).click()
  await expect(page.getByRole('button', { name: 'Kawiarnie' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page).toHaveURL('/transactions')
  await expect(page.getByText('Transaction saved')).toBeVisible()
  const added = list(page).getByRole('listitem').filter({ hasText: '-PLN 42.50' }).first()
  await expect(added).toContainText('Kawiarnie')
})

test('switches to income and picks the account and the date in drawers', async ({ page }) => {
  await page.goto('/transactions/new')
  await page.getByRole('button', { name: 'Income', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Wynagrodzenie' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Spożywcze' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Account: Konto główne' }).click()
  await page.getByRole('dialog', { name: 'Choose an account' }).getByRole('button', { name: /Oszczędności/ }).click()
  await expect(page.getByRole('button', { name: 'Account: Oszczędności' })).toBeVisible()
  await page.getByRole('button', { name: 'Date: Today' }).click()
  await expect(page.getByRole('dialog', { name: 'Choose a date' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.type('7')
  await expect(page.getByLabel('Amount')).toHaveText(/^\+PLN\s7$/)
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page).not.toHaveURL(/\/transactions\/new$/)
})
```

- [ ] **Step 2: Run the E2E test to verify it fails**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/scripts/tx-e2e.sh tests/e2e/transactionsMobile.spec.ts`
Expected: FAIL — the page is a placeholder.

- [ ] **Step 3: Write the layout**

Create `app/layouts/focus.vue`:

```vue
<template>
  <div class="min-h-dvh bg-surface">
    <main
      class="mx-auto flex min-h-dvh w-full max-w-[26.875rem] flex-col px-5 pt-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),1.75rem)]"
    >
      <slot />
    </main>
  </div>
</template>
```

- [ ] **Step 4: Write the keypad**

Create `app/features/transactions/components/QuickAddKeypad.vue`:

```vue
<script setup lang="ts">
import type { KeypadKey } from '../utils/keypad'

defineProps<{ decimalSeparator: string }>()
const emit = defineEmits<{ press: [key: KeypadKey] }>()
const { t } = useI18n()
const keys: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'decimal', '0', 'backspace']

const labelOf = (key: KeypadKey) =>
  key === 'backspace' ? t('transactions.add.backspace') : key === 'decimal' ? t('transactions.add.decimal') : undefined
</script>

<template>
  <div role="group" :aria-label="t('transactions.add.keypad')" class="grid grid-cols-3 gap-1.5">
    <button
      v-for="key in keys"
      :key="key"
      type="button"
      class="flex min-h-12 items-center justify-center rounded-xl bg-bg font-mono text-xl font-medium text-ink active:bg-track"
      :aria-label="labelOf(key)"
      @click="emit('press', key)"
    >
      <AppIcon v-if="key === 'backspace'" name="backspace" :size="22" />
      <template v-else>{{ key === 'decimal' ? decimalSeparator : key }}</template>
    </button>
  </div>
</template>
```

- [ ] **Step 5: Write the form**

Create `app/features/transactions/components/QuickAddForm.vue`:

```vue
<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import { useAccounts } from '~/shared/accounts/useAccounts'
import { type CategoryKind, categoryKinds } from '~/shared/api/contract'
import { useCategories } from '~/shared/categories/useCategories'
import { addDaysIso, fromLocalDate, todayIso, toLocalDate } from '~/shared/period/period'
import { quickAddRules } from '../schemas/transactionSchema'
import { decimalSeparator, entryToMinor, formatEntry, isDigit, type KeypadKey, pressKey } from '../utils/keypad'

const emit = defineEmits<{ close: []; done: [] }>()
const { t, d, locale } = useI18n()
const notify = useNotify()
const server = useServerErrors()
const categories = useCategories()
const accounts = useAccounts()
const { create } = useTransactionMutations()

const fields = ['amount', 'categoryId', 'accountId', 'date'] as const
type Field = 'amount' | 'categoryId' | 'accountId'

const today = todayIso()
const maxDate = toLocalDate(addDaysIso(today, 365))
const kind = ref<CategoryKind>('expense')
const entry = ref('')
const categoryId = ref<string | null>(null)
const accountId = ref<string | null>(null)
const date = ref(today)
const dateOpen = ref(false)
const accountOpen = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const amount = computed(() => entryToMinor(entry.value))
const tiles = computed(() => categories.pickable(kind.value))
const account = computed(() => accounts.activeAccounts.value.find((row) => row.id === accountId.value))
const currency = computed(() => account.value?.currency ?? 'PLN')
const separator = computed(() => decimalSeparator(locale.value))
const amountText = computed(
  () => `${kind.value === 'expense' ? '−' : '+'}${formatEntry(entry.value, locale.value, currency.value)}`,
)
const loadError = computed(() => categories.isError.value || accounts.isError.value)
const noAccounts = computed(() => !accounts.isPending.value && accounts.activeAccounts.value.length === 0)
const dateLabel = computed(() => {
  if (date.value === today) return t('transactions.day.today')
  if (date.value === addDaysIso(today, -1)) return t('transactions.day.yesterday')
  return d(new Date(`${date.value}T00:00:00Z`), 'dayMonth')
})

const v$ = useVuelidate(quickAddRules(t), reactive({ amount, categoryId, accountId }))

watch(
  tiles,
  (list) => {
    if (!list.some((category) => category.id === categoryId.value)) categoryId.value = list[0]?.id ?? null
  },
  { immediate: true },
)

watch(
  accounts.activeAccounts,
  (list) => {
    if (!list.some((row) => row.id === accountId.value)) accountId.value = list[0]?.id ?? null
  },
  { immediate: true },
)

const errorsOf = (field: Field) => [
  ...v$.value[field].$errors.map((error) => String(unref(error.$message))),
  ...server.messages(field),
]

function press(key: KeypadKey) {
  entry.value = pressKey(entry.value, key)
  server.clear('amount')
}

function keyOf(event: KeyboardEvent): KeypadKey | undefined {
  if (isDigit(event.key)) return event.key
  if (event.key === 'Backspace') return 'backspace'
  if (event.key === ',' || event.key === '.') return 'decimal'
  return undefined
}

function onKeydown(event: KeyboardEvent) {
  if (dateOpen.value || accountOpen.value || event.ctrlKey || event.metaKey || event.altKey) return
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
  const key = keyOf(event)
  if (!key) return
  event.preventDefault()
  press(key)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function pickDate(value: unknown) {
  if (!(value instanceof Date)) return
  date.value = fromLocalDate(value)
  dateOpen.value = false
}

function pickAccount(id: string) {
  accountId.value = id
  accountOpen.value = false
}

function retry() {
  if (categories.isError.value) categories.refetch()
  if (accounts.isError.value) accounts.refetch()
}

async function save() {
  server.clear()
  if (!(await v$.value.$validate())) {
    await nextTick()
    focusFirstInvalid(rootEl.value)
    return
  }
  create.mutate(
    {
      kind: kind.value,
      date: date.value,
      categoryId: categoryId.value as string,
      accountId: accountId.value as string,
      amount: amount.value,
      currency: currency.value,
    },
    {
      onSuccess: () => {
        notify.success(t('transactions.toast.created'))
        emit('done')
      },
      onError: async (error) => {
        if (server.apply(error, fields)) {
          await nextTick()
          focusFirstInvalid(rootEl.value)
        } else notify.error(error)
      },
    },
  )
}
</script>

<template>
  <div ref="rootEl" class="flex flex-auto flex-col gap-3.5">
    <header class="flex items-center justify-between">
      <button
        type="button"
        class="flex size-11 items-center justify-center rounded-xl bg-bg text-ink"
        :aria-label="t('transactions.add.close')"
        @click="emit('close')"
      >
        <AppIcon name="close" :stroke-width="2" />
      </button>
      <h1 class="m-0 text-[17px] font-semibold">{{ t('navigation.addTransaction') }}</h1>
      <span class="size-11" aria-hidden="true" />
    </header>
    <ErrorState v-if="loadError" @retry="retry" />
    <div v-else-if="noAccounts" class="flex flex-col items-start gap-3 py-6">
      <p class="m-0 text-sm text-muted">{{ t('transactions.dialog.noAccounts') }}</p>
      <NuxtLinkLocale to="/accounts" class="text-sm font-semibold text-accent">
        {{ t('transactions.dialog.goToAccounts') }}
      </NuxtLinkLocale>
    </div>
    <template v-else>
      <div role="group" :aria-label="t('transactions.dialog.kind')" class="grid grid-cols-2 rounded-xl bg-bg p-0.75">
        <button
          v-for="option in categoryKinds"
          :key="option"
          type="button"
          :aria-pressed="kind === option"
          class="min-h-11 rounded-(--radius-control) text-sm"
          :class="kind === option ? 'bg-surface font-semibold text-ink' : 'font-medium text-muted'"
          @click="kind = option"
        >
          {{ t(`transactions.kindSingle.${option}`) }}
        </button>
      </div>
      <div class="flex flex-col items-center gap-1 py-1.5">
        <span id="quick-add-amount-label" class="text-xs font-medium text-muted">{{ t('transactions.add.amount') }}</span>
        <output
          id="quick-add-amount"
          tabindex="-1"
          aria-labelledby="quick-add-amount-label"
          aria-live="polite"
          :aria-invalid="errorsOf('amount').length > 0 || undefined"
          :aria-describedby="errorsOf('amount').length > 0 ? 'quick-add-amount-error' : undefined"
          class="font-mono text-[44px] font-medium tracking-tight"
          :class="kind === 'income' ? 'text-accent' : 'text-ink'"
        >
          {{ amountText }}
        </output>
        <p v-if="errorsOf('amount').length > 0" id="quick-add-amount-error" class="m-0 text-xs font-medium text-accent">
          {{ errorsOf('amount')[0] }}
        </p>
      </div>
      <div class="flex flex-col gap-1.5">
        <h2 id="quick-add-categories" class="sr-only">{{ t('transactions.add.categories') }}</h2>
        <div v-if="categories.isPending.value" class="grid grid-cols-4 gap-2" aria-hidden="true">
          <Skeleton v-for="index in 8" :key="index" height="3.25rem" border-radius="12px" />
        </div>
        <div
          v-else
          role="group"
          aria-labelledby="quick-add-categories"
          tabindex="-1"
          :aria-invalid="errorsOf('categoryId').length > 0 || undefined"
          class="grid grid-cols-4 gap-2"
        >
          <button
            v-for="category in tiles"
            :key="category.id"
            type="button"
            :aria-pressed="categoryId === category.id"
            class="min-h-13 rounded-xl border px-1 text-xs font-semibold break-words"
            :class="
              categoryId === category.id ? 'border-accent bg-accent text-on-accent' : 'border-border bg-surface text-ink'
            "
            @click="categoryId = category.id"
          >
            {{ category.name }}
          </button>
        </div>
        <p v-if="errorsOf('categoryId').length > 0" class="m-0 text-xs font-medium text-accent">
          {{ errorsOf('categoryId')[0] }}
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-[13px] font-medium text-ink"
          :aria-label="t('transactions.add.dateButton', { value: dateLabel })"
          @click="dateOpen = true"
        >
          <AppIcon name="calendar" :size="16" class="text-muted" />
          <span class="truncate">{{ dateLabel }}</span>
        </button>
        <button
          type="button"
          class="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-[13px] font-medium text-ink"
          :aria-label="t('transactions.add.accountButton', { value: account?.name ?? '' })"
          :aria-invalid="errorsOf('accountId').length > 0 || undefined"
          @click="accountOpen = true"
        >
          <AppIcon name="accounts" :size="16" class="text-muted" />
          <span class="truncate">{{ account?.name }}</span>
        </button>
      </div>
      <QuickAddKeypad class="mt-auto" :decimal-separator="separator" @press="press" />
      <Button
        :label="t('shared.actions.save')"
        class="min-h-13 w-full text-[15px]"
        :loading="create.isPending.value"
        :disabled="create.isPending.value"
        @click="save"
      />
    </template>
    <Drawer
      v-model:visible="dateOpen"
      position="bottom"
      :header="t('transactions.add.chooseDate')"
      class="h-auto! rounded-t-(--radius-panel)"
    >
      <DatePicker :model-value="toLocalDate(date)" inline :max-date="maxDate" class="w-full" @update:model-value="pickDate" />
    </Drawer>
    <Drawer
      v-model:visible="accountOpen"
      position="bottom"
      :header="t('transactions.add.chooseAccount')"
      class="h-auto! rounded-t-(--radius-panel)"
    >
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        <li v-for="option in accounts.activeAccounts.value" :key="option.id">
          <button
            type="button"
            :aria-pressed="option.id === accountId"
            class="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left text-sm font-medium"
            :class="option.id === accountId ? 'border-accent text-ink' : 'border-border text-ink'"
            @click="pickAccount(option.id)"
          >
            <span>{{ option.name }}</span>
            <span class="font-mono text-xs text-muted">{{ option.currency }}</span>
          </button>
        </li>
      </ul>
    </Drawer>
  </div>
</template>
```

- [ ] **Step 6: Write the page**

Replace `app/pages/transactions/new.vue`:

```vue
<script setup lang="ts">
definePageMeta({ layout: 'focus' })

const { t } = useI18n()
const router = useRouter()
const localePath = useLocalePath()

function leave(fallback: string) {
  if (window.history.state?.back) router.back()
  else navigateTo(localePath(fallback))
}

useHead({ title: () => t('navigation.addTransaction') })
</script>

<template>
  <QuickAddForm @close="leave('/')" @done="leave('/transactions')" />
</template>
```

- [ ] **Step 7: Run the E2E tests to verify they pass**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/scripts/tx-e2e.sh tests/e2e/transactionsMobile.spec.ts tests/e2e/navigation.spec.ts`
Expected: PASS.

- [ ] **Step 8: Lint, typecheck, commit**

Run: `bunx biome check --write app/layouts app/features/transactions app/pages/transactions tests/e2e/transactionsMobile.spec.ts && bun run lint && bun run typecheck 2>&1 | grep -c "error TS"` → lint clean, `0`.

```bash
git add app/layouts app/features/transactions app/pages/transactions tests/e2e/transactionsMobile.spec.ts
git commit -m "feat: full-screen mobile add screen with a numeric keypad"
```

---

### Task 8: Pull request

- [ ] Rebase on `origin/develop`, fold fix commits into their task commits, verify the tree is unchanged.
- [ ] Run `bun run lint`, `bun run typecheck`, `bun test tests/unit`, `bun run build`, and the full E2E suite (`tx-e2e.sh` with no arguments).
- [ ] `git push --force-with-lease -u origin feature/transactions`, open the PR to `develop` with `gh pr create` (title `feat: transactions list, filters, dialog, mobile add screen and CSV export`, body below), wait for `check-source-branch`, then `gh pr merge <n> --rebase`.

PR body:

```markdown
## What changed and why

- Transactions per user in the mock backend: expense or income, amount and currency as entered, the amount in the account currency and in the base currency. Saving takes the exchange rate for the transaction date unless a corrected one is sent, and the stored amounts never change afterwards.
- `GET/POST /v1/transactions` with search, category, account, type and date filters, paging and sorting by date or amount, plus `GET/PUT/DELETE /v1/transactions/{id}`. Validation covers ownership, matching category type, positive amounts, dates at most a year ahead and archived accounts.
- Account balances and category usage now include transactions; deleting a category moves its transactions to "other".
- About six months of history for both demo users (Anna in PLN with a few EUR payments, Oleh in UAH with some USD). Opening balances are derived so today's balances stay as before.
- The transactions screen: filters, a found/total summary, a sortable table, "show more", row click to edit and CSV export of everything that matches the filters. On phones the list is grouped by day and the filters live in a drawer.
- A dialog to add, edit and delete transactions, opened from the header and from a new "New transaction" button in the sidebar, with the exchange rate prefilled for the date.
- The bottom navigation "+" opens a full-screen add screen with a numeric keypad, category tiles, date and account pickers.

## How to test

1. `bun install`, `bun run dev`, open `/transactions`.
2. Switch the period to "All time", search for "Lidl", filter by type and category, sort by amount and date, load more.
3. Add a transaction from the header in EUR on the main card, correct the rate, check the account balance on `/accounts`; edit it and delete it from its row.
4. Export CSV and open the file.
5. At phone width: cards grouped by day, filters in the drawer, "+" in the bottom navigation, enter an amount on the keypad and save.
6. Repeat in `/pl`, `/ru`, `/uk` and in the dark theme.
7. `bun test tests/unit` and the Playwright suite pass.
```
