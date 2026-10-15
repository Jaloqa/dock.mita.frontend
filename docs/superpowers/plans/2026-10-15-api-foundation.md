# API Foundation Implementation Plan

**Goal:** Build the data foundation every screen depends on: money and period utilities, a typed API client with `http` and `mock` transports, a `localStorage` mock backend with two demo users, user and settings endpoints, and the shared UI building blocks.

**Architecture:** Feature code calls `apiClient`; the transport is chosen once in a Nuxt plugin from `runtimeConfig.public.apiMocks`. The mock transport lives in `mocks/` (outside `app/`), is loaded with a dynamic import, routes `/v1/...` requests to handlers that work on a `localStorage` database and answers like the future .NET API (ProblemDetails, session `userId`).

**Tech Stack:** Nuxt 4, TypeScript strict, TanStack Query (`@tanstack/vue-query`), vue-i18n via `@nuxtjs/i18n`, PrimeVue 4, Tailwind 4, Bun (`bun test`), Biome.

**Spec:** `docs/superpowers/specs/2026-10-15-frontend-mocks-design.md` (sections 1, 2 and the first delivery step of section 5).

## Global Constraints

- Code, identifiers, commit messages in English; no comments except for a genuinely controversial decision.
- Amounts are integers in minor units; formatting only through `n()` with the currency.
- API paths start with `/v1/`; errors are RFC 9457 ProblemDetails; validation messages are i18n keys (for example `validation.required`).
- The frontend never sends `userId`; mock handlers take it from the active demo user.
- Every user-facing string goes through i18n with keys in `en`, `pl`, `ru`, `uk`.
- Only libraries from `docs/STACK.md`; PrimeVue stays on 4.x.
- Dates in the domain are ISO strings `YYYY-MM-DD`; period math uses UTC so the user's time zone never shifts a date.
- Unit tests with `bun test` in `tests/unit/**`; code under `mocks/` and `app/shared/{money,period,api}` must not use Nuxt auto-imports (plain imports only) so it runs in Bun.
- Biome and `nuxt typecheck` must pass before every commit.

## Review Focus

- `localStorage` holds corrupted or outdated JSON (manual edits, older version) — the app must start with fresh seed data instead of crashing. Pinned in Task 4.
- `localStorage` is unavailable (private window, blocked storage, server render) — the mock database works in memory. Pinned in Task 4.
- A real backend answers an error without ProblemDetails (HTML 502 from a proxy, empty body) — the client still throws a typed `ApiError` with the status. Pinned in Task 3.
- Currency conversion of amounts that land exactly on half a minor unit, including negatives — rounds half away from zero and never yields `-0`. Pinned in Task 1.
- Financial periods whose start falls on a weekend or crosses a year boundary — dates land in exactly one period. Pinned in Task 2.

---

## File map

| File | Responsibility |
|---|---|
| `app/shared/money/money.ts` | Currency list, minor-unit conversion, rate conversion, sums |
| `app/shared/period/period.ts` | Financial periods from `monthStartDay`, ISO date helpers |
| `app/shared/api/problem.ts` | `ProblemDetails`, `ApiError`, field error helpers |
| `app/shared/api/transport.ts` | `ApiRequest`, `Transport` types |
| `app/shared/api/client.ts` | `createApiClient(transport)` |
| `app/shared/api/transports/http.ts` | Real HTTP transport over an injected fetcher |
| `app/shared/api/transports/mock.ts` | Lazy loader of the mock transport |
| `app/shared/api/contract.ts` | DTOs shared with the backend contract |
| `app/shared/api/invalidation.ts` | Which queries each kind of data change invalidates |
| `app/shared/user/userApi.ts`, `keys.ts`, `useUserSettings.ts`, `useCurrentUser.ts` | Current user and settings data |
| `app/shared/composables/useApi.ts`, `useMoney.ts` | Access to the client, money formatting |
| `app/plugins/api.ts` | Chooses the transport, provides `$api` |
| `app/plugins/vue-query.ts` | Disables server-side queries in mock mode |
| `app/shared/components/MoneyText.vue`, `StatCard.vue`, `ProgressBar.vue`, `PeriodSwitcher.vue`, `EmptyState.vue`, `ErrorState.vue` | Shared building blocks |
| `mocks/db.ts` | State shape, load/save/reset over a key-value storage |
| `mocks/seed/users.ts`, `mocks/seed/index.ts` | Demo users and their settings |
| `mocks/router.ts` | Route matching with `:params` |
| `mocks/errors.ts` | `MockHttpError`, `notFound`, `badRequest` |
| `mocks/api.ts` | `createMockApi`: router + db + error simulation |
| `mocks/transport.ts` | `createMockTransport`: latency + `MockHttpError` to `ApiError` |
| `mocks/handlers/users.ts`, `mocks/handlers/demo.ts` | `/v1/me`, `/v1/settings`, `/v1/demo/*` |

All shell commands run inside WSL in `~/dock.mita.frontend` on branch `feature/api-foundation`.

---

### Task 1: Money utilities

**Files:**
- Create: `app/shared/money/money.ts`
- Test: `tests/unit/shared/money.test.ts`

**Interfaces:**
- Produces: `type Currency = 'PLN' | 'EUR' | 'USD' | 'UAH'`, `currencies: readonly Currency[]`, `toMinor(major: number): number`, `fromMinor(minor: number): number`, `convertMinor(minor: number, rate: number): number`, `sumMinor(values: readonly number[]): number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test'
import { convertMinor, currencies, fromMinor, sumMinor, toMinor } from '../../../app/shared/money/money'

describe('money', () => {
  it('lists the supported currencies', () => {
    expect(currencies).toEqual(['PLN', 'EUR', 'USD', 'UAH'])
  })

  it.each([
    [12.34, 1234],
    [1.005, 101],
    [0.1 + 0.2, 30],
    [-2.5, -250],
    [0, 0],
  ])('toMinor(%d) = %d', (major, minor) => {
    expect(toMinor(major)).toBe(minor)
  })

  it('converts minor units back to major units', () => {
    expect(fromMinor(123456)).toBe(1234.56)
  })

  it.each([
    [1000, 4.2537, 4254],
    [5, 0.5, 3],
    [-5, 0.5, -3],
    [1, 0.4, 0],
    [-1, 0.4, 0],
  ])('convertMinor(%d, %d) = %d', (minor, rate, expected) => {
    expect(convertMinor(minor, rate)).toBe(expected)
  })

  it('never returns negative zero', () => {
    expect(Object.is(convertMinor(-1, 0.4), 0)).toBe(true)
  })

  it('sums minor units', () => {
    expect(sumMinor([100, -50, 25])).toBe(75)
    expect(sumMinor([])).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/shared/money.test.ts`
Expected: FAIL, cannot resolve `app/shared/money/money`.

- [ ] **Step 3: Write minimal implementation**

```ts
export type Currency = 'PLN' | 'EUR' | 'USD' | 'UAH'

export const currencies: readonly Currency[] = ['PLN', 'EUR', 'USD', 'UAH']

function roundHalfAwayFromZero(value: number): number {
  const stabilized = Math.round(Math.abs(value) * 1e6) / 1e6
  const rounded = Math.round(stabilized)
  if (rounded === 0) return 0
  return value < 0 ? -rounded : rounded
}

export const toMinor = (major: number): number => roundHalfAwayFromZero(major * 100)

export const fromMinor = (minor: number): number => minor / 100

export const convertMinor = (minor: number, rate: number): number => roundHalfAwayFromZero(minor * rate)

export const sumMinor = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/unit/shared/money.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
bun run lint
git add app/shared/money/money.ts tests/unit/shared/money.test.ts
git commit -m "feat: money utilities in minor units"
```

---

### Task 2: Financial periods

**Files:**
- Create: `app/shared/period/period.ts`
- Test: `tests/unit/shared/period.test.ts`

**Interfaces:**
- Produces: `type MonthStart = number | 'lastWorkingDay'` (number is 1–28), `type Period = { key: string; from: string; to: string }` (`key` is `YYYY-MM`, `from`/`to` inclusive ISO dates), `toIsoDate(date: Date): string` (UTC), `todayIso(): string`, `periodByKey(key: string, start: MonthStart): Period`, `periodFor(date: string, start: MonthStart): Period`, `shiftPeriod(key: string, months: number, start: MonthStart): Period`, `daysLeft(period: Period, today: string): number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test'
import { daysLeft, periodByKey, periodFor, shiftPeriod, toIsoDate } from '../../../app/shared/period/period'

describe('period', () => {
  it('formats dates in UTC', () => {
    expect(toIsoDate(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05')
  })

  it('uses calendar months when the period starts on the 1st', () => {
    expect(periodFor('2026-10-14', 1)).toEqual({ key: '2026-10', from: '2026-10-01', to: '2026-10-31' })
  })

  it('puts days before the start day into the previous period', () => {
    expect(periodFor('2026-10-05', 10)).toEqual({ key: '2026-09', from: '2026-09-10', to: '2026-10-09' })
    expect(periodFor('2026-10-10', 10)).toEqual({ key: '2026-10', from: '2026-10-10', to: '2026-11-09' })
  })

  it('crosses the year boundary', () => {
    expect(periodFor('2027-01-05', 10)).toEqual({ key: '2026-12', from: '2026-12-10', to: '2027-01-09' })
    expect(shiftPeriod('2026-12', 1, 1)).toEqual({ key: '2027-01', from: '2027-01-01', to: '2027-01-31' })
    expect(shiftPeriod('2027-01', -1, 1).key).toBe('2026-12')
  })

  it('starts on the last working day of the previous month', () => {
    expect(periodByKey('2026-10', 'lastWorkingDay')).toEqual({ key: '2026-10', from: '2026-09-30', to: '2026-10-29' })
  })

  it('assigns the days after a weekend-shifted start to the next period', () => {
    expect(periodFor('2026-10-30', 'lastWorkingDay').key).toBe('2026-11')
    expect(periodFor('2026-10-29', 'lastWorkingDay').key).toBe('2026-10')
  })

  it('places every day of a year in exactly one period', () => {
    for (const start of [1, 10, 28, 'lastWorkingDay'] as const) {
      const day = new Date(Date.UTC(2026, 0, 1))
      while (day.getUTCFullYear() === 2026) {
        const iso = toIsoDate(day)
        const period = periodFor(iso, start)
        expect(iso >= period.from && iso <= period.to).toBe(true)
        day.setUTCDate(day.getUTCDate() + 1)
      }
    }
  })

  it('counts the days left including today', () => {
    const october = periodByKey('2026-10', 1)
    expect(daysLeft(october, '2026-10-14')).toBe(18)
    expect(daysLeft(october, '2026-10-31')).toBe(1)
    expect(daysLeft(october, '2026-11-02')).toBe(0)
    expect(daysLeft(october, '2026-09-20')).toBe(31)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/shared/period.test.ts`
Expected: FAIL, cannot resolve `app/shared/period/period`.

- [ ] **Step 3: Write minimal implementation**

```ts
export type MonthStart = number | 'lastWorkingDay'

export type Period = { key: string; from: string; to: string }

const DAY_MS = 86_400_000

const pad = (value: number) => String(value).padStart(2, '0')

export const toIsoDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`

export const todayIso = (): string => {
  const now = new Date()
  return toIsoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

const parseIsoDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1))
}

const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS)

function lastWorkingDayOf(year: number, monthIndex: number): Date {
  let day = new Date(Date.UTC(year, monthIndex + 1, 0))
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day = addDays(day, -1)
  return day
}

function startOf(year: number, monthIndex: number, start: MonthStart): Date {
  return start === 'lastWorkingDay' ? lastWorkingDayOf(year, monthIndex - 1) : new Date(Date.UTC(year, monthIndex, start))
}

const keyOf = (date: Date): string => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`

export function periodByKey(key: string, start: MonthStart): Period {
  const [year, month] = key.split('-').map(Number)
  const monthIndex = (month ?? 1) - 1
  const from = startOf(year ?? 0, monthIndex, start)
  const to = addDays(startOf(year ?? 0, monthIndex + 1, start), -1)
  return { key, from: toIsoDate(from), to: toIsoDate(to) }
}

export function periodFor(date: string, start: MonthStart): Period {
  const day = parseIsoDate(date)
  for (const offset of [0, -1, 1]) {
    const label = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + offset, 1))
    const period = periodByKey(keyOf(label), start)
    if (date >= period.from && date <= period.to) return period
  }
  throw new RangeError(`No financial period contains ${date}`)
}

export function shiftPeriod(key: string, months: number, start: MonthStart): Period {
  const [year, month] = key.split('-').map(Number)
  return periodByKey(keyOf(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1 + months, 1))), start)
}

export function daysLeft(period: Period, today: string): number {
  if (today > period.to) return 0
  const from = today < period.from ? period.from : today
  return Math.round((parseIsoDate(period.to).getTime() - parseIsoDate(from).getTime()) / DAY_MS) + 1
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/unit/shared/period.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
bun run lint
git add app/shared/period/period.ts tests/unit/shared/period.test.ts
git commit -m "feat: financial periods from the month start day"
```

---

### Task 3: API errors, client and HTTP transport

**Files:**
- Create: `app/shared/api/problem.ts`, `app/shared/api/transport.ts`, `app/shared/api/client.ts`, `app/shared/api/transports/http.ts`
- Test: `tests/unit/shared/api.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ProblemDetails = { type?: string; title: string; status: number; detail?: string; errors?: Record<string, string[]> }`
  - `class ApiError extends Error { status: number; title: string; fieldErrors: Record<string, string[]> }` with `constructor(problem: ProblemDetails)`; field keys normalized to camelCase.
  - `isApiError(value: unknown): value is ApiError`, `toApiError(status: number, body: unknown): ApiError`, `fieldErrorsOf(error: unknown, field: string): string[]`
  - `type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'`, `type QueryValue = string | number | boolean | undefined`, `type ApiRequest = { method: HttpMethod; path: string; query?: Record<string, QueryValue>; body?: unknown }`, `type Transport = (request: ApiRequest) => Promise<unknown>`
  - `type ApiClient = { get<T>(path: string, query?: ApiRequest['query']): Promise<T>; post<T>(path: string, body?: unknown): Promise<T>; put<T>(path: string, body?: unknown): Promise<T>; delete<T = void>(path: string): Promise<T> }`, `createApiClient(transport: Transport): ApiClient`
  - `type Fetcher = (url: string, options: { method: HttpMethod; query?: Record<string, string | number | boolean>; body?: unknown; headers: Record<string, string>; credentials: 'include' }) => Promise<unknown>`, `createHttpTransport(fetcher: Fetcher, options: { baseUrl: string; locale: () => string }): Transport`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test'
import { createApiClient } from '../../../app/shared/api/client'
import { ApiError, fieldErrorsOf, isApiError, toApiError } from '../../../app/shared/api/problem'
import type { ApiRequest } from '../../../app/shared/api/transport'
import { type Fetcher, createHttpTransport } from '../../../app/shared/api/transports/http'

describe('ApiError', () => {
  it('keeps ProblemDetails and normalizes field names to camelCase', () => {
    const error = toApiError(400, {
      title: 'Validation failed',
      status: 400,
      errors: { Amount: ['validation.amountPositive'], categoryId: ['validation.required'] },
    })
    expect(isApiError(error)).toBe(true)
    expect(error.status).toBe(400)
    expect(error.title).toBe('Validation failed')
    expect(error.fieldErrors).toEqual({ amount: ['validation.amountPositive'], categoryId: ['validation.required'] })
  })

  it('falls back to a generic error when the body is not ProblemDetails', () => {
    expect(toApiError(502, '<html>Bad gateway</html>')).toMatchObject({ status: 502, title: 'Server error' })
    expect(toApiError(404, undefined)).toMatchObject({ status: 404, title: 'Request failed', fieldErrors: {} })
  })

  it('reads field errors from any value', () => {
    const error = new ApiError({ title: 'Invalid', status: 400, errors: { name: ['validation.required'] } })
    expect(fieldErrorsOf(error, 'name')).toEqual(['validation.required'])
    expect(fieldErrorsOf(error, 'email')).toEqual([])
    expect(fieldErrorsOf(new Error('boom'), 'name')).toEqual([])
  })
})

describe('createApiClient', () => {
  it('maps calls to transport requests', async () => {
    const seen: ApiRequest[] = []
    const client = createApiClient(async (request) => {
      seen.push(request)
      return { ok: true }
    })
    await client.get('/v1/items', { page: 2 })
    await client.post('/v1/items', { name: 'a' })
    await client.put('/v1/items/1', { name: 'b' })
    await client.delete('/v1/items/1')
    expect(seen).toEqual([
      { method: 'GET', path: '/v1/items', query: { page: 2 } },
      { method: 'POST', path: '/v1/items', body: { name: 'a' } },
      { method: 'PUT', path: '/v1/items/1', body: { name: 'b' } },
      { method: 'DELETE', path: '/v1/items/1' },
    ])
  })
})

describe('createHttpTransport', () => {
  it('sends the request with locale, credentials and without undefined query values', async () => {
    const calls: Parameters<Fetcher>[] = []
    const fetcher: Fetcher = async (...args) => {
      calls.push(args)
      return { id: 1 }
    }
    const transport = createHttpTransport(fetcher, { baseUrl: 'https://api.test', locale: () => 'pl' })
    const result = await transport({ method: 'GET', path: '/v1/items', query: { page: 1, search: undefined } })
    expect(result).toEqual({ id: 1 })
    expect(calls[0]).toEqual([
      'https://api.test/v1/items',
      { method: 'GET', query: { page: 1 }, body: undefined, headers: { 'Accept-Language': 'pl' }, credentials: 'include' },
    ])
  })

  it('turns fetch errors with ProblemDetails into ApiError', async () => {
    const fetcher: Fetcher = async () => {
      throw Object.assign(new Error('400'), { status: 400, data: { title: 'Invalid', status: 400, errors: { Name: ['x'] } } })
    }
    const transport = createHttpTransport(fetcher, { baseUrl: '', locale: () => 'en' })
    const error = await transport({ method: 'POST', path: '/v1/items' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).fieldErrors).toEqual({ name: ['x'] })
  })

  it('turns network failures without status into a 503 ApiError', async () => {
    const fetcher: Fetcher = async () => {
      throw new TypeError('fetch failed')
    }
    const transport = createHttpTransport(fetcher, { baseUrl: '', locale: () => 'en' })
    const error = await transport({ method: 'GET', path: '/v1/items' }).catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 503, title: 'Server error' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/shared/api.test.ts`
Expected: FAIL, cannot resolve `app/shared/api/client`.

- [ ] **Step 3: Write `app/shared/api/problem.ts`**

```ts
export type ProblemDetails = {
  type?: string
  title: string
  status: number
  detail?: string
  errors?: Record<string, string[]>
}

const camelCase = (field: string): string => field.charAt(0).toLowerCase() + field.slice(1)

export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly fieldErrors: Record<string, string[]>

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title)
    this.name = 'ApiError'
    this.status = problem.status
    this.title = problem.title
    this.fieldErrors = Object.fromEntries(
      Object.entries(problem.errors ?? {}).map(([field, messages]) => [camelCase(field), messages]),
    )
  }
}

export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError

const isProblemDetails = (value: unknown): value is ProblemDetails =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { status?: unknown }).status === 'number' &&
  typeof (value as { title?: unknown }).title === 'string'

export function toApiError(status: number, body: unknown): ApiError {
  if (isProblemDetails(body)) return new ApiError(body)
  return new ApiError({ status, title: status >= 500 ? 'Server error' : 'Request failed' })
}

export const fieldErrorsOf = (error: unknown, field: string): string[] =>
  isApiError(error) ? (error.fieldErrors[field] ?? []) : []
```

- [ ] **Step 4: Write `app/shared/api/transport.ts`**

```ts
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export type QueryValue = string | number | boolean | undefined

export type ApiRequest = {
  method: HttpMethod
  path: string
  query?: Record<string, QueryValue>
  body?: unknown
}

export type Transport = (request: ApiRequest) => Promise<unknown>
```

- [ ] **Step 5: Write `app/shared/api/client.ts`**

```ts
import type { ApiRequest, Transport } from './transport'

export type ApiClient = {
  get<T>(path: string, query?: ApiRequest['query']): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  put<T>(path: string, body?: unknown): Promise<T>
  delete<T = void>(path: string): Promise<T>
}

export function createApiClient(transport: Transport): ApiClient {
  return {
    get: <T>(path: string, query?: ApiRequest['query']) =>
      transport(query ? { method: 'GET', path, query } : { method: 'GET', path }) as Promise<T>,
    post: <T>(path: string, body?: unknown) => transport({ method: 'POST', path, body }) as Promise<T>,
    put: <T>(path: string, body?: unknown) => transport({ method: 'PUT', path, body }) as Promise<T>,
    delete: <T = void>(path: string) => transport({ method: 'DELETE', path }) as Promise<T>,
  }
}
```

- [ ] **Step 6: Write `app/shared/api/transports/http.ts`**

```ts
import { toApiError } from '../problem'
import type { HttpMethod, QueryValue, Transport } from '../transport'

export type Fetcher = (
  url: string,
  options: {
    method: HttpMethod
    query?: Record<string, string | number | boolean>
    body?: unknown
    headers: Record<string, string>
    credentials: 'include'
  },
) => Promise<unknown>

const definedOnly = (query: Record<string, QueryValue> | undefined) =>
  query
    ? (Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined)) as Record<
        string,
        string | number | boolean
      >)
    : undefined

const statusOf = (error: unknown): number => {
  const status = (error as { status?: unknown; statusCode?: unknown } | null)?.status ??
    (error as { statusCode?: unknown } | null)?.statusCode
  return typeof status === 'number' ? status : 503
}

export function createHttpTransport(fetcher: Fetcher, options: { baseUrl: string; locale: () => string }): Transport {
  return async (request) => {
    try {
      return await fetcher(`${options.baseUrl}${request.path}`, {
        method: request.method,
        query: definedOnly(request.query),
        body: request.body,
        headers: { 'Accept-Language': options.locale() },
        credentials: 'include',
      })
    } catch (error) {
      throw toApiError(statusOf(error), (error as { data?: unknown } | null)?.data)
    }
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `bun test tests/unit/shared/api.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 8: Commit**

```bash
bun run lint
git add app/shared/api tests/unit/shared/api.test.ts
git commit -m "feat: typed API client with ProblemDetails errors and HTTP transport"
```

---

### Task 4: Mock database with demo users

**Files:**
- Create: `app/shared/api/contract.ts`, `mocks/db.ts`, `mocks/seed/users.ts`, `mocks/seed/index.ts`
- Test: `tests/unit/mocks/db.test.ts`

**Interfaces:**
- Consumes: `Currency` (Task 1), `MonthStart` (Task 2).
- Produces:
  - In `app/shared/api/contract.ts`: `type Locale = 'en' | 'pl' | 'ru' | 'uk'`, `type ThemePreference = 'system' | 'light' | 'dark'`, `type NotificationPrefs = { budgetLimit: boolean; dailyReminder: boolean; weeklyReport: boolean; goals: boolean }`, `type UserDto = { id: string; name: string; email: string; createdAt: string }`, `type SettingsDto = { baseCurrency: Currency; locale: Locale; monthStartDay: MonthStart; theme: ThemePreference; notifications: NotificationPrefs }`, `type Page<T> = { items: T[]; page: number; pageSize: number; total: number }`, `type DemoStateDto = { activeUserId: string; users: { id: string; name: string }[]; simulateErrors: boolean }`, `const locales: readonly Locale[]`, `const themePreferences: readonly ThemePreference[]`.
  - In `mocks/db.ts`: `type UserRow = UserDto`, `type SettingsRow = SettingsDto & { userId: string }`, `type MockState = { version: 1; activeUserId: string; simulateErrors: boolean; users: UserRow[]; settings: SettingsRow[] }`, `type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>`, `STORAGE_KEY = 'mita-mock-db-v1'`, `type MockDb = { state: MockState; save(): void; reset(): void }`, `createDb(storage: KeyValueStorage | undefined, seed: () => MockState): MockDb`.
  - In `mocks/seed/index.ts`: `seedState(): MockState` (fresh object each call). Demo user ids: `usr_anna`, `usr_oleh`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test'
import { STORAGE_KEY, createDb, type KeyValueStorage } from '../../../mocks/db'
import { seedState } from '../../../mocks/seed'

const memoryStorage = (initial?: string): KeyValueStorage & { value: string | null } => {
  const store = {
    value: initial ?? null,
    getItem: (key: string) => (key === STORAGE_KEY ? store.value : null),
    setItem: (_key: string, value: string) => {
      store.value = value
    },
  }
  return store
}

describe('mock db', () => {
  it('starts from the seed when storage is empty', () => {
    const db = createDb(memoryStorage(), seedState)
    expect(db.state.activeUserId).toBe('usr_anna')
    expect(db.state.users.map((user) => user.id)).toEqual(['usr_anna', 'usr_oleh'])
    expect(db.state.settings).toHaveLength(2)
  })

  it('gives the two demo users different settings', () => {
    const [anna, oleh] = seedState().settings
    expect(anna).toMatchObject({ userId: 'usr_anna', baseCurrency: 'PLN', locale: 'pl', monthStartDay: 1 })
    expect(oleh).toMatchObject({ userId: 'usr_oleh', baseCurrency: 'UAH', locale: 'uk', monthStartDay: 10 })
  })

  it('persists changes and reads them back', () => {
    const storage = memoryStorage()
    const db = createDb(storage, seedState)
    db.state.simulateErrors = true
    db.save()
    expect(createDb(storage, seedState).state.simulateErrors).toBe(true)
  })

  it('falls back to the seed when stored JSON is corrupted', () => {
    expect(createDb(memoryStorage('{not json'), seedState).state.users).toHaveLength(2)
  })

  it('falls back to the seed when stored data has another version', () => {
    expect(createDb(memoryStorage(JSON.stringify({ version: 0 })), seedState).state.version).toBe(1)
  })

  it('works in memory without storage', () => {
    const db = createDb(undefined, seedState)
    db.state.simulateErrors = true
    expect(() => db.save()).not.toThrow()
  })

  it('survives a storage that throws on write', () => {
    const storage: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(() => createDb(storage, seedState).save()).not.toThrow()
  })

  it('resets to the seed', () => {
    const storage = memoryStorage()
    const db = createDb(storage, seedState)
    db.state.activeUserId = 'usr_oleh'
    db.reset()
    expect(db.state.activeUserId).toBe('usr_anna')
    expect(JSON.parse(storage.value ?? '{}').activeUserId).toBe('usr_anna')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/mocks/db.test.ts`
Expected: FAIL, cannot resolve `mocks/db`.

- [ ] **Step 3: Write `app/shared/api/contract.ts`**

```ts
import type { Currency } from '../money/money'
import type { MonthStart } from '../period/period'

export type Locale = 'en' | 'pl' | 'ru' | 'uk'

export const locales: readonly Locale[] = ['en', 'pl', 'ru', 'uk']

export type ThemePreference = 'system' | 'light' | 'dark'

export const themePreferences: readonly ThemePreference[] = ['system', 'light', 'dark']

export type NotificationPrefs = {
  budgetLimit: boolean
  dailyReminder: boolean
  weeklyReport: boolean
  goals: boolean
}

export type UserDto = { id: string; name: string; email: string; createdAt: string }

export type SettingsDto = {
  baseCurrency: Currency
  locale: Locale
  monthStartDay: MonthStart
  theme: ThemePreference
  notifications: NotificationPrefs
}

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number }

export type DemoStateDto = {
  activeUserId: string
  users: { id: string; name: string }[]
  simulateErrors: boolean
}
```

- [ ] **Step 4: Write `mocks/db.ts`**

```ts
import type { SettingsDto, UserDto } from '../app/shared/api/contract'

export type UserRow = UserDto

export type SettingsRow = SettingsDto & { userId: string }

export type MockState = {
  version: 1
  activeUserId: string
  simulateErrors: boolean
  users: UserRow[]
  settings: SettingsRow[]
}

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

export const STORAGE_KEY = 'mita-mock-db-v1'

export type MockDb = { state: MockState; save(): void; reset(): void }

const isState = (value: unknown): value is MockState => {
  const state = value as Partial<MockState> | null
  return (
    typeof state === 'object' &&
    state !== null &&
    state.version === 1 &&
    typeof state.activeUserId === 'string' &&
    Array.isArray(state.users) &&
    Array.isArray(state.settings)
  )
}

function read(storage: KeyValueStorage | undefined, seed: () => MockState): MockState {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : undefined
    return isState(parsed) ? parsed : seed()
  } catch {
    return seed()
  }
}

function write(storage: KeyValueStorage | undefined, state: MockState): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function createDb(storage: KeyValueStorage | undefined, seed: () => MockState): MockDb {
  const db: MockDb = {
    state: read(storage, seed),
    save: () => {
      write(storage, db.state)
    },
    reset: () => {
      db.state = seed()
      write(storage, db.state)
    },
  }
  return db
}
```

- [ ] **Step 5: Write `mocks/seed/users.ts`**

```ts
import type { SettingsRow, UserRow } from '../db'

export const demoUsers = (): UserRow[] => [
  { id: 'usr_anna', name: 'Anna Nowak', email: 'anna@demo.mita.app', createdAt: '2026-04-01T09:00:00Z' },
  { id: 'usr_oleh', name: 'Oleh Kravets', email: 'oleh@demo.mita.app', createdAt: '2026-05-12T18:30:00Z' },
]

export const demoSettings = (): SettingsRow[] => [
  {
    userId: 'usr_anna',
    baseCurrency: 'PLN',
    locale: 'pl',
    monthStartDay: 1,
    theme: 'system',
    notifications: { budgetLimit: true, dailyReminder: true, weeklyReport: false, goals: true },
  },
  {
    userId: 'usr_oleh',
    baseCurrency: 'UAH',
    locale: 'uk',
    monthStartDay: 10,
    theme: 'dark',
    notifications: { budgetLimit: true, dailyReminder: false, weeklyReport: true, goals: false },
  },
]
```

- [ ] **Step 6: Write `mocks/seed/index.ts`**

```ts
import type { MockState } from '../db'
import { demoSettings, demoUsers } from './users'

export const seedState = (): MockState => ({
  version: 1,
  activeUserId: 'usr_anna',
  simulateErrors: false,
  users: demoUsers(),
  settings: demoSettings(),
})
```

- [ ] **Step 7: Run test to verify it passes**

Run: `bun test tests/unit/mocks/db.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 8: Commit**

```bash
bun run lint
git add app/shared/api/contract.ts mocks tests/unit/mocks/db.test.ts
git commit -m "feat: localStorage mock database with two demo users"
```

---

### Task 5: Mock router, API and transport

**Files:**
- Create: `mocks/errors.ts`, `mocks/router.ts`, `mocks/api.ts`, `mocks/transport.ts`
- Test: `tests/unit/mocks/api.test.ts`

**Interfaces:**
- Consumes: `ApiRequest`, `HttpMethod`, `Transport` (Task 3), `ApiError`, `ProblemDetails` (Task 3), `MockDb`, `KeyValueStorage`, `createDb` (Task 4), `seedState` (Task 4).
- Produces:
  - `class MockHttpError extends Error { problem: ProblemDetails }`, `notFound(): never`, `badRequest(errors: Record<string, string[]>): never`
  - `type MockContext = { db: MockDb; userId: string; params: Record<string, string>; query: Record<string, string>; body: unknown }`, `type MockHandler = (context: MockContext) => unknown`, `type MockRouter = { on(method: HttpMethod, pattern: string, handler: MockHandler): void; match(method: HttpMethod, path: string): { handler: MockHandler; params: Record<string, string> } | undefined }`, `createRouter(): MockRouter`
  - `type MockApi = { db: MockDb; handle(request: ApiRequest): Promise<unknown> }`, `createMockApi(options: { storage?: KeyValueStorage; random?: () => number; register?: ((router: MockRouter) => void)[] }): MockApi`
  - `createMockTransport(api: MockApi, delay?: () => number): Transport`
- Later tasks register handlers through `register`; Task 6 adds the default list.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test'
import { ApiError } from '../../../app/shared/api/problem'
import { createMockApi } from '../../../mocks/api'
import { badRequest } from '../../../mocks/errors'
import { createRouter } from '../../../mocks/router'
import { createMockTransport } from '../../../mocks/transport'

describe('mock router', () => {
  it('matches static and parameterized paths', () => {
    const router = createRouter()
    const list = () => 'list'
    const item = () => 'item'
    router.on('GET', '/v1/items', list)
    router.on('GET', '/v1/items/:id', item)
    expect(router.match('GET', '/v1/items')?.handler).toBe(list)
    expect(router.match('GET', '/v1/items/42')).toEqual({ handler: item, params: { id: '42' } })
    expect(router.match('POST', '/v1/items')).toBeUndefined()
    expect(router.match('GET', '/v1/items/42/extra')).toBeUndefined()
  })
})

describe('mock api', () => {
  const echo = (api = createMockApi({ register: [(router) => router.on('POST', '/v1/echo/:id', (context) => context)] })) => api

  it('passes session user, params, string query and a copy of the body', async () => {
    const body = { nested: { value: 1 } }
    const result = (await echo().handle({ method: 'POST', path: '/v1/echo/7', query: { page: 2, q: undefined }, body })) as {
      userId: string
      params: Record<string, string>
      query: Record<string, string>
      body: { nested: { value: number } }
    }
    expect(result.userId).toBe('usr_anna')
    expect(result.params).toEqual({ id: '7' })
    expect(result.query).toEqual({ page: '2' })
    result.body.nested.value = 99
    expect(body.nested.value).toBe(1)
  })

  it('answers unknown routes with a 404 problem', async () => {
    const error = await createMockApi({}).handle({ method: 'GET', path: '/v1/nope' }).catch((e: unknown) => e)
    expect(error).toMatchObject({ problem: { status: 404, title: 'Not Found' } })
  })

  it('simulates server errors except for demo endpoints', async () => {
    const api = createMockApi({
      random: () => 0,
      register: [
        (router) => router.on('GET', '/v1/ping', () => 'pong'),
        (router) => router.on('GET', '/v1/demo/ping', () => 'pong'),
      ],
    })
    api.db.state.simulateErrors = true
    expect(await api.handle({ method: 'GET', path: '/v1/ping' }).catch((e: unknown) => e)).toMatchObject({
      problem: { status: 500 },
    })
    expect(await api.handle({ method: 'GET', path: '/v1/demo/ping' })).toBe('pong')
  })
})

describe('mock transport', () => {
  it('returns handler results', async () => {
    const api = createMockApi({ register: [(router) => router.on('GET', '/v1/ping', () => ({ pong: true }))] })
    expect(await createMockTransport(api, () => 0)({ method: 'GET', path: '/v1/ping' })).toEqual({ pong: true })
  })

  it('turns mock errors into ApiError with field errors', async () => {
    const api = createMockApi({
      register: [(router) => router.on('POST', '/v1/things', () => badRequest({ name: ['validation.required'] }))],
    })
    const error = await createMockTransport(api, () => 0)({ method: 'POST', path: '/v1/things' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, fieldErrors: { name: ['validation.required'] } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/mocks/api.test.ts`
Expected: FAIL, cannot resolve `mocks/api`.

- [ ] **Step 3: Write `mocks/errors.ts`**

```ts
import type { ProblemDetails } from '../app/shared/api/problem'

export class MockHttpError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.title)
    this.name = 'MockHttpError'
  }
}

export const notFound = (): never => {
  throw new MockHttpError({ status: 404, title: 'Not Found' })
}

export const badRequest = (errors: Record<string, string[]>): never => {
  throw new MockHttpError({ status: 400, title: 'Validation failed', errors })
}
```

- [ ] **Step 4: Write `mocks/router.ts`**

```ts
import type { HttpMethod } from '../app/shared/api/transport'
import type { MockDb } from './db'

export type MockContext = {
  db: MockDb
  userId: string
  params: Record<string, string>
  query: Record<string, string>
  body: unknown
}

export type MockHandler = (context: MockContext) => unknown

export type MockRouter = {
  on(method: HttpMethod, pattern: string, handler: MockHandler): void
  match(method: HttpMethod, path: string): { handler: MockHandler; params: Record<string, string> } | undefined
}

type Route = { method: HttpMethod; segments: string[]; handler: MockHandler }

const split = (path: string) => path.split('/').filter(Boolean)

function matchSegments(pattern: string[], actual: string[]): Record<string, string> | undefined {
  if (pattern.length !== actual.length) return undefined
  const params: Record<string, string> = {}
  for (const [index, segment] of pattern.entries()) {
    const value = actual[index] ?? ''
    if (segment.startsWith(':')) params[segment.slice(1)] = decodeURIComponent(value)
    else if (segment !== value) return undefined
  }
  return params
}

export function createRouter(): MockRouter {
  const routes: Route[] = []
  return {
    on: (method, pattern, handler) => {
      routes.push({ method, segments: split(pattern), handler })
    },
    match: (method, path) => {
      const actual = split(path)
      for (const route of routes) {
        if (route.method !== method) continue
        const params = matchSegments(route.segments, actual)
        if (params) return { handler: route.handler, params }
      }
      return undefined
    },
  }
}
```

- [ ] **Step 5: Write `mocks/api.ts`**

```ts
import type { ApiRequest } from '../app/shared/api/transport'
import { createDb, type KeyValueStorage, type MockDb } from './db'
import { MockHttpError, notFound } from './errors'
import { createRouter, type MockRouter } from './router'
import { seedState } from './seed'

export type MockApi = { db: MockDb; handle(request: ApiRequest): Promise<unknown> }

const SIMULATED_ERROR_RATE = 0.2

const stringQuery = (query: ApiRequest['query']): Record<string, string> =>
  Object.fromEntries(
    Object.entries(query ?? {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  )

export function createMockApi(options: {
  storage?: KeyValueStorage
  random?: () => number
  register?: ((router: MockRouter) => void)[]
}): MockApi {
  const db = createDb(options.storage, seedState)
  const router = createRouter()
  const random = options.random ?? Math.random
  for (const register of options.register ?? []) register(router)

  return {
    db,
    handle: async (request) => {
      const isDemo = request.path.startsWith('/v1/demo/')
      if (db.state.simulateErrors && !isDemo && random() < SIMULATED_ERROR_RATE) {
        throw new MockHttpError({ status: 500, title: 'Simulated server error' })
      }
      const match = router.match(request.method, request.path) ?? notFound()
      const result = match.handler({
        db,
        userId: db.state.activeUserId,
        params: match.params,
        query: stringQuery(request.query),
        body: request.body === undefined ? undefined : structuredClone(request.body),
      })
      return result === undefined ? undefined : structuredClone(result)
    },
  }
}
```

- [ ] **Step 6: Write `mocks/transport.ts`**

```ts
import { ApiError } from '../app/shared/api/problem'
import type { Transport } from '../app/shared/api/transport'
import type { MockApi } from './api'
import { MockHttpError } from './errors'

const realisticDelay = () => 150 + Math.random() * 250

export function createMockTransport(api: MockApi, delay: () => number = realisticDelay): Transport {
  return async (request) => {
    const wait = delay()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    try {
      return await api.handle(request)
    } catch (error) {
      if (error instanceof MockHttpError) throw new ApiError(error.problem)
      throw error
    }
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `bun test tests/unit/mocks/api.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 8: Commit**

```bash
bun run lint
git add mocks tests/unit/mocks/api.test.ts
git commit -m "feat: mock router, API and transport"
```

---

### Task 6: User, settings and demo endpoints

**Files:**
- Create: `mocks/handlers/users.ts`, `mocks/handlers/demo.ts`, `mocks/handlers/index.ts`
- Test: `tests/unit/mocks/users.test.ts`

**Interfaces:**
- Consumes: `MockRouter`, `MockContext` (Task 5), `badRequest`, `notFound` (Task 5), `MockDb`, `SettingsRow` (Task 4), contract types (Task 4), `currencies` (Task 1).
- Produces: `registerUserHandlers(router)`, `registerDemoHandlers(router)`, `defaultHandlers: ((router: MockRouter) => void)[]` in `mocks/handlers/index.ts`. Endpoints: `GET /v1/me → UserDto`, `GET /v1/settings → SettingsDto`, `PUT /v1/settings (SettingsDto) → SettingsDto`, `GET /v1/demo/state → DemoStateDto`, `POST /v1/demo/reset → DemoStateDto`, `POST /v1/demo/switch-user ({ userId }) → DemoStateDto`, `PUT /v1/demo/simulate-errors ({ enabled }) → DemoStateDto`. Validation codes: `validation.required`, `validation.invalidValue`.
- Later plans append their `register*Handlers` to `defaultHandlers`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test'
import type { SettingsDto } from '../../../app/shared/api/contract'
import { createMockApi } from '../../../mocks/api'
import { defaultHandlers } from '../../../mocks/handlers'

const api = () => createMockApi({ register: defaultHandlers })

const validSettings: SettingsDto = {
  baseCurrency: 'EUR',
  locale: 'en',
  monthStartDay: 'lastWorkingDay',
  theme: 'light',
  notifications: { budgetLimit: false, dailyReminder: false, weeklyReport: true, goals: true },
}

describe('user endpoints', () => {
  it('returns the active demo user without settings fields', async () => {
    expect(await api().handle({ method: 'GET', path: '/v1/me' })).toEqual({
      id: 'usr_anna',
      name: 'Anna Nowak',
      email: 'anna@demo.mita.app',
      createdAt: '2026-04-01T09:00:00Z',
    })
  })

  it('returns settings without userId', async () => {
    const settings = await api().handle({ method: 'GET', path: '/v1/settings' })
    expect(settings).toEqual({
      baseCurrency: 'PLN',
      locale: 'pl',
      monthStartDay: 1,
      theme: 'system',
      notifications: { budgetLimit: true, dailyReminder: true, weeklyReport: false, goals: true },
    })
  })

  it('updates settings of the active user only', async () => {
    const mock = api()
    expect(await mock.handle({ method: 'PUT', path: '/v1/settings', body: validSettings })).toEqual(validSettings)
    await mock.handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_oleh' } })
    expect(await mock.handle({ method: 'GET', path: '/v1/settings' })).toMatchObject({ baseCurrency: 'UAH' })
  })

  it('rejects invalid settings with field errors', async () => {
    const error = await api()
      .handle({
        method: 'PUT',
        path: '/v1/settings',
        body: { ...validSettings, baseCurrency: 'GBP', monthStartDay: 31, locale: undefined },
      })
      .catch((e: unknown) => e)
    expect(error).toMatchObject({
      problem: {
        status: 400,
        errors: {
          baseCurrency: ['validation.invalidValue'],
          monthStartDay: ['validation.invalidValue'],
          locale: ['validation.required'],
        },
      },
    })
  })

  it('rejects a body that is not an object', async () => {
    const error = await api().handle({ method: 'PUT', path: '/v1/settings', body: 'x' }).catch((e: unknown) => e)
    expect(error).toMatchObject({ problem: { status: 400 } })
  })
})

describe('demo endpoints', () => {
  it('lists demo users and the active one', async () => {
    expect(await api().handle({ method: 'GET', path: '/v1/demo/state' })).toEqual({
      activeUserId: 'usr_anna',
      users: [
        { id: 'usr_anna', name: 'Anna Nowak' },
        { id: 'usr_oleh', name: 'Oleh Kravets' },
      ],
      simulateErrors: false,
    })
  })

  it('switches the session user', async () => {
    const mock = api()
    await mock.handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_oleh' } })
    expect(await mock.handle({ method: 'GET', path: '/v1/me' })).toMatchObject({ id: 'usr_oleh' })
  })

  it('refuses to switch to an unknown user', async () => {
    const error = await api()
      .handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_ghost' } })
      .catch((e: unknown) => e)
    expect(error).toMatchObject({ problem: { status: 400, errors: { userId: ['validation.invalidValue'] } } })
  })

  it('toggles simulated errors and resets everything', async () => {
    const mock = api()
    await mock.handle({ method: 'PUT', path: '/v1/demo/simulate-errors', body: { enabled: true } })
    expect(mock.db.state.simulateErrors).toBe(true)
    await mock.handle({ method: 'POST', path: '/v1/demo/reset' })
    expect(mock.db.state.simulateErrors).toBe(false)
    expect(mock.db.state.activeUserId).toBe('usr_anna')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/mocks/users.test.ts`
Expected: FAIL, cannot resolve `mocks/handlers`.

- [ ] **Step 3: Write `mocks/handlers/users.ts`**

```ts
import {
  type Locale,
  locales,
  type NotificationPrefs,
  type SettingsDto,
  type ThemePreference,
  themePreferences,
  type UserDto,
} from '../../app/shared/api/contract'
import { type Currency, currencies } from '../../app/shared/money/money'
import type { MonthStart } from '../../app/shared/period/period'
import type { MockDb, SettingsRow } from '../db'
import { badRequest, notFound } from '../errors'
import type { MockRouter } from '../router'

const notificationKeys: (keyof NotificationPrefs)[] = ['budgetLimit', 'dailyReminder', 'weeklyReport', 'goals']

const findSettings = (db: MockDb, userId: string): SettingsRow =>
  db.state.settings.find((row) => row.userId === userId) ?? notFound()

export const toSettingsDto = ({ userId: _userId, ...settings }: SettingsRow): SettingsDto => settings

const isMonthStart = (value: unknown): value is MonthStart =>
  value === 'lastWorkingDay' || (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 28)

const isNotifications = (value: unknown): value is NotificationPrefs =>
  typeof value === 'object' &&
  value !== null &&
  notificationKeys.every((key) => typeof (value as Record<string, unknown>)[key] === 'boolean')

function validateSettings(body: unknown): SettingsDto {
  const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const errors: Record<string, string[]> = {}
  const check = (field: string, valid: boolean) => {
    if (input[field] === undefined || input[field] === null) errors[field] = ['validation.required']
    else if (!valid) errors[field] = ['validation.invalidValue']
  }
  check('baseCurrency', currencies.includes(input.baseCurrency as Currency))
  check('locale', locales.includes(input.locale as Locale))
  check('monthStartDay', isMonthStart(input.monthStartDay))
  check('theme', themePreferences.includes(input.theme as ThemePreference))
  check('notifications', isNotifications(input.notifications))
  if (Object.keys(errors).length > 0) badRequest(errors)
  const notifications = input.notifications as NotificationPrefs
  return {
    baseCurrency: input.baseCurrency as Currency,
    locale: input.locale as Locale,
    monthStartDay: input.monthStartDay as MonthStart,
    theme: input.theme as ThemePreference,
    notifications: Object.fromEntries(notificationKeys.map((key) => [key, notifications[key]])) as NotificationPrefs,
  }
}

export function registerUserHandlers(router: MockRouter) {
  router.on('GET', '/v1/me', ({ db, userId }): UserDto => db.state.users.find((user) => user.id === userId) ?? notFound())

  router.on('GET', '/v1/settings', ({ db, userId }) => toSettingsDto(findSettings(db, userId)))

  router.on('PUT', '/v1/settings', ({ db, userId, body }) => {
    const row = findSettings(db, userId)
    Object.assign(row, validateSettings(body))
    db.save()
    return toSettingsDto(row)
  })
}
```

- [ ] **Step 4: Write `mocks/handlers/demo.ts`**

```ts
import type { DemoStateDto } from '../../app/shared/api/contract'
import type { MockDb } from '../db'
import { badRequest } from '../errors'
import type { MockRouter } from '../router'

const demoState = (db: MockDb): DemoStateDto => ({
  activeUserId: db.state.activeUserId,
  users: db.state.users.map(({ id, name }) => ({ id, name })),
  simulateErrors: db.state.simulateErrors,
})

const field = (body: unknown, name: string): unknown =>
  typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[name] : undefined

export function registerDemoHandlers(router: MockRouter) {
  router.on('GET', '/v1/demo/state', ({ db }) => demoState(db))

  router.on('POST', '/v1/demo/reset', ({ db }) => {
    db.reset()
    return demoState(db)
  })

  router.on('POST', '/v1/demo/switch-user', ({ db, body }) => {
    const userId = field(body, 'userId')
    if (typeof userId !== 'string' || !db.state.users.some((user) => user.id === userId)) {
      badRequest({ userId: ['validation.invalidValue'] })
    }
    db.state.activeUserId = userId as string
    db.save()
    return demoState(db)
  })

  router.on('PUT', '/v1/demo/simulate-errors', ({ db, body }) => {
    const enabled = field(body, 'enabled')
    if (typeof enabled !== 'boolean') badRequest({ enabled: ['validation.invalidValue'] })
    db.state.simulateErrors = enabled as boolean
    db.save()
    return demoState(db)
  })
}
```

- [ ] **Step 5: Write `mocks/handlers/index.ts`**

```ts
import type { MockRouter } from '../router'
import { registerDemoHandlers } from './demo'
import { registerUserHandlers } from './users'

export const defaultHandlers: ((router: MockRouter) => void)[] = [registerUserHandlers, registerDemoHandlers]
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test tests/unit/mocks/users.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 7: Commit**

```bash
bun run lint
git add mocks tests/unit/mocks/users.test.ts
git commit -m "feat: mock endpoints for the current user, settings and demo controls"
```

---

### Task 7: Nuxt wiring — API plugin, user settings, money formatting

**Files:**
- Create: `app/shared/api/transports/mock.ts`, `app/plugins/api.ts`, `app/shared/composables/useApi.ts`, `app/shared/composables/useMoney.ts`, `app/shared/api/invalidation.ts`, `app/shared/user/userApi.ts`, `app/shared/user/keys.ts`, `app/shared/user/useUserSettings.ts`, `app/shared/user/useCurrentUser.ts`
- Modify: `app/plugins/vue-query.ts` (default query options), `tests/e2e/home.spec.ts` (smoke for mock-backed data)
- Test: `tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces:
  - `loadMockTransport(): Promise<Transport>` (dynamic import of `~~/mocks/*`, uses `localStorage` when available)
  - Nuxt plugin `api` providing `$api: ApiClient`; `useApi(): ApiClient`
  - `userApi(api: ApiClient) → { me(): Promise<UserDto>; settings(): Promise<SettingsDto>; updateSettings(body: SettingsDto): Promise<SettingsDto> }`
  - `userKeys = { me: ['me'], settings: ['settings'] } as const`
  - `DEFAULT_SETTINGS: SettingsDto`; `useUserSettings() → { settings: ComputedRef<SettingsDto>; baseCurrency: ComputedRef<Currency>; monthStart: ComputedRef<MonthStart>; isPending: Ref<boolean>; isError: Ref<boolean>; refetch(): Promise<unknown> }`; `useUpdateSettings()` (TanStack mutation of `SettingsDto`)
  - `useCurrentUser() → { user: ComputedRef<UserDto | undefined>; isPending: Ref<boolean> }`
  - `invalidationMap: Record<DataChange, readonly QueryKey[]>` with `type DataChange = 'settings' | 'demo'`, `invalidateAfter(queryClient: QueryClient, change: DataChange): Promise<void>`; later plans add entries
  - `useMoney() → { format(minor: number, currency: Currency, options?: { signed?: boolean }): string }`

- [ ] **Step 1: Write `app/shared/api/transports/mock.ts`**

```ts
import type { Transport } from '../transport'

export async function loadMockTransport(): Promise<Transport> {
  const [{ createMockApi }, { createMockTransport }, { defaultHandlers }] = await Promise.all([
    import('~~/mocks/api'),
    import('~~/mocks/transport'),
    import('~~/mocks/handlers'),
  ])
  const storage = import.meta.client ? window.localStorage : undefined
  return createMockTransport(createMockApi({ storage, register: defaultHandlers }))
}
```

- [ ] **Step 2: Write `app/plugins/api.ts`**

```ts
import { createApiClient } from '~/shared/api/client'
import type { Transport } from '~/shared/api/transport'
import { type Fetcher, createHttpTransport } from '~/shared/api/transports/http'
import { loadMockTransport } from '~/shared/api/transports/mock'

export default defineNuxtPlugin(async (nuxtApp) => {
  const config = useRuntimeConfig()
  const locale = () => nuxtApp.$i18n.locale.value
  const fetcher: Fetcher = (url, options) => $fetch(url, options)
  const transport: Transport = config.public.apiMocks
    ? await loadMockTransport()
    : createHttpTransport(fetcher, { baseUrl: config.public.apiBaseUrl, locale })

  return { provide: { api: createApiClient(transport) } }
})
```

- [ ] **Step 3: Write `app/shared/composables/useApi.ts`**

```ts
import type { ApiClient } from '~/shared/api/client'

export const useApi = (): ApiClient => useNuxtApp().$api
```

- [ ] **Step 4: Change query defaults in `app/plugins/vue-query.ts`**

Replace the `QueryClient` construction with:

```ts
  const mocksOnServer = import.meta.server && useRuntimeConfig().public.apiMocks
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false, enabled: !mocksOnServer },
    },
  })
```

- [ ] **Step 5: Write `app/shared/api/invalidation.ts`**

```ts
import type { QueryClient, QueryKey } from '@tanstack/vue-query'

export type DataChange = 'settings' | 'demo'

export const invalidationMap: Record<DataChange, readonly QueryKey[]> = {
  settings: [['overview'], ['budgets'], ['reports'], ['transactions'], ['accounts']],
  demo: [[]],
}

export async function invalidateAfter(queryClient: QueryClient, change: DataChange): Promise<void> {
  await Promise.all(invalidationMap[change].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}
```

`[[]]` for `demo` invalidates every query, because switching or resetting the demo user changes all data.

- [ ] **Step 6: Write `app/shared/user/keys.ts` and `app/shared/user/userApi.ts`**

```ts
export const userKeys = {
  me: ['me'],
  settings: ['settings'],
} as const
```

```ts
import type { ApiClient } from '~/shared/api/client'
import type { SettingsDto, UserDto } from '~/shared/api/contract'

export const userApi = (api: ApiClient) => ({
  me: () => api.get<UserDto>('/v1/me'),
  settings: () => api.get<SettingsDto>('/v1/settings'),
  updateSettings: (body: SettingsDto) => api.put<SettingsDto>('/v1/settings', body),
})
```

- [ ] **Step 7: Write `app/shared/user/useUserSettings.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { SettingsDto } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { userKeys } from './keys'
import { userApi } from './userApi'

export const DEFAULT_SETTINGS: SettingsDto = {
  baseCurrency: 'PLN',
  locale: 'en',
  monthStartDay: 1,
  theme: 'system',
  notifications: { budgetLimit: true, dailyReminder: true, weeklyReport: false, goals: true },
}

export function useUserSettings() {
  const api = userApi(useApi())
  const query = useQuery({ queryKey: userKeys.settings, queryFn: api.settings })
  const settings = computed(() => query.data.value ?? DEFAULT_SETTINGS)

  return {
    settings,
    baseCurrency: computed(() => settings.value.baseCurrency),
    monthStart: computed(() => settings.value.monthStartDay),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}

export function useUpdateSettings() {
  const api = userApi(useApi())
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.updateSettings,
    onSuccess: async (settings) => {
      queryClient.setQueryData(userKeys.settings, settings)
      await invalidateAfter(queryClient, 'settings')
    },
  })
}
```

- [ ] **Step 8: Write `app/shared/user/useCurrentUser.ts`**

```ts
import { useQuery } from '@tanstack/vue-query'
import { userKeys } from './keys'
import { userApi } from './userApi'

export function useCurrentUser() {
  const api = userApi(useApi())
  const query = useQuery({ queryKey: userKeys.me, queryFn: api.me })

  return { user: computed(() => query.data.value), isPending: query.isPending }
}
```

- [ ] **Step 9: Write `app/shared/composables/useMoney.ts`**

```ts
import { type Currency, fromMinor } from '~/shared/money/money'

export function useMoney() {
  const { n } = useI18n()

  return {
    format: (minor: number, currency: Currency, options?: { signed?: boolean }) =>
      n(fromMinor(minor), { key: 'currency', currency, signDisplay: options?.signed ? 'exceptZero' : 'auto' }),
  }
}
```

- [ ] **Step 10: Show the current user on the Settings placeholder so E2E can prove the mock backend runs in the browser**

In `app/pages/settings.vue`, add below `<PageHeader … />`:

```vue
  <p v-if="user" class="m-0 text-sm text-muted" data-testid="current-user">{{ user.name }}</p>
```

and in its `<script setup>`:

```ts
import { useCurrentUser } from '~/shared/user/useCurrentUser'

const { user } = useCurrentUser()
```

This line is replaced by the Profile section in the settings plan.

- [ ] **Step 11: Add the E2E smoke test to `tests/e2e/home.spec.ts`**

```ts
test('settings show the demo user served by the mock backend', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByTestId('current-user')).toHaveText('Anna Nowak')
})
```

- [ ] **Step 12: Verify**

Run: `bun run lint && bun run typecheck && bun run test`
Expected: no Biome findings, no type errors, all unit tests pass.

Run the E2E suite as in `CLAUDE.md` (dev server on :3000, Playwright container `mcr.microsoft.com/playwright:v1.64.1-noble` with `--user 1000:1000 -e HOME=/tmp --network host`).
Expected: all tests pass, including `settings show the demo user served by the mock backend` on desktop and mobile.

Run: `bun run build && grep -rl "usr_anna" .output/public/_nuxt | head -3`
Expected: matches only in lazily loaded chunks, not in the entry chunk.

- [ ] **Step 13: Commit**

```bash
git add app tests/e2e/home.spec.ts
git commit -m "feat: API plugin with mock transport, user settings and money formatting"
```

---

### Task 8: Shared building blocks

**Files:**
- Create: `app/shared/components/MoneyText.vue`, `StatCard.vue`, `ProgressBar.vue`, `PeriodSwitcher.vue`, `EmptyState.vue`, `ErrorState.vue`
- Modify: `i18n/locales/en.json`, `pl.json`, `ru.json`, `uk.json`
- Test: `tests/unit/i18n/locales.test.ts`

**Interfaces:**
- Consumes: `useMoney` (Task 7), `periodByKey`, `shiftPeriod`, `MonthStart` (Task 2), `Currency` (Task 1).
- Produces (props are the contract later plans use):
  - `<MoneyText :amount="minor" :currency="'PLN'" signed? tone="auto|plain" />` — `tone="auto"` colors positive signed amounts with `text-accent`.
  - `<StatCard :label="string" variant="surface|deep">` default slot = value, slot `footer`.
  - `<ProgressBar :value="ratio" :label="string" tone="accent|deep|muted" size="sm|md|lg" />` — `role="progressbar"`, width clamped to 0–100%.
  - `<PeriodSwitcher v-model="periodKey" :month-start="MonthStart" />` — previous / current / next month buttons as in the Budgets design.
  - `<EmptyState :title="string" :description?="string">` slot `action`.
  - `<ErrorState :message?="string" @retry />`.
  - i18n keys: `shared.actions.retry`, `shared.error.title`, `shared.error.description`, `shared.period.label`, `validation.required`, `validation.invalidValue`.

- [ ] **Step 1: Write the failing locale parity test**

```ts
import { describe, expect, it } from 'bun:test'
import en from '../../../i18n/locales/en.json'
import pl from '../../../i18n/locales/pl.json'
import ru from '../../../i18n/locales/ru.json'
import uk from '../../../i18n/locales/uk.json'

const keysOf = (value: unknown, prefix = ''): string[] =>
  typeof value === 'object' && value !== null
    ? Object.entries(value).flatMap(([key, nested]) => keysOf(nested, prefix ? `${prefix}.${key}` : key))
    : [prefix]

describe('locales', () => {
  it.each([
    ['pl', pl],
    ['ru', ru],
    ['uk', uk],
  ])('%s has exactly the keys of en', (_name, locale) => {
    expect(keysOf(locale).sort()).toEqual(keysOf(en).sort())
  })

  it('contains the shared keys used by building blocks and validation', () => {
    expect(keysOf(en)).toEqual(
      expect.arrayContaining([
        'shared.actions.retry',
        'shared.error.title',
        'shared.error.description',
        'shared.period.label',
        'validation.required',
        'validation.invalidValue',
      ]),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/i18n/locales.test.ts`
Expected: FAIL on "contains the shared keys".

- [ ] **Step 3: Add the keys to all four locale files**

Add under `shared` in each file (keep existing keys) and add a top-level `validation` object:

`en.json`
```json
"actions": { "retry": "Try again" },
"error": { "title": "Something went wrong", "description": "We could not load this section." },
"period": { "label": "Period" }
```
```json
"validation": { "required": "This field is required.", "invalidValue": "This value is not valid." }
```

`pl.json`
```json
"actions": { "retry": "Spróbuj ponownie" },
"error": { "title": "Coś poszło nie tak", "description": "Nie udało się wczytać tej sekcji." },
"period": { "label": "Okres" }
```
```json
"validation": { "required": "To pole jest wymagane.", "invalidValue": "Ta wartość jest nieprawidłowa." }
```

`ru.json`
```json
"actions": { "retry": "Повторить" },
"error": { "title": "Что-то пошло не так", "description": "Не удалось загрузить этот раздел." },
"period": { "label": "Период" }
```
```json
"validation": { "required": "Обязательное поле.", "invalidValue": "Недопустимое значение." }
```

`uk.json`
```json
"actions": { "retry": "Спробувати ще" },
"error": { "title": "Щось пішло не так", "description": "Не вдалося завантажити цей розділ." },
"period": { "label": "Період" }
```
```json
"validation": { "required": "Обов'язкове поле.", "invalidValue": "Неприпустиме значення." }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/unit/i18n/locales.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write `app/shared/components/MoneyText.vue`**

```vue
<script setup lang="ts">
import type { Currency } from '~/shared/money/money'

const props = withDefaults(
  defineProps<{ amount: number; currency: Currency; signed?: boolean; tone?: 'auto' | 'plain' }>(),
  { signed: false, tone: 'auto' },
)

const { format } = useMoney()

const text = computed(() => format(props.amount, props.currency, { signed: props.signed }))
const isIncome = computed(() => props.tone === 'auto' && props.signed && props.amount > 0)
</script>

<template>
  <span class="font-mono font-medium whitespace-nowrap" :class="isIncome ? 'text-accent' : undefined">{{ text }}</span>
</template>
```

- [ ] **Step 6: Write `app/shared/components/StatCard.vue`**

```vue
<script setup lang="ts">
withDefaults(defineProps<{ label: string; variant?: 'surface' | 'deep' }>(), { variant: 'surface' })
</script>

<template>
  <div
    class="flex flex-col gap-3.5 rounded-(--radius-card) px-5.5 py-5"
    :class="variant === 'deep' ? 'bg-deep text-on-deep' : 'bg-surface text-ink'"
  >
    <span class="text-[13px] font-medium" :class="variant === 'deep' ? 'text-deep-muted' : 'text-muted'">
      {{ label }}
    </span>
    <span class="font-mono text-[28px] font-medium tracking-tight">
      <slot />
    </span>
    <div v-if="$slots.footer" class="text-xs" :class="variant === 'deep' ? 'text-deep-muted' : 'text-muted'">
      <slot name="footer" />
    </div>
  </div>
</template>
```

- [ ] **Step 7: Write `app/shared/components/ProgressBar.vue`**

```vue
<script setup lang="ts">
const props = withDefaults(
  defineProps<{ value: number; label: string; tone?: 'accent' | 'deep' | 'muted'; size?: 'sm' | 'md' | 'lg' }>(),
  { tone: 'accent', size: 'md' },
)

const percent = computed(() => Math.round(Math.min(Math.max(props.value, 0), 1) * 100))
const height = computed(() => ({ sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' })[props.size])
const fill = computed(() => ({ accent: 'bg-accent', deep: 'bg-deep', muted: 'bg-deep-muted' })[props.tone])
</script>

<template>
  <div
    role="progressbar"
    :aria-label="label"
    :aria-valuenow="percent"
    aria-valuemin="0"
    aria-valuemax="100"
    class="w-full overflow-hidden rounded-full bg-track"
    :class="height"
  >
    <div class="h-full rounded-full" :class="fill" :style="{ width: `${percent}%` }" />
  </div>
</template>
```

- [ ] **Step 8: Write `app/shared/components/PeriodSwitcher.vue`**

```vue
<script setup lang="ts">
import { type MonthStart, periodByKey, shiftPeriod } from '~/shared/period/period'

const props = defineProps<{ monthStart: MonthStart }>()
const model = defineModel<string>({ required: true })
const { t, d } = useI18n()

const label = (key: string) => {
  const [year, month] = key.split('-').map(Number)
  return d(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 15)), { month: 'long', timeZone: 'UTC' })
}

const options = computed(() =>
  [-1, 0, 1].map((offset) => {
    const key = shiftPeriod(model.value, offset, props.monthStart).key
    return { value: key, label: label(key) }
  }),
)

const range = computed(() => periodByKey(model.value, props.monthStart))
</script>

<template>
  <SelectButton
    v-model="model"
    :options="options"
    option-label="label"
    option-value="value"
    :allow-empty="false"
    :aria-label="t('shared.period.label')"
    :title="`${range.from} – ${range.to}`"
  />
</template>
```

- [ ] **Step 9: Write `app/shared/components/EmptyState.vue` and `ErrorState.vue`**

```vue
<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <section class="flex flex-col items-center gap-3 rounded-(--radius-card) bg-surface px-6 py-10 text-center">
    <h2 class="m-0 text-base font-semibold">{{ title }}</h2>
    <p v-if="description" class="m-0 max-w-sm text-sm text-muted">{{ description }}</p>
    <slot name="action" />
  </section>
</template>
```

```vue
<script setup lang="ts">
defineProps<{ message?: string }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <section role="alert" class="flex flex-col items-center gap-3 rounded-(--radius-card) bg-surface px-6 py-10 text-center">
    <h2 class="m-0 text-base font-semibold">{{ t('shared.error.title') }}</h2>
    <p class="m-0 max-w-sm text-sm text-muted">{{ message ?? t('shared.error.description') }}</p>
    <Button :label="t('shared.actions.retry')" severity="secondary" outlined @click="emit('retry')" />
  </section>
</template>
```

- [ ] **Step 10: Verify**

Run: `bun run lint && bun run typecheck && bun run test`
Expected: no findings, no type errors, all unit tests pass.

- [ ] **Step 11: Commit**

```bash
git add app/shared/components i18n tests/unit/i18n
git commit -m "feat: shared building blocks and locale parity check"
```

---

### Task 9: Pull request

- [ ] **Step 1: Rebase on the latest develop and check the history**

```bash
git fetch -q origin
git rebase origin/develop
git log --oneline origin/develop..HEAD
```

Expected: one commit per task (plan document, Tasks 1–8), no empty or fix-up commits.

- [ ] **Step 2: Run the full verification once more**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`, then the E2E suite.
Expected: everything green.

- [ ] **Step 3: Push and open the pull request**

```bash
git push -u origin feature/api-foundation
gh pr create -B develop -H feature/api-foundation -t "feat: API foundation with mock backend" -F - <<'EOF'
## What changed and why

Data foundation for every screen, following the frontend-on-mocks design:

- money in minor units and financial periods (month start day, last working day)
- typed API client with ProblemDetails errors; `http` and `mock` transports picked by `NUXT_PUBLIC_API_MOCKS`
- `localStorage` mock backend: two demo users, `/v1/me`, `/v1/settings`, demo controls (switch user, reset, simulate errors)
- user settings and money formatting composables, invalidation map
- shared building blocks: MoneyText, StatCard, ProgressBar, PeriodSwitcher, EmptyState, ErrorState

## How to test

```
bun run lint && bun run typecheck && bun run test
bun run dev
```

Open `/settings` and check that "Anna Nowak" is shown, then clear `mita-mock-db-v1` in localStorage and reload.
EOF
```

Expected: PR URL printed, `check-source-branch` passes.
