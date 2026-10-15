# Frontend on mocks — design

Date: 2026-10-15
Status: approved in conversation, pending written review

## Goal

Implement every screen of the Claude Design project "Mita — финансовый планер" (https://claude.ai/artifact/W7Jn2A5ccqeaw91PAtw5JH) on top of a mock backend, so that replacing the mocks with the real .NET API later requires no changes in components, composables or feature API modules.

Success means:

- every screen and flow from the design works in light and dark theme, on desktop and mobile, in `en`, `pl`, `ru`, `uk`;
- data changes persist across reloads and behave like a real API (balances, conversions, budgets and reports react to every change);
- switching `NUXT_PUBLIC_API_MOCKS` to `false` only swaps the transport.

Out of scope: login and registration (not in the design), bank statement import (button shows "coming soon"), sending notifications (preferences are stored only), recurring transactions.

## Decisions

| Topic | Decision |
|---|---|
| CSV export | Built in the browser by paging through `GET /v1/transactions` with the active filters; no export endpoint |
| Mock persistence | Full CRUD in the browser, stored in `localStorage`, with a "reset demo data" action |
| Side features | CSV export works client-side; PDF export through `window.print()` with print styles; categories have full CRUD; notification toggles are stored only; profile, base currency and financial month start are functional; statement import is deferred; "delete account" clears demo data after confirmation |
| Currency | Each account has a currency. A transaction may be entered in any currency and is converted into the account currency. Totals are shown in the user's base currency |
| Exchange rates | Mocked rates service (`GET /v1/rates`) with a realistic, slowly changing table; the rate is prefilled and can be corrected by hand |
| Charts | PrimeVue `Chart` (Chart.js) with design tokens; horizontal category bars stay plain HTML |
| Mock architecture | One feature API, two transports (`http`, `mock`); business rules live in mock handlers |
| Users | Every user-owned record carries `userId`; two demo users in the mock database |

## 1. Domain model

All amounts are integers in minor units (grosze, cents). Formatting always goes through `n()` with the currency.

| Entity | Fields |
|---|---|
| `User` | `id`, `name`, `email`, `createdAt` |
| `Settings` | `userId` (1:1), `baseCurrency`, `locale`, `monthStartDay` (1–28 or `lastWorkingDay`), `theme`, `notifications` (`budgetLimit`, `dailyReminder`, `weeklyReport`, `goals`) |
| `Account` | `id`, `userId`, `name`, `type` (`card` / `cash` / `savings`), `currency`, `openingBalance`, `balance` (computed by the backend), `cardLast4?`, `archived` |
| `Category` | `id`, `userId`, `name`, `kind` (`expense` / `income`), `color` (chart token), `system` (`transfer`, `other` cannot be deleted) |
| `Transaction` | `id`, `userId`, `kind` (`expense` / `income`), `date`, `title`, `note?`, `categoryId`, `accountId`, `amount`, `currency` (as entered), `accountAmount` (account currency), `rate`, `baseAmount` (base currency) |
| `Transfer` | `id`, `userId`, `date`, `fromAccountId`, `toAccountId`, `fromAmount`, `toAmount`, `rate`, `note?` |
| `Budget` | `id`, `userId`, `categoryId`, `period` (`YYYY-MM` of the financial period start), `limit` (base currency) |
| `Goal` | `id`, `userId`, `name`, `target`, `saved` (base currency), `deadline?`, `accountId?` |
| `GoalContribution` | `id`, `userId`, `goalId`, `date`, `amount`, `fromAccountId?` |
| `Rate` | `date`, `from`, `to`, `value` (global, no `userId`) |

### Rules

- Saving a transaction resolves the rate for its date (or takes the corrected one) and stores `accountAmount` and `baseAmount`, so history never changes when rates change.
- Account balances are computed by the backend: opening balance plus transactions and transfers. The frontend never computes balances.
- Transfers are neither income nor expense; they are excluded from budgets and reports. A cross-currency transfer stores its own rate.
- A goal contribution is a transfer to the goal's savings account when the goal has one; otherwise it only increases `saved`.
- The financial period follows `monthStartDay`: with day 10, "October" is 10.10–09.11. Overview, budgets and reports work on periods.
- Budget status: below 85% "on track", 85–100% "almost spent", above 100% "over budget". "≈ X per day" is the remaining amount divided by the days left in the period.
- Goal hint "save X per month" is the remaining amount divided by the months to the deadline; no hint without a deadline.

### Access

- The frontend never sends `userId`. The current user comes from the session; in mocks it is the active demo user, exposed through `GET /v1/me`.
- Every handler filters by the session `userId`. A foreign or missing id returns `404`.
- Referenced account and category must belong to the same user, otherwise `400` with a field error.
- Each new user gets a starter set of categories they can edit.

## 2. Architecture

```
app/
  shared/
    api/
      client.ts            apiClient.request(method, path, { query, body })
      transports/http.ts   $fetch to apiBaseUrl, credentials, Accept-Language
      transports/mock.ts   dispatches to the mock router
      problem.ts           ApiError from RFC 9457 ProblemDetails
      contract.ts          request and response types (later generated)
    money/                 minor units, conversion, rounding, sums
    period/                financial periods from monthStartDay
  features/<feature>/
    api/<feature>Api.ts    typed calls only
    api/keys.ts            query keys
    composables/           useQuery / useMutation wrappers
    components/            screen sections
    schemas/               Vuelidate rules
mocks/
  db.ts                    localStorage tables (mita-mock-db-v1), seed, reset, active demo user
  seed/                    two demo users, ~6 months of data, rate table
  router.ts                METHOD + path → handler, 150–400 ms latency
  handlers/<feature>.ts    business rules and aggregates
  validation.ts            ProblemDetails with field errors
```

Data flow: component → feature composable → TanStack Query → `<feature>Api` → `apiClient` → transport. In mock mode the transport calls `router` → handler → `db`.

- Aggregates come from the backend: `GET /v1/overview?period=`, `GET /v1/reports?range=3m|6m|12m`, budget statuses in `GET /v1/budgets?period=`.
- One invalidation map lists which queries each mutation affects (for example creating a transaction invalidates transactions, accounts, budgets, overview, reports).
- Paths are versioned (`/v1/...`). Lists return `{ items, page, pageSize, total }`; transactions use `useInfiniteQuery` for "show more".
- In mock mode data queries run on the client only; the server renders the layout and skeletons. With the real API the same queries can be prefetched on the server.
- `mocks/` is loaded with a dynamic import only when the flag is on, so it is not part of the production bundle otherwise.
- Settings are loaded once at startup into `useUserSettings()`; money formatting, periods and locale read from it.

### Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/me` | current user |
| GET, PUT | `/v1/settings` | |
| GET | `/v1/rates?date=&from=&to=` | |
| GET, POST | `/v1/accounts` | |
| PUT, DELETE | `/v1/accounts/{id}` | delete only without transactions; otherwise archive via PUT |
| GET, POST | `/v1/transfers` | |
| GET, POST | `/v1/categories` | |
| PUT, DELETE | `/v1/categories/{id}` | system categories cannot be deleted; used ones are reassigned to "other" |
| GET, POST | `/v1/transactions` | filters: `search`, `categoryId`, `accountId`, `kind`, `from`, `to`, `page`, `pageSize`, `sort` |
| GET, PUT, DELETE | `/v1/transactions/{id}` | |
| GET, POST | `/v1/budgets?period=` | includes spent, status and per-day hint |
| PUT, DELETE | `/v1/budgets/{id}` | |
| GET, POST | `/v1/goals` | |
| PUT, DELETE | `/v1/goals/{id}` | |
| POST | `/v1/goals/{id}/contributions` | |
| GET | `/v1/overview?period=` | |
| GET | `/v1/reports?range=` | |
| POST | `/v1/demo/reset`, `/v1/demo/switch-user` | mock mode only |

## 3. Screens

Shared components in `shared/components`, added once three features need them: `StatCard`, `ProgressBar`, `MoneyText`, `SegmentedControl`, `PeriodSwitcher`, `EmptyState`, `ErrorState`, skeletons.

| Screen | Desktop | Mobile (below `lg`) |
|---|---|---|
| Overview `/` | four stat cards, spending donut with legend and change vs previous period, quick add panel, budgets, recent transactions, goals | balance card "left this month", "you can spend per day", three budgets, today's transactions |
| Transactions `/transactions` | filters (search, category, account, kind, period), found/total summary, TanStack Table sorted by date and amount, "show more", CSV export, row opens edit dialog | cards grouped by day, filters in a drawer |
| New / edit transaction | `Dialog`: kind, amount, currency, rate (prefilled, editable), category, account, date, note; delete when editing | full screen `/transactions/new` as designed: keypad, category tiles, date, account |
| Budgets `/budgets` | period switcher, dark summary card, category cards with status, new budget and edit limit in `Dialog`, "add category" tile | single column |
| Goals `/goals` | three stat cards, goal cards, contribute dialog (amount, from account), edit, new goal | as designed |
| Accounts `/accounts` | total in base currency, account cards (savings dark), split bar, transfers list, transfer and add account dialogs, archive instead of delete when used | single column |
| Reports `/reports` | 3 / 6 / 12 months, three stat cards, income vs expense bars (Chart), spending structure, PDF via print | as designed |
| Settings `/settings` | profile, currency and region (base currency, language, month start, theme), notifications, data (CSV export, import "coming soon", manage categories, delete account); in mock mode: demo user switch, reset data, simulate network errors | single column |

PrimeVue components used: `Dialog`, `Drawer`, `Select`, `SelectButton`, `InputNumber`, `DatePicker`, `ToggleSwitch`, `Toast`, `ConfirmDialog`, `Skeleton`, `Chart`. Styling comes from the Mita preset only.

## 4. Forms and errors

- Vuelidate rules in `features/<x>/schemas`; messages are i18n keys through `helpers.withMessage`.
- Errors appear after blur or submit, with `aria-invalid` and `aria-describedby`; focus moves to the first invalid field. Submit is disabled while the mutation runs.
- Mock handlers validate like FluentValidation and return `400` ProblemDetails with field errors: ownership of account and category, category kind matches transaction kind, amount above zero, date at most one year ahead, transfer between two different accounts, used accounts can only be archived.
- `ApiError` field errors are mapped onto the form; the rest goes to `Toast`.

| Situation | Behaviour |
|---|---|
| Loading | section-shaped `Skeleton`, no layout shift |
| Query error | `ErrorState` in the section with retry; the rest of the page works |
| Mutation error | `Toast` with the ProblemDetails title; the form stays open with its data |
| 404 | `error.vue` in the app style |
| No data | `EmptyState` with an action |
| Delete | `ConfirmDialog`, then `Toast` |

Mock mode adds a "simulate network errors" switch in Settings that returns `500` with a set probability.

## 5. Testing and delivery

| Level | Tool | Scope |
|---|---|---|
| Unit | `bun test` | `money`, `period` (start days, year boundary, last working day), mock handler rules (balances, conversions, budget statuses, goal hint, `userId` isolation), mock router, ProblemDetails mapping |
| E2E | Playwright in the official container, desktop and mobile | one scenario per screen plus: EUR expense from a PLN card updates balance, overview and budget; transfer; goal contribution; month start shifts the period; language and theme; isolation of the two demo users |
| Static | Biome, `nuxt typecheck` | everything |

Each step is its own branch and pull request into `develop`, merged with rebase:

1. `feature/api-foundation` — `apiClient`, transports, `ApiError`, `money`, `period`, mock database with seed and two users, router, `/v1/me` and settings, `useUserSettings`, shared components
2. `feature/accounts` — accounts, transfers, rates
3. `feature/categories` — categories and the management dialog
4. `feature/transactions` — list, filters, dialog, mobile screen, CSV
5. `feature/budgets`
6. `feature/goals`
7. `feature/overview` — aggregates, donut, quick add
8. `feature/reports` — Chart, print to PDF
9. `feature/settings` — full settings, demo user switch, reset, error simulation

Every pull request: design parity in both themes and both layouts, keys in all four locales, tests, and green Biome, typecheck, `bun test` and E2E.
