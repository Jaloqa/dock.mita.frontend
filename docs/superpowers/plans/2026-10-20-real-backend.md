# Real Backend Implementation Plan

**Goal:** The app runs on the real backend by default in development and production, with the pre-deployment blockers fixed (real client address through the Nitro proxy, bounded rate cache), an end-to-end suite and a Docker smoke against the real backend, while pure mock mode stays for the existing E2E suite.

**Architecture:**
- **Two API modes:** `NUXT_PUBLIC_API_MOCKS=false` (default) sends every request over HTTP to the same-origin Nitro proxy; `NUXT_PUBLIC_API_MOCKS=true` is pure mock mode (demo data, demo UI) used by `bun run test:e2e`. The hybrid routing mode is removed: every endpoint except `/v1/demo/*` is real, and the demo endpoints only make sense on mock data.
- **Client address:** the Nitro proxy appends the address of its peer to `X-Forwarded-For` (and its scheme to `X-Forwarded-Proto`); the backend trusts forwarded headers only from configured networks and walks back at most `ForwardedHeaders:ForwardLimit` hops, so the auth and session rate limits count each real client.
- **Running together:** the backend stack (`dock.mita.backend`, `docker compose up -d --build`, port 8080) and the frontend stack (`dock.mita.frontend`, `docker compose up --build`, port 3000) stay independent; the frontend container reaches the backend through `host.docker.internal:8080`.

**Tech Stack:** Backend: .NET 10, ASP.NET Core forwarded headers middleware, HybridCache, xUnit, Shouldly, Testcontainers. Frontend: Nuxt 4 / Nitro (h3 1.15), bun:test, Playwright 1.64.1. No new packages in either repo.

**Spec:** The scope given for this stage (real API as the default, demo UI only in pure mock mode, the pre-deployment blockers from the ledgers, a real-backend E2E run and Docker smoke, docs), plus:
- Backend: `CLAUDE.md`, `docs/STACK.md`, `docs/api-contract.md`, `README.md` ("Configuration", forwarded headers paragraph), `src/Mita.Api/Extensions/ForwardedHeadersExtensions.cs`, `src/Mita.Api/Configuration/TrustedProxiesOptions.cs`, `src/Mita.Api/Features/Rates/GetRates/*`, `src/Mita.Api/Behaviors/CachingBehavior.cs`.
- Frontend: `CLAUDE.md` ("Mocks", "Running against the backend", "Commands"), `server/middleware/apiProxy.ts`, `server/utils/apiProxy.ts`, `app/plugins/api.ts`, `app/middleware/auth.global.ts`, `app/shared/api/apiMode.ts`, `tests/e2e-hybrid/*`.
- Ledgers in `dock.mita-work`: `auth-login-ledger.md` (R18 client IP through the proxy, "real mode with empty apiProxyTarget: other SSR requests recurse into Nuxt"), `accounts-rates-ledger.md` (R12 unbounded `/v1/rates` cache entries), `open-questions.md` ("[backend-auth] Client IP behind the ingress").

## Global Constraints

- Each repo's `CLAUDE.md` and `docs/STACK.md` are binding. No new packages.
- Conventional Commits, English, no code comments except a genuinely controversial decision (explain why).
- Commits, code, comments and committed files never mention any assistant or tool that wrote them; no `Co-Authored-By` or "Generated with" lines.
- Backend: build passes with warnings as errors; `CancellationToken` passed through; test names `Should_X_When_Y`.
- Frontend: Biome clean (`bun run lint`), `bun run typecheck` with 0 `error TS`, `bun test tests/unit` green, no `any`, every user-facing string through i18n.
- Tests never call the real NBP API (a Docker smoke may).
- Docker work never touches the `pgdb` container or the developer's frontend dev container (`dock-mita-frontend-web-1`, port 3000, compose project `dock-mita-frontend`). Smoke stacks use their own compose project name and port 3100.

## Review Focus

- A client that sends its own `X-Forwarded-For` through the Nitro proxy must not pick its rate-limit bucket: the proxy appends the real peer, and with `ForwardLimit` 1 the backend uses only that last entry (Task 4 test "keeps the incoming chain and appends the peer"; Task 1 test with a spoofed first entry).
- A peer address Node reports as IPv4-mapped IPv6 (`::ffff:172.18.0.1`) is forwarded as plain IPv4 so one client has one bucket key (Task 4 test).
- A production image started without `NUXT_API_PROXY_TARGET` must answer `/v1/**` with a 503 ProblemDetails instead of rendering Nuxt pages for API paths (and recursing on SSR) (Task 4 test on `isApiPath` + middleware step).
- A rates request for any other date than today must not create a cache entry, while today's rates stay cached and invalidated by the sync (Task 2 tests).
- Running `bun run test:e2e` after copying `.env.example` (which now says real mode) must still run on mocks: the Playwright web server forces `NUXT_PUBLIC_API_MOCKS=true` (Task 3 step).

---

## Decisions

| Topic | Decision | Cost if wrong |
|---|---|---|
| Hybrid mode | Removed (routing transport, `NUXT_PUBLIC_API_REAL_PATHS`, mock `currentUserId`, demo-data cloning for real users). Only `/v1/demo/*` would stay mocked, and demo state is meaningless for a real user | Re-adding a routing transport if a future endpoint ships to the frontend before the backend |
| Default mode | `runtimeConfig.public.apiMocks` defaults to `false`; `.env.example` says `false` | A developer without the backend running sees the login page fail until they start it or set `NUXT_PUBLIC_API_MOCKS=true` |
| Mock E2E | `bun run test:e2e` keeps pure mock mode: the Playwright web server runs `NUXT_PUBLIC_API_MOCKS=true bun run dev`; an external server (`E2E_BASE_URL`) must be started with that variable | None |
| Running together | Two independent compose stacks; the frontend container's proxy target defaults to `http://host.docker.internal:8080` in `compose.yaml` (not only in the dev override). One command per repo | Two commands instead of one |
| Frontend proxy target variable in compose | `NUXT_API_PROXY_TARGET: ${COMPOSE_API_PROXY_TARGET:-http://host.docker.internal:8080}` so the `.env` value for local `bun run dev` (`http://localhost:8080`) does not leak into the container | One more variable name |
| Forwarded chain | The proxy appends its peer address to `X-Forwarded-For` and its own scheme to `X-Forwarded-Proto`, never trusting incoming values itself; the backend decides trust | None |
| Unknown peer address | Both forwarded headers are sent empty (drops a client-supplied chain), so the backend uses the proxy address | Such requests share one bucket (not observed with Node sockets) |
| Forward limit | New `ForwardedHeaders:ForwardLimit` (1 to 10, default 1). Behind an ingress in front of the Nitro proxy, set 2 and trust the pod network | None; default unchanged |
| Trusted networks in the backend compose | `172.16.0.0/12` and `192.168.0.0/16` (Docker's default address pools) in `compose.yaml`; only the compose stack, never the defaults | A LAN client reaching port 8080 directly could pick its rate-limit bucket in a local dev stack |
| Empty proxy target | `/v1` and `/v1/**` answer 503 `application/problem+json` "API proxy target is not configured" | None in mock mode (the browser never calls the server's `/v1`) |
| Rates cache (R12) | Only today's date (the `date`-less default or an explicit today) is cached; other dates are computed from PostgreSQL on every request | Past-date lookups cost a few indexed queries each |
| Real-backend suite | `tests/e2e-hybrid` becomes `tests/e2e-real` (`*.real.spec.ts`, `playwright.real.config.ts`, `bun run test:e2e:real`), plus checks that demo UI is hidden and a navigation spec over every page | Test-only |
| Docker smoke | `dock.mita-work/scripts/rb-real-smoke.sh`, outside the repos like earlier smokes; the committed docs describe the manual steps | Rename only |

---

### Task 1: Backend forward limit and trusted Docker networks

Repo `dock.mita.backend`, branch `feature/forwarded-headers-and-hardening`.

**Files:**
- Modify: `src/Mita.Api/Configuration/TrustedProxiesOptions.cs` (add `ForwardLimit`, validate it)
- Modify: `src/Mita.Api/Extensions/ForwardedHeadersExtensions.cs` (apply `ForwardLimit`)
- Modify: `compose.yaml` (`api.environment`)
- Modify: `README.md` (configuration rows, forwarded headers paragraph, running with the frontend), `CLAUDE.md` ("Commands": `cp .env.example .env` before `docker compose up -d`)
- Test: `tests/Mita.Api.IntegrationTests/ForwardedHeadersTests.cs`, `tests/Mita.Api.UnitTests/Configuration/OptionsValidatorTests.cs`

**Interfaces:**
- Produces: config key `ForwardedHeaders:ForwardLimit` (`int`, default `1`, valid `1..10`); compose env `ForwardedHeaders__KnownNetworks__0=172.16.0.0/12`, `ForwardedHeaders__KnownNetworks__1=192.168.0.0/16`.

- [ ] **Step 1: Write the failing tests**

In `ForwardedHeadersTests` (reuse `Limited`, extended with an optional extra setting, and `LoginStatusesAsync`; proxy `10.0.0.5`, `KnownNetworks:0 = 10.0.0.0/24`, `AuthPermitLimit = 2`):
- `Should_LimitEachClientSeparately_When_TwoTrustedHopsAndForwardLimitIsTwo`: `ForwardLimit = 2`; `"203.0.113.1, 10.0.0.9"` ×3 → `[401, 401, 429]`; then `"203.0.113.2, 10.0.0.9"` ×1 → `[401]`.
- `Should_UseLastHopOnly_When_ForwardLimitIsDefault`: no `ForwardLimit`; `"203.0.113.1, 10.0.0.9"` ×2 → `[401, 401]`; `"203.0.113.2, 10.0.0.9"` ×1 → `[429]` (both keyed by `10.0.0.9`).
- `Should_IgnoreSpoofedEntry_When_ForwardLimitIsDefault`: no `ForwardLimit`; `"198.51.100.1, 203.0.113.1"` ×2 → `[401, 401]`; `"198.51.100.2, 203.0.113.1"` ×1 → `[429]` (a client-written first entry never picks the bucket).

In `OptionsValidatorTests`: `TrustedProxiesOptions { ForwardLimit = 0 }` and `{ ForwardLimit = 11 }` fail with a message containing `ForwardedHeaders:ForwardLimit`; `1` and `10` pass.

- [ ] **Step 2: Run and see them fail**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/be-run.sh 'dotnet test --filter "FullyQualifiedName~ForwardedHeadersTests|FullyQualifiedName~OptionsValidatorTests"'`
Expected: the forward-limit test and the validator cases fail (property missing / limit not applied).

- [ ] **Step 3: Implement**

`public int ForwardLimit { get; set; } = 1;` on `TrustedProxiesOptions`; the validator adds `"ForwardedHeaders:ForwardLimit must be between 1 and 10."` outside `1..10`. In `AddMitaForwardedHeaders` set `forwarded.ForwardLimit = trusted.Value.ForwardLimit` before the early return (it applies with the loopback default too).

- [ ] **Step 4: Run and see them pass**

Same command. Expected: all pass.

- [ ] **Step 5: Compose and docs**

`compose.yaml` `api.environment` gains the two `ForwardedHeaders__KnownNetworks__N` entries above. README: a `ForwardedHeaders:ForwardLimit` row ("maximum forwarded hops walked back, each through a trusted proxy; set 2 when an ingress sits in front of the frontend's proxy" / default `1`); the paragraph after the table says the frontend's Nitro proxy appends the client address, that the compose stack trusts Docker's private networks, and that a cluster sets the pod network plus `ForwardLimit` 2 behind ingress -> frontend -> API; a "Run with the frontend" section: start this stack, then in `dock.mita.frontend` run `docker compose up --build` and open `http://localhost:3000` (the frontend proxies `/v1` to `host.docker.internal:8080`). README "Run locally" and CLAUDE.md "Commands" keep `cp .env.example .env` before `docker compose up -d --build`.

- [ ] **Step 6: Full backend check and commit**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/be-run.sh 'dotnet build -warnaserror && dotnet test'` — expected 0 warnings, all tests pass.

```bash
git add src/Mita.Api/Configuration/TrustedProxiesOptions.cs src/Mita.Api/Extensions/ForwardedHeadersExtensions.cs compose.yaml README.md CLAUDE.md tests/Mita.Api.IntegrationTests/ForwardedHeadersTests.cs tests/Mita.Api.UnitTests/Configuration/OptionsValidatorTests.cs
git commit -m "feat: configurable forward limit and trusted docker networks"
```

### Task 2: Cache exchange rates only for today

Repo `dock.mita.backend`, same branch.

**Files:**
- Modify: `src/Mita.Api/Common/Caching/ICachedQuery.cs` (add `bool IsCacheable => true;`)
- Modify: `src/Mita.Api/Behaviors/CachingBehavior.cs` (call `next` directly when `!request.IsCacheable`)
- Modify: `src/Mita.Api/Features/Rates/GetRates/GetRatesQuery.cs`, `GetRatesEndpoint.cs`
- Modify: `docs/api-contract.md` (Rates section: one sentence that only today's rates are cached for up to an hour and invalidated by the sync)
- Test: `tests/Mita.Api.IntegrationTests/Features/Rates/RatesTests.cs`

**Interfaces:**
- Produces: `ICachedQuery.IsCacheable` (default `true`); `GetRatesQuery(string Date, string? From, string? To, string Today)` with `IsCacheable => Date == Today`.

- [ ] **Step 1: Write the failing tests**

In `RatesTests` (isolated data, `TestData.AddRatesAsync` writes straight to the database without invalidating the cache):
- `Should_ReadStoredRows_When_PastDateRequestedAgain`: add `(EUR, "2026-03-02", 4.10m)`; GET `date=2026-03-04&from=EUR&to=PLN` → `4.10`; add `(EUR, "2026-03-03", 4.27m)`; same GET → `4.27`.
- `Should_KeepTodaysRatesCached_When_RowsAddedWithoutSync`: add EUR for yesterday `4.0m`; GET `from=EUR&to=PLN` (no date) → `4.0`; add EUR for today `4.5m`; same GET → still `4.0`. Yesterday/today from `DateTime.UtcNow` as the existing tests do.

- [ ] **Step 2: Run and see the first one fail**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/be-run.sh 'dotnet test --filter "FullyQualifiedName~RatesTests"'`
Expected: `Should_ReadStoredRows_When_PastDateRequestedAgain` fails (second read is `4.10` from the cache); the today test passes already and pins behaviour.

- [ ] **Step 3: Implement**

Default interface member `IsCacheable`; the behavior returns `await next(cancellationToken)` before building keys when it is false. The endpoint computes `today = IsoDate.ToWire(DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime))`, passes `date ?? today` and `today`. The cache key format stays `rates:{Date}:{From ?? "*"}:{To ?? "*"}`.

- [ ] **Step 4: Run and see them pass**

Same filter, then `dotnet build -warnaserror && dotnet test` — all pass (including `RatesSynchronizerTests.Should_InvalidateRatesCache_When_RowsInserted`).

- [ ] **Step 5: Commit**

```bash
git add src/Mita.Api/Common/Caching/ICachedQuery.cs src/Mita.Api/Behaviors/CachingBehavior.cs src/Mita.Api/Features/Rates/GetRates docs/api-contract.md tests/Mita.Api.IntegrationTests/Features/Rates/RatesTests.cs
git commit -m "fix: cache exchange rates only for today"
```

### Task 3: Real API by default, pure mock mode for tests

Repo `dock.mita.frontend`, branch `feature/real-backend`.

**Files:**
- Modify: `nuxt.config.ts` (`public.apiMocks: false`, drop `apiRealPaths`)
- Modify: `app/shared/api/apiMode.ts` (`ApiMode = 'mock' | 'real'`, `resolveApiMode(apiMocks: boolean): ApiMode`), `app/shared/composables/useApiMode.ts`
- Modify: `app/plugins/api.ts` (no routing; `loadMockTransport()` without options)
- Modify: `app/shared/api/transports/mock.ts` (no options), `mocks/api.ts` (drop `currentUserId` and the `cloneUserData`/`DEMO_SOURCE_USER` path, and any helper left unused)
- Modify: `app/middleware/auth.global.ts` (server probe when `mode === 'real'` and the proxy target is set)
- Modify: `app/shared/user/useCurrentUser.ts` (comment now: the auth middleware treats a missing entry as an unknown session, so it must outlive its observers)
- Delete: `app/shared/api/transports/routing.ts`, `tests/unit/shared/routingTransport.test.ts`
- Modify: `tests/unit/shared/apiMode.test.ts`, `tests/unit/mocks/auth.test.ts` (drop the "mock api in hybrid mode" block)
- Modify: `.env.example` (`NUXT_PUBLIC_API_MOCKS=false`, no `NUXT_PUBLIC_API_REAL_PATHS`, keep `NUXT_API_PROXY_TARGET=http://localhost:8080`)
- Modify: `playwright.config.ts` (`webServer.command: 'NUXT_PUBLIC_API_MOCKS=true bun run dev'`)
- Modify: `compose.yaml` (`extra_hosts: ['host.docker.internal:host-gateway']`, `environment: NUXT_API_PROXY_TARGET: ${COMPOSE_API_PROXY_TARGET:-http://host.docker.internal:8080}`), `compose.override.yaml` (drop the now duplicated `extra_hosts`/`environment`)

**Interfaces:**
- Produces: `resolveApiMode(apiMocks: boolean): 'mock' | 'real'`; `useApiMode()` unchanged in name. Demo UI (`DemoSection`, `DeleteAccountDialog`, login demo hint) stays behind `useApiMode() === 'mock'` (already so).

- [ ] **Step 1: Update the unit tests first**

`apiMode.test.ts`: `resolveApiMode(true)` → `'mock'`, `resolveApiMode(false)` → `'real'`. Remove the routing transport test file and the hybrid block of `auth.test.ts`.

- [ ] **Step 2: Run and see them fail**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/wsl-run.sh 'bun test tests/unit'`
Expected: `apiMode.test.ts` fails (old signature returns `'mock'` only via real paths).

- [ ] **Step 3: Implement the files above**

`grep -rn "apiRealPaths\|REAL_PATHS\|routing\|currentUserId\|hybrid" app mocks tests/unit nuxt.config.ts .env.example compose*.yaml playwright.config.ts` must print nothing afterwards.

- [ ] **Step 4: Verify**

Run: `bun test tests/unit`, `bun run lint`, `bun run typecheck` (0 `error TS`). Then the mock E2E suite on port 3100 as in `dock.mita-work/environment.md`, starting the dev server with `NUXT_PUBLIC_API_MOCKS=true bun run dev --port 3100`. Expected: same pass count as before the change (189 passed / 50 skipped at the last stage), 0 failed.

- [ ] **Step 5: Commit**

```bash
git add -A nuxt.config.ts app mocks tests/unit .env.example playwright.config.ts compose.yaml compose.override.yaml
git commit -m "feat: real backend by default, pure mock mode for tests"
```

### Task 4: Proxy forwards the client address and refuses API paths without a target

Repo `dock.mita.frontend`, same branch.

**Files:**
- Modify: `server/utils/apiProxy.ts`
- Modify: `server/middleware/apiProxy.ts`
- Test: `tests/unit/shared/apiProxy.test.ts`

**Interfaces:**
- Produces in `server/utils/apiProxy.ts`:
  - `isApiPath(requestUrl: string): boolean` — path (before `?`) is `/v1` or starts with `/v1/`.
  - `forwardedHeaders(incoming: { forwardedFor?: string; forwardedProto?: string }, peer: { ip?: string; protocol: 'http' | 'https' }): { 'x-forwarded-for': string; 'x-forwarded-proto': string }`.
  - `resolveProxyUrl` unchanged.

- [ ] **Step 1: Write the failing tests**

```ts
describe('forwardedHeaders', () => {
  it('starts the chain with the peer', () => {
    expect(forwardedHeaders({}, { ip: '172.18.0.1', protocol: 'http' })).toEqual({
      'x-forwarded-for': '172.18.0.1',
      'x-forwarded-proto': 'http',
    })
  })
  it('keeps the incoming chain and appends the peer', () => {
    expect(
      forwardedHeaders({ forwardedFor: '203.0.113.9, 10.0.0.3', forwardedProto: 'https, https' }, { ip: '10.0.0.4', protocol: 'http' }),
    ).toEqual({ 'x-forwarded-for': '203.0.113.9, 10.0.0.3, 10.0.0.4', 'x-forwarded-proto': 'https, https, http' })
  })
  it('writes IPv4-mapped peers as IPv4', () => {
    expect(forwardedHeaders({}, { ip: '::ffff:172.18.0.1', protocol: 'http' })['x-forwarded-for']).toBe('172.18.0.1')
  })
  it('keeps IPv6 peers', () => {
    expect(forwardedHeaders({}, { ip: '2001:db8::1', protocol: 'https' })['x-forwarded-for']).toBe('2001:db8::1')
  })
  it('drops a client chain when the peer is unknown', () => {
    expect(forwardedHeaders({ forwardedFor: '198.51.100.1', forwardedProto: 'https' }, { protocol: 'http' })).toEqual({
      'x-forwarded-for': '',
      'x-forwarded-proto': '',
    })
  })
})
describe('isApiPath', () => {
  it.each(['/v1', '/v1/', '/v1/me', '/v1/me?x=1'])('is true for %s', (url) => expect(isApiPath(url)).toBe(true))
  it.each(['/', '/v10/me', '/en/login', '/v1me'])('is false for %s', (url) => expect(isApiPath(url)).toBe(false))
})
```

Blank entries of the incoming lists (`" , 1.2.3.4"`) are trimmed away before appending.

- [ ] **Step 2: Run and see them fail**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/wsl-run.sh 'bun test tests/unit/shared/apiProxy.test.ts'` — expected: import errors / failures.

- [ ] **Step 3: Implement**

Middleware: if `!isApiPath(url)` return; if the trimmed target is empty, `setResponseHeader(event, 'content-type', 'application/problem+json')`, status 503 and body `{ type: 'about:blank', title: 'API proxy target is not configured', status: 503 }`; otherwise `resolveProxyUrl` as now (null → return) and `proxyRequest(event, url, { headers: forwardedHeaders({ forwardedFor: getRequestHeader(event, 'x-forwarded-for'), forwardedProto: getRequestHeader(event, 'x-forwarded-proto') }, { ip: event.node.req.socket?.remoteAddress, protocol: getRequestProtocol(event, { xForwardedProto: false }) as 'http' | 'https' }) })`. Do not use `getRequestIP(event, { xForwardedFor: true })`; the incoming header is never trusted here.

- [ ] **Step 4: Verify**

`bun test tests/unit`, `bun run lint`, `bun run typecheck`. Then a manual probe: `NUXT_API_PROXY_TARGET= bun run dev --port 3100` (real mode) and `curl -s -i http://localhost:3100/v1/me` → `503` with `application/problem+json`; stop the server.

- [ ] **Step 5: Commit**

```bash
git add server tests/unit/shared/apiProxy.test.ts
git commit -m "feat: forward the client address through the api proxy"
```

### Task 5: Real-backend E2E suite, Docker smoke and run guide

Repo `dock.mita.frontend`, same branch; the backend checkout stays on `feature/forwarded-headers-and-hardening` so its compose builds Tasks 1-2.

**Files:**
- Move: `tests/e2e-hybrid/*.hybrid.spec.ts` → `tests/e2e-real/*.real.spec.ts` (`git mv`); replace "hybrid"/"Hybrid" in names, emails (`real-${Date.now()}@example.com`) and titles
- Move: `playwright.hybrid.config.ts` → `playwright.real.config.ts` (`testDir: 'tests/e2e-real'`, project `real`)
- Create: `tests/e2e-real/navigation.real.spec.ts`
- Modify: `tests/e2e-real/auth.real.spec.ts` (demo UI hidden)
- Modify: `package.json` (`test:e2e:real` replaces `test:e2e:hybrid`)
- Modify: `CLAUDE.md` ("Mocks" → "API modes", "Running against the backend" → "Running the app", "Commands"); do not touch the git-workflow rule texts
- Create (outside the repo): `/home/jaloqa/dock.mita-work/scripts/rb-real-smoke.sh`

**Interfaces:**
- Consumes: Task 3 (real mode default, `COMPOSE_API_PROXY_TARGET`), Task 4 (proxy headers), Tasks 1-2 (backend compose).

- [ ] **Step 1: Rename the suite**

`git mv` the files and config, update `package.json`. `grep -rni hybrid tests playwright*.ts package.json` prints nothing.

- [ ] **Step 2: Extend the auth spec**

Before registering, on `/login` (submit enabled): `page.getByText('Demo accounts:')` has count 0 (en `auth.login.demoHint`). In `openSettings`, after the Profile name check: `section(page, 'Demo')` has count 0 and `page.getByText('This section exists only in demo mode.')` has count 0 (en `settings.demo.title` / `settings.demo.caption`).

- [ ] **Step 3: Write `navigation.real.spec.ts`**

`test('a new real user opens every page without errors')`: register a unique user (same helper style as the other specs), then for each entry `Overview`, `Transactions`, `Budgets`, `Goals`, `Accounts`, `Reports`, `Settings` click the link in the visible `Main navigation`, expect the URL path (`/`, `/transactions`, `/budgets`, `/goals`, `/accounts`, `/reports`, `/settings`) and the level-1 heading with that exact label (Overview: whatever the page header shows for an empty user, checked against `app/pages/index.vue`), and no error state (the shared error-state component's text in `en.json`, count 0); finally delete the account through Settings > Data > Delete account with the password and expect `/login`.

- [ ] **Step 4: Write the smoke script `rb-real-smoke.sh`**

Based on `al-hybrid-smoke.sh` (same teardown rules: create backend `.env` only if missing and remove it if created, `down -v` only for volumes it created, leave a backend stack that was already up, never touch `pgdb`), with these differences:
- Backend: `docker compose -f compose.yaml -f compose.override.yaml -f <temp file> up -d --build` where the temp file sets `api.environment.RateLimiting__AuthPermitLimit: "100"` (the suite makes more than 10 auth calls a minute); skip the temp file when the stack was already up.
- Frontend: production image in its own project: `APP_PORT=3100 docker compose -p dock-mita-frontend-smoke -f compose.yaml -f <temp file> up -d --build`, the temp file setting `web.environment.NUXT_PUBLIC_API_MOCKS: "false"` (a developer `.env` cannot switch the smoke to mocks); fail fast if port 3100 is busy; teardown `docker compose -p dock-mita-frontend-smoke -f compose.yaml down` and `docker image rm dock-mita-frontend` only if the image did not exist before.
- Wait for `http://localhost:8080/health/ready` and `http://localhost:3100/login` (200), then `curl` `http://localhost:3100/v1/me` → `401` (the proxy reaches the backend).
- Run the Playwright container (`mcr.microsoft.com/playwright:v1.64.1-noble`, `--network host`, `E2E_BASE_URL=http://localhost:3100`) with `npx playwright test --config playwright.real.config.ts --reporter=line`.
- On failure print the last 40 lines of both stacks' logs; always remove `test-results` and `playwright-report` afterwards.

- [ ] **Step 5: Run the smoke**

Run: `wsl.exe -d Debian -- bash /home/jaloqa/dock.mita-work/scripts/rb-real-smoke.sh`
Expected: 6 passed, exit code 0, no containers of either smoke project left (`docker ps -a --filter name=smoke`), `dock-mita-frontend-web-1` and `pgdb` untouched.

- [ ] **Step 6: Docs**

`CLAUDE.md`:
- "API modes": real by default (`NUXT_PUBLIC_API_MOCKS=false`) through the same-origin Nitro proxy to `NUXT_API_PROXY_TARGET`, which appends the client address to `X-Forwarded-For`/`X-Forwarded-Proto` and answers `/v1/**` with 503 when no target is set; pure mock mode (`NUXT_PUBLIC_API_MOCKS=true`) with the demo endpoints and demo UI, used by `bun run test:e2e`; `mocks/` loaded only in mock mode.
- "Running the app": backend `cp .env.example .env` once and `docker compose up -d --build` in `dock.mita.backend`; frontend `docker compose up --build` (dev, hot reload) or `cp .env.example .env && bun run dev`; open `http://localhost:3000`; mock mode `NUXT_PUBLIC_API_MOCKS=true bun run dev`; real-backend suite `bun run test:e2e:real` (`E2E_BASE_URL`, rate limit of 10 auth calls per minute per client: raise `RateLimiting__AuthPermitLimit` for the backend or wait between runs), what each spec does in one line, and the Docker smoke steps (backend stack, frontend production image on another port with its own project name, Playwright against it); deployed proxy: set the backend's `ForwardedHeaders` networks and `ForwardLimit` 2 behind an ingress.
- "Commands": `test:e2e:real` replaces `test:e2e:hybrid`; note `bun run test:e2e` runs on mocks.

- [ ] **Step 7: Verify and commit**

`bun run lint`, `bun run typecheck`, `bun test tests/unit`.

```bash
git add -A tests/e2e-real tests/e2e-hybrid playwright.real.config.ts playwright.hybrid.config.ts package.json
git commit -m "test: end-to-end suite against the real backend"
git add CLAUDE.md
git commit -m "docs: run guide for the real backend"
```

## Deferred (not in this plan)

Nice-to-have items stay in the ledgers: IPv6 rate-limit partition by /64, `__Host-` cookie prefix and XSRF on logout, refresh-token purge, email-change password confirmation, R19 (401 after a successful refresh), `%5c` in the proxy path, migration job for deployments (`Database:ApplyMigrationsOnStartup` false by default), UTF-8 `LC_CTYPE` requirement (C9), the minor test/style items of earlier ledgers.
