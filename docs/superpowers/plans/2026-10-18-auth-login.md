# Login and Hybrid API Implementation Plan

**Goal:** Users sign up, sign in and out in the frontend against the real .NET backend (`/v1/auth`, `/v1/me`, `/v1/settings`). Every other screen keeps running on the mock backend until its backend feature exists.

**Architecture:**
- **Routing transport:** sends a request to the HTTP transport when its path starts with one of `NUXT_PUBLIC_API_REAL_PATHS`, and to the mock transport otherwise.
- **Proxy:** real requests go to the same origin `/v1/...`, which Nitro proxies to the backend (`NUXT_API_PROXY_TARGET`). Session cookies (`mita_at`, `mita_rt`, `XSRF-TOKEN`) are therefore first-party, there is no CORS, and SSR can forward them.
- **HTTP transport:** adds the XSRF header and performs one single-flight refresh on 401.
- **Session layer:** `useSession`, a global route middleware and new `/login` and `/register` pages in an `auth` layout.
- **Mock backend:** implements `/v1/auth/*` too (pure-mock mode for CI/E2E). In hybrid mode it uses the real user's id and seeds demo data for that user on first use.

**Tech Stack:** Nuxt 4, TypeScript, TanStack Query, Vuelidate, PrimeVue 4, Tailwind 4, @nuxtjs/i18n, Bun (`bun test`), Playwright, Biome.

**Spec:**
- `docs/superpowers/specs/2026-10-15-frontend-mocks-design.md` (mock architecture, error mapping, i18n rules).
- Backend contract in the backend repo, `docs/api-contract.md` and `docs/superpowers/plans/2026-10-18-auth-and-users.md`:
  - cookies `mita_at` / `mita_rt` (path `/v1/auth`) / `XSRF-TOKEN`, header `X-XSRF-TOKEN` on POST/PUT/PATCH/DELETE;
  - error codes `auth.invalidCredentials`, `auth.sessionExpired`, `auth.xsrf`;
  - 429 on too many attempts;
  - validation codes `validation.required|invalidValue|nameTooLong|invalidEmail|emailTaken|passwordTooShort|passwordTooLong|invalidPassword`;
  - `POST /v1/auth/register {name,email,password}` returns 201 `UserDto`;
  - `POST /v1/auth/login {email,password}` returns 200 `UserDto`;
  - `POST /v1/auth/refresh` returns 204 (401 `auth.sessionExpired` when the session is gone);
  - `POST /v1/auth/logout` returns 204;
  - `DELETE /v1/me {password}` returns 204.

## Decisions

| Topic | Decision |
|---|---|
| Hybrid mode (user decision) | `NUXT_PUBLIC_API_MOCKS=true` plus `NUXT_PUBLIC_API_REAL_PATHS=/v1/auth,/v1/me,/v1/settings`. Matching uses whole path segments (`/v1/me` matches `/v1/me` and `/v1/me/...`, not `/v1/merge`). Empty list means pure mock mode. `API_MOCKS=false` means everything goes to HTTP |
| Same-origin proxy | Nitro `routeRules` proxy `/v1/**` to `NUXT_API_PROXY_TARGET` (dev `http://localhost:8080`, Docker dev `http://host.docker.internal:8080`), registered only when the target is set. The HTTP transport base URL becomes `''` (same origin). This replaces the unused `apiBaseUrl` public option |
| Auth in pure mock mode | Mock `/v1/auth/register\|login\|refresh\|logout`. Demo users log in with their seed emails and password `demo-password` (shown as a hint on the login page in pure mock mode only). Mock "session" = `activeUserId` in the mock db, null after logout. Unauthenticated mock requests outside `/v1/auth` get 401 `auth.sessionExpired`, so both modes behave alike |
| Mock data in hybrid mode | The mock api takes `currentUserId: () => string \| undefined` from the session. A user id unknown to the mock db gets a copy of demo user Anna's data (accounts, categories, transactions, budgets, goals, transfers) with all ids remapped and the user's base currency kept as PLN. The demo-user switch and "reset demo data" are hidden in hybrid mode |
| Session state | `GET /v1/me` is the session probe (TanStack query `['me']`). 200 means authenticated; 401 after a failed refresh means anonymous. On logout or session expiry, the query cache is cleared |
| Route protection | Global middleware `auth.global.ts`. Every page except the localized `/login` and `/register` requires a session; anonymous users are redirected to `/login?redirect=<path>`. An authenticated user opening `/login` or `/register` goes to `redirect` or `/`. Only same-origin relative redirects are accepted |
| SSR | In hybrid or real mode the middleware probes `/v1/me` on the server through `useRequestFetch()` (forwards the browser's cookies through the proxy). Pure mock mode probes on the client only and shows a full-page skeleton until known |
| Refresh | The HTTP transport retries a 401 once after `POST /v1/auth/refresh`, except for `/v1/auth/*`. Concurrent 401s share one refresh promise (single-flight). If refresh fails, it emits `session-expired`; the app clears the cache and navigates to `/login?redirect=…&expired=1` |
| XSRF | For POST/PUT/PATCH/DELETE, the transport reads the `XSRF-TOKEN` cookie (`document.cookie`, or the request header on the server) and sends `X-XSRF-TOKEN` |
| UI (user decision) | Layout `auth`:<br>• `bg-bg` background, the ミ Mita logo, a centred `bg-surface` card at most 400px wide (full width on mobile), language and theme switchers below the card<br>• Login: email, password (show/hide toggle), Sign in, link to register<br>• Register: name, email, password (with a "min. 10 characters" hint), Create account, link to login<br>• Errors: field errors under the fields; `auth.invalidCredentials`, 429 and `auth.sessionExpired` as a message block above the form<br>• Logout: a button in the sidebar footer (desktop) and in Settings → Profile (mobile and desktop) |
| Delete account | With real auth: the dialog asks for the password and calls `DELETE /v1/me` (400 `password: validation.invalidPassword` shown on the field); success clears the cache and goes to `/login`. Pure mock mode keeps the current demo behaviour |
| Not in this plan | Password reset and email confirmation (backend has no email yet); "remember me" (refresh is always 30 days) |

## Global Constraints

- Code, identifiers and commits in English; no comments except a controversial decision; no mention of Claude, AI or assistants anywhere; no `Co-Authored-By`.
- Every user-facing string goes through i18n with keys in en, pl, ru and uk; the parity test must stay green.
- The UI never shows `ApiError.title`; messages come from codes or status (`errorMessageKey`).
- Design tokens only (no raw hex); controls at least 44px; accessible labels; focus moves to the first invalid field.
- Only libraries from `docs/STACK.md`; PrimeVue stays on 4.x.
- Lint (Biome), typecheck, `bun test tests/unit` and the full E2E suite must be green before every PR.

## Review Focus

- An open redirect: `/login?redirect=https://evil.example` or `//evil.example` must land on `/`, never off-site. Pinned in Task 4.
- Five queries hitting 401 at the same time must cause exactly one refresh call, and all five retry after it. Pinned in Task 2.
- A refresh that itself returns 401 must not loop. One expired event, then the login page. Pinned in Task 2.
- Path matching must not over-match: `/v1/mestatus` must not go to the real API when `/v1/me` is listed. Pinned in Task 1.
- After logout, pressing Back must not show cached data from the previous user. The query cache is cleared and protected pages redirect. Pinned in Task 6.

---

### Task 1: Routing transport, same-origin proxy and runtime config

**Files:** `app/shared/api/transports/routing.ts`, `app/plugins/api.ts`, `nuxt.config.ts` (runtimeConfig `public.apiRealPaths: ''`, `apiProxyTarget: ''`, Nitro proxy rule when set), `.env.example`, `compose.override.yaml` (`NUXT_API_PROXY_TARGET=http://host.docker.internal:8080`), `CLAUDE.md` (Mocks section: hybrid mode); test `tests/unit/shared/routingTransport.test.ts`.

**Interfaces:**
- Produces:
  - `parseRealPaths(value: string): string[]`, which trims, drops empty entries and strips a trailing `/`.
  - `matchesRealPath(path: string, prefixes: string[]): boolean`, which matches on whole segments.
  - `createRoutingTransport(options: { http: Transport; mock: Transport; realPaths: string[] }): Transport`.
- [ ] **Tests:**
  - `parseRealPaths(' /v1/auth, /v1/me/ ,,')` equals `['/v1/auth','/v1/me']`.
  - `matchesRealPath('/v1/me', ['/v1/me'])` is true.
  - `matchesRealPath('/v1/me/x', ['/v1/me'])` is true.
  - `matchesRealPath('/v1/mestatus', ['/v1/me'])` is false.
  - `matchesRealPath('/v1/auth/login', ['/v1/auth'])` is true.
  - The routing transport sends `/v1/settings` to http and `/v1/transactions` to mock, and an empty list sends everything to mock.
- [ ] Implement; the plugin builds both transports when `apiMocks` is true and `realPaths` is non-empty. Run lint, typecheck and unit tests; commit `feat: route selected api paths to the real backend through a same-origin proxy`.

### Task 2: HTTP transport — XSRF header and single-flight refresh

**Files:** `app/shared/api/transports/http.ts`, `app/shared/api/sessionEvents.ts`; test `tests/unit/shared/httpTransport.test.ts` (extend).

**Interfaces:**
- Produces:
  - `createHttpTransport(fetcher, { baseUrl, locale, xsrfToken: () => string | undefined, onSessionExpired: () => void })`.
  - `sessionEvents` is a tiny emitter with `onExpired(cb)` and `emitExpired()`.
- [ ] **Tests** (fake fetcher):
  - POST, PUT and DELETE send `X-XSRF-TOKEN` with the token value; GET does not.
  - With no token cookie, the header is omitted.
  - A 401 on `/v1/me` triggers `POST /v1/auth/refresh`, then retries `/v1/me` once and returns its data.
  - Five concurrent 401s produce exactly one refresh call and five retries.
  - When the refresh returns 401, `onSessionExpired` is called once and the original `ApiError` 401 is thrown, with no second refresh.
  - A 401 from `/v1/auth/login` is thrown as-is, without a refresh.
  - A 401 from the retried request after a successful refresh is thrown without another refresh.
- [ ] Implement, test, commit `feat: xsrf header and single-flight token refresh in the http transport`.

### Task 3: Mock auth and per-user demo data

**Files:** `mocks/handlers/auth.ts`, `mocks/handlers/index.ts`, `mocks/api.ts` (option `currentUserId`, 401 for unauthenticated non-auth paths), `mocks/seed/cloneUser.ts`, `mocks/db.ts` (`activeUserId: string | null`), `mocks/handlers/demo.ts` (switch-user also logs in); tests `tests/unit/mocks/auth.test.ts`, `tests/unit/mocks/cloneUser.test.ts`.

**Interfaces:**
- Produces:
  - **Mock auth endpoints** with the backend contract:
    - register: name, email and password validation codes, `emailTaken`, then 201 `UserDto` and logs in;
    - login with demo emails and `DEMO_PASSWORD = 'demo-password'`;
    - wrong credentials give 401 `auth.invalidCredentials`;
    - refresh gives 204 when logged in and 401 `auth.sessionExpired` otherwise;
    - logout gives 204 and sets `activeUserId = null`.
  - **`createMockApi({ …, currentUserId?: () => string | undefined })`:** when given, it is used as the session user instead of `activeUserId`, and an unknown id is seeded through `cloneUserData(state, fromUserId: 'usr_anna', toUserId)`, which remaps every id. Without a session, any path outside `/v1/auth` gives 401.
- [ ] **Tests:**
  - Register then GET `/v1/me` returns the new user.
  - Login as Anna with `demo-password` returns her user.
  - A wrong password gives 401 `auth.invalidCredentials`.
  - After logout, `/v1/accounts` gives 401.
  - In hybrid mode, the id `u-real-1` gets accounts, transactions and so on equal in count to Anna's, and no id is shared with Anna's rows.
  - Seeding twice does not duplicate.
- [ ] Implement, test, commit `feat: mock authentication and demo data for real users in hybrid mode`.

### Task 4: Session, route middleware and safe redirects

**Files:** `app/shared/auth/authApi.ts`, `useSession.ts`, `safeRedirect.ts`, `app/middleware/auth.global.ts`, `app/plugins/session.ts` (wires `sessionEvents.onExpired` → clear cache → navigate); tests `tests/unit/shared/safeRedirect.test.ts`.

**Interfaces:**
- Produces:
  - `authApi(api)` with `register(body)`, `login(body)`, `logout()` and `deleteAccount(password)`.
  - `useSession()` returning `{ user: ComputedRef<UserDto | undefined>, status: ComputedRef<'unknown' | 'authenticated' | 'anonymous'>, login, register, logout }`. Login and register set the `['me']` query data; logout clears the whole query cache.
  - `safeRedirect(value: unknown): string` returns the value only if it is a string starting with a single `/` and not `//` or `/\`; otherwise it returns `'/'`.
  - Public pages are the localized `login` and `register`.
- [ ] **Tests:** `safeRedirect('/budgets?period=2026-10')` returns the input; `safeRedirect('https://evil.example')`, `'//evil.example'`, `'/\\evil.example'` and `undefined` all return `'/'`.
- [ ] Implement, test, commit `feat: session state, route protection and safe redirects`.

### Task 5: Login and register pages

**Files:** `app/layouts/auth.vue`, `app/pages/login.vue`, `app/pages/register.vue`, `app/features/auth/components/LoginForm.vue`, `RegisterForm.vue`, `PasswordField.vue`, `app/features/auth/schemas/*`, i18n keys `auth.*` and the missing `validation.*` codes in all four locales; e2e `tests/e2e/auth.spec.ts`.

**Interfaces:**
- Consumes: `useSession`, `useServerErrors`, `focusFirstInvalid`, `FormRow` (existing shared helpers).
- Produces: the UI from Decisions. Vuelidate rules mirror the backend:
  - name: required, at most 40 after trim;
  - email: required, at most 254, matches `^[^\s@]+@[^\s@]+\.[^\s@]+$`;
  - password: 10 to 128.

  Server field errors map onto fields, `auth.invalidCredentials` / 429 / `auth.sessionExpired` (from `?expired=1`) map to the message block, and the submit button is disabled while the request runs. The demo hint shows only in pure mock mode.
- [ ] **E2E** (pure mock mode, desktop and mobile):
  - Visiting `/budgets` anonymously lands on `/login?redirect=%2Fbudgets`; logging in as Anna returns to `/budgets`.
  - A wrong password shows the invalid-credentials message.
  - Registering a new user lands on `/`, and that user's data shows on the overview.
  - Registering with an existing email shows the emailTaken error on the email field.
  - `/login?redirect=//evil.example` goes to `/` after login.
  - The pages render in pl and uk.
- [ ] Implement, run the full suite, commit `feat: login and registration pages`.

### Task 6: Logout, account deletion and existing E2E on a logged-in session

**Files:** `app/shared/components/AppSidebar.vue` (footer: user name + logout), `app/pages/settings.vue` and its profile section (logout button), delete-account dialog (password mode with real auth), settings demo section hidden in hybrid mode; `playwright.config.ts` (setup project logging in as Anna, `storageState`), `tests/e2e/auth.setup.ts`, `tests/e2e/logout.spec.ts`; existing specs adjusted only where they assumed no session.

**Interfaces:**
- Consumes: `useSession`, `authApi.deleteAccount`.
- [ ] **E2E:**
  - Logout from the sidebar lands on `/login`; Back then shows the login page, not the previous screen's data.
  - Logout from Settings on mobile does the same.
  - The demo user switch still works in pure mock mode.
  - The whole previous suite passes on the logged-in storage state.
- [ ] Implement, run the full suite, commit `feat: logout and account deletion with real authentication`.

### Task 7: Hybrid smoke against the real backend

**Files:** `\\wsl.localhost\Debian\home\jaloqa\dock.mita-work\scripts\hybrid-smoke.sh` (outside the repo), `tests/e2e-hybrid/auth.hybrid.spec.ts`, `playwright.hybrid.config.ts`, a `package.json` script `test:e2e:hybrid`, `README`/`CLAUDE.md` section "Running against the backend".
- [ ] **The smoke script:**
  1. starts the backend (`docker compose up -d --build` in `~/dock.mita.backend`);
  2. runs the frontend dev server with `NUXT_PUBLIC_API_REAL_PATHS=/v1/auth,/v1/me,/v1/settings` and `NUXT_API_PROXY_TARGET=http://localhost:8080`;
  3. runs the hybrid spec: register, then `/v1/me` shows the name in Settings, then change the base currency and reload (the value is kept, served by the backend), then logout, then login again, then delete the account, after which the old credentials are rejected;
  4. tears everything down.
- [ ] Run it, commit `test: end-to-end login against the real backend in hybrid mode`.

### Task 8: Pull request

- [ ] Rebase on `origin/develop`, fold fix commits into their task commits, then run lint, typecheck, unit tests, the full E2E suite and the hybrid smoke. Push, open a PR (plain description), wait for `check-source-branch`, then `gh pr merge --rebase`.
