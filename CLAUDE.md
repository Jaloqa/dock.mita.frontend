# CLAUDE.md

Frontend of dock.mita. Guidance for working in this repository.

## Stack

The agreed stack is in [docs/STACK.md](docs/STACK.md). Do not introduce libraries outside it without asking. Items marked TBD there need confirmation before use.

- Nuxt 4 (Vue 3, Composition API, `<script setup lang="ts">`), file-based routing in `pages/`
- Rspack as the bundler (Nuxt Rspack builder)
- Bun as the package manager, script runner and build tool; Node 26 runs the dev server and production (`nuxt dev` is not reliable under the Bun runtime)
- TypeScript in strict mode
- Tailwind CSS with PrimeVue for components; ShadCN Vue is TBD
- TanStack Query (`@tanstack/vue-query`) for server state, TanStack Table for tables
- Typed API client generated from the backend OpenAPI document
- Forms validated with Vuelidate
- i18n: `@nuxtjs/i18n` (vue-i18n), locales `en` (default), `pl`, `ru`, `uk`
- Biome for linting and formatting
- Testing: `bun test` for unit tests of pure logic, Playwright for end-to-end
- Analytics: PostHog and Google Analytics
- Docker images deployed to Kubernetes through Argo CD (GitOps)

PrimeVue stays on 4.x (`primevue`, `@primevue/nuxt-module` 4.x, `@primeuix/themes` 2.x, `primeicons` 7.x), the last MIT-licensed releases. PrimeVue 5 and PrimeIcons 8 moved to the commercial PrimeUI license; do not upgrade without a license decision.

PrimeVue components that need an extra package (`Chart` needs Chart.js, `Editor` needs Quill, `Form`/`FormField` need `@primevue/forms`) are excluded in `nuxt.config.ts`. Remove a component from the exclude list only together with adding its package.

## Architecture: Vertical Slice

Code is organised by feature, mirroring the backend. A feature owns its components, composables, API calls, schemas and types.

```
app/
  features/
    <feature>/
      components/
      composables/
      api/
      schemas/
      types.ts
  shared/
    components/      # generic UI used by several features
    composables/
    utils/
  pages/             # thin route components that compose features
  layouts/
  middleware/
  plugins/
i18n/
  locales/
    en.json
    pl.json
    ru.json
    uk.json
server/              # only if a BFF layer is needed
tests/
  e2e/
```

Rules:

- Pages are thin: fetch through a feature composable and compose feature components.
- A feature must not import from another feature's internals. Share through `shared/` or via the page that composes both.
- Do not move code into `shared/` until it is used by three features.
- Server data goes through TanStack Query in feature composables (`useQuery` / `useMutation`). Query keys are defined per feature in one place. Mutations invalidate the queries they affect. Never cache server data in a store.
- The API client types are generated, never hand-written. Regenerate after backend contract changes.
- Component props and emits are fully typed. No `any`; use `unknown` and narrow.
- Component files use PascalCase, composables use `useXxx`, one component per file.
- Prefer Tailwind utility classes. Avoid custom CSS unless a utility cannot express it.
- Accessibility is required: semantic elements, labels for inputs, keyboard navigation.

## API modes

`runtimeConfig.public.apiMocks` (`NUXT_PUBLIC_API_MOCKS`) switches the transport of the shared API client between `http` and `mock`. Mock design: [docs/superpowers/specs/2026-10-15-frontend-mocks-design.md](docs/superpowers/specs/2026-10-15-frontend-mocks-design.md).

- Real mode is the default (`NUXT_PUBLIC_API_MOCKS=false`): every request goes over HTTP to the real backend.
- The HTTP transport is same-origin: a Nitro middleware (`server/middleware/apiProxy.ts`) forwards `/v1/**` to `NUXT_API_PROXY_TARGET` (`http://localhost:8080` locally, `http://host.docker.internal:8080` in Docker, where `compose.yaml` takes it from `COMPOSE_API_PROXY_TARGET` so the `.env` value for `bun run dev` does not leak into the container). The target is read at runtime from `runtimeConfig.apiProxyTarget`, so a built image honours the variable. The proxy appends the client address it sees to `X-Forwarded-For` and its own scheme to `X-Forwarded-Proto`; the backend decides which proxies it trusts. When no target is set, `/v1` and `/v1/**` answer 503 `application/problem+json`. Server-side rendered requests reach the backend with the proxy's own address (no client address), which is fine because SSR only calls `GET /v1/me`, which is not rate-limited.
- Pure mock mode (`NUXT_PUBLIC_API_MOCKS=true`) serves every request from mocks, including the demo endpoints (`/v1/demo/*`) and the demo UI (demo accounts on the login page, the Demo section in Settings). `bun run test:e2e` runs in this mode: its Playwright web server starts `NUXT_PUBLIC_API_MOCKS=true bun run dev --port 3100` (never reusing a running server) and `E2E_BASE_URL` defaults to `http://localhost:3100`; an external server selected with `E2E_BASE_URL` must be started with that variable.
- Feature API modules (`features/<x>/api`) call `apiClient` only. They never know which transport is active.
- The mock transport routes requests to handlers in `mocks/handlers`, which work on a `localStorage` database. Mock handlers behave like the real API: `/v1` paths, `userId` from the session, paginated lists, latency, RFC 9457 ProblemDetails for validation errors.
- `mocks/` is loaded only in mock mode. Removing mocks later means deleting `mocks/` and the mock transport; nothing else changes.

## Running the app

1. Start the backend from its repository (`dock.mita.backend`): `cp .env.example .env` once, then `docker compose up -d --build`. The API listens on `http://localhost:8080`; `GET /health/ready` answers 200 when it is up. Stop it with `docker compose down` (add `-v` to drop its database).
2. Start the frontend: `docker compose up --build` (dev target with hot reload, proxy target `http://host.docker.internal:8080`), or locally `cp .env.example .env && bun run dev`. Open `http://localhost:3000`.
3. Without the backend, run on mocks: `NUXT_PUBLIC_API_MOCKS=true bun run dev`.

### Real-backend suite

`bun run test:e2e:real` runs `tests/e2e-real` (`playwright.real.config.ts`, one worker, no web server) against a running app in real mode; `E2E_BASE_URL` selects it, `http://localhost:3000` by default. Every spec registers its own user with a unique email and deletes it at the end. The backend allows 10 register, login and delete calls per minute per client, and one run makes about 25 of them, so waiting between runs does not help against a stock backend (10 per minute): set `RateLimiting__AuthPermitLimit` (e.g. `100` in the backend's `.env`) for local runs.

- `auth`: demo UI is hidden, registers, changes the base currency, signs out and in, checks a wrong password and a rate-limited delete, deletes the account.
- `accounts`: creates accounts, transfers between them and archives one.
- `transactions`: adds an account and a transaction, edits and deletes it, and manages categories.
- `budgets-goals`: adds two accounts and an expense, creates and edits a budget, creates a goal and contributes to it (a transfer into the linked account), then deletes both.
- `overview-reports`: adds an account, an income and an expense, then checks the totals, recent transactions and spending breakdown on the overview and the averages, savings rate and spending structure on reports.
- `tags`: adds an account and two expenses with tags typed in the form, filters by tag, adds a suggested tag to a transaction, then renames and deletes tags in Settings and checks the rows.
- `currencies`: adds a JPY account and a KWD account and checks that their cards show the digits of their own currency, adds a JPY expense and checks the balance, then checks that the base currency list offers four currencies (the expense is priced into the base currency, so the backend needs a recent JPY rate: its rates sync provides one, and a backend started with `Rates__SyncEnabled=false` needs a `JPY` row in `exchange_rates` dated within the last 30 days; the `groups` spec likewise needs an `EUR` row, see below).
- `debts`: adds an account, opens Tools and Debts, lends from the account with a due date in the past (the card is overdue) and checks the balance, repays part of it and checks the balance again, borrows without an account, checks the summary and the debts card and the balance with debts on the overview (income and expense stay at zero), repays the rest so the debt moves to Settled, then deletes the borrowed debt.
- `groups`: opens Tools and Groups, creates the EUR group "Lisbon" with two more members, adds a 90 € expense split equally and a 100 PLN expense paid by another member with exact amounts at the suggested rate, checks the balances and the suggested transfers, records the first transfer, edits the first expense and reads its history, deletes the PLN expense, restores it from Deleted, shows the balances in PLN, then deletes the group. A second test, with its own user, creates the EUR group "Porto", turns on its share link, opens the link in a fresh browser context without a session, picks "Olya" and adds a 30 € expense, checks the balances and "Added by Olya" there and on the owner's page, checks that the anonymous context asked only for the link's own routes and the session probe (no settings, accounts, rates or owner group route) and that the link page is served with `Referrer-Policy: no-referrer`, turns the link off and checks that the anonymous page shows the dead link, then deletes the group. The figures of the first test assume an `EUR` rate of exactly 4.30 PLN (PLN → EUR 0.232558), so run it against a backend started with `Rates__SyncEnabled=false` and seeded with the `EUR` (4.30) and `JPY` (0.024764) rows of Docker smoke step 1, as the smoke script does; with the live rates sync the suggested rate differs and the spec fails.
- `navigation`: opens every page from the main navigation, Tools included, as a new user and checks its heading and that no section fails to load.

### Docker smoke

To check the production image against the backend without touching a running dev container:

1. Start the backend stack with a raised auth limit and without the rates sync: in `dock.mita.backend`, `docker compose -f compose.yaml -f compose.override.yaml -f <override> up -d --build`, where the override sets `services.api.environment.RateLimiting__AuthPermitLimit: "100"` and `services.api.environment.Rates__SyncEnabled: "false"`. The `groups` spec needs fixed rates (and the `currencies` spec a recent `JPY` rate), so once `http://localhost:8080/health/ready` answers 200, seed EUR at 4.30 PLN and JPY at 0.024764 PLN for today − 3 to today with `docker compose -f compose.yaml -f compose.override.yaml -f <override> exec -T postgres psql -U mita -d mita` and this SQL:

   ```sql
   INSERT INTO exchange_rates ("Currency", "Date", "PlnValue", "FetchedAt")
   SELECT seeded.code, CURRENT_DATE - n, seeded.pln_value, now()
   FROM (VALUES ('JPY', 0.024764), ('EUR', 4.30)) AS seeded(code, pln_value)
   CROSS JOIN generate_series(0, 3) AS n;
   ```
2. Start the frontend production image on another port with its own project name: `APP_PORT=3100 docker compose -p dock-mita-frontend-smoke -f compose.yaml -f <override> up -d --build`, where the override sets `services.web.image: dock-mita-frontend-smoke` (so the build does not retag `dock-mita-frontend`) and `services.web.environment.NUXT_PUBLIC_API_MOCKS: "false"`. Wait for `http://localhost:3100/login` (200); `http://localhost:3100/v1/me` answers 401 when the proxy reaches the backend.
3. Run Playwright against it: `docker run --rm --user 1000:1000 -e HOME=/tmp --network host --ipc=host -v "$PWD":/work -w /work -e E2E_BASE_URL=http://localhost:3100 mcr.microsoft.com/playwright:v1.64.1-noble npx playwright test --config playwright.real.config.ts --reporter=line`.
4. Tear down: `docker compose -p dock-mita-frontend-smoke -f compose.yaml down` and `docker image rm dock-mita-frontend-smoke` here, `docker compose down -v` in the backend (only if you started it for the smoke); remove `test-results` and `playwright-report` once any failure is understood.

### Deployed proxy

The backend trusts `X-Forwarded-For` only from the networks in its `ForwardedHeaders` settings and reads at most `ForwardedHeaders:ForwardLimit` entries from the end of the chain. Behind ingress -> frontend proxy -> API set `ForwardedHeaders__ForwardLimit=2` and trust the networks of both the ingress and the frontend pods (the pod network, plus the node addresses for a host-network ingress controller), so the rate limit sees the real client address.

## Internationalization

- No user-facing text is hard-coded. Every string goes through `t()` / `$t()`, including labels, placeholders, `aria-label`, page titles and validation messages.
- Locale files live in `i18n/locales/<locale>.json`, lazy-loaded. `en` is the source of truth and the fallback locale. Add a key to every locale in the same change.
- Keys are namespaced by feature and use camelCase: `orders.list.emptyState`, `shared.actions.save`. Generic strings go under `shared`.
- Use interpolation and pluralization instead of string concatenation.
- Vuelidate error messages map to i18n keys (`@vuelidate/validators` `helpers.withMessage` with `t()`), not literal text.
- Dates, numbers and currency are formatted with `useI18n` formatters (`d`, `n`), never manually.
- Routing strategy `prefix_except_default`: `en` has no prefix, other locales are prefixed (`/pl/...`, `/ru/...`, `/uk/...`). Build links with `useLocalePath`.
- Pluralization rules differ: `ru` and `uk` have three plural forms, `pl` has three, `en` has two. Always provide every form. Custom `pluralRules` for `ru`, `uk` and `pl` are registered in the i18n config, since vue-i18n defaults to English rules.
- The selected locale is persisted in a cookie and sent to the backend as `Accept-Language`.

## Design

Source of truth: Claude Design project "Mita — финансовый планер" (https://claude.ai/artifact/W7Jn2A5ccqeaw91PAtw5JH). Palette "Graphite and rose", light and dark themes.

Colors are defined once as semantic tokens (CSS variables in `app/assets/css/main.css`, mapped into the Tailwind theme and into a PrimeVue preset via `definePreset`, `primary` = rose, `surface` = graphite). Components use token names only, never raw hex values.

| Token | Light | Dark |
|---|---|---|
| `bg` | `#F2F3F5` | `#121317` |
| `surface` | `#FFFFFF` | `#1B1D23` |
| `ink` | `#15171C` | `#EEF0F3` |
| `muted` | `#5E636E` | `#9DA2AD` |
| `border` | `#E1E3E8` | `#2C2F37` |
| `track` | `#E7E9EE` | `#2C2F37` |
| `deep` (balance card) | `#25282F` | `#3A1E2C` |
| `deep-muted` | `#C9CCD3` | `#E8B9CC` |
| `accent` | `#C43F73` | `#E8679A` |
| `on-accent` | `#FFFFFF` | `#16080F` |

Chart series, in order: light `#25282F #C43F73 #7C818C #E59AB8 #B5B9C1 #F3D3E0`, dark `#E8679A #F08AB0 #C99AE8 #7FC7D9 #5A5F6B #3E424B`.

- Fonts: Manrope 400–700 for UI, JetBrains Mono 400–500 for every amount, percentage and numeric value. Loaded from Google Fonts in `nuxt.config.ts`.
- Radius: 8px small controls inside groups, 10px buttons and inputs, 16px cards, 20px large panels.
- Sizes: primary buttons and inputs at least 44px high. Page titles 28px/700, section titles 16px/600, body 14px, captions 12–13px.
- Layout: web has a 232px sidebar and content up to 1240px wide; mobile is designed at 390px with a bottom navigation.
- Icons: outline, 24px grid, stroke width 1.8, `currentColor`. Use one icon set across the app.
- Income amounts use `accent`, expenses use `ink`. Money is always formatted through `n()` with the account currency.
- Theme follows the system by default and can be switched in Settings (`.dark` class on `<html>`, shared by Tailwind and PrimeVue).
- Logo: the ミ mark (two graphite strokes, one rose stroke) next to the "Mita" wordmark. Keep it as an SVG component in `shared/components`.

## Code style

- All code, identifiers, commit messages and comments are in English.
- Do not write comments. Add one only for a genuinely non-obvious or controversial decision, and explain why, not what.
- Prefer clear naming over explanation.
- No unused code, no commented-out code, no `console.log` left behind.
- Code must pass Biome and `nuxt typecheck` before commit.

## Git workflow

- Branches: `prod` (production), `preprod`, `develop`. Work happens in `feature/*`, `bugfix/*`, `hotfix/*` branches.
- Flow: `feature/*` -> `develop` -> `preprod` -> `prod`. Hotfixes go to `prod` and are back-merged into `develop`.
- Everything reaches the long-lived branches through pull requests.
- Always rebase. Pull requests are merged with rebase merge only (no merge commits, no squash), so `prod`, `preprod` and `develop` keep a linear history.
- Keep a feature branch up to date by rebasing it onto its base (`git rebase origin/develop`), never by merging the base into it. Push a rebased feature branch with `git push --force-with-lease`. Never force-push `prod`, `preprod` or `develop`.
- Before opening a pull request, make every commit meaningful: no empty, "fix typo" or "wip" commits.
- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`.
- Never mention Claude, AI or any assistant in commit messages, PR titles or descriptions, code comments, or any other artifact. No `Co-Authored-By` trailers, no "Generated with" lines.

## Commands

```
docker compose up --build                     # dev: compose.override.yaml adds hot reload
docker compose -f compose.yaml up -d --build  # preprod / prod: built image, config from .env (proxy target: COMPOSE_API_PROXY_TARGET)
bun install
bun run dev
bun run build
bun run lint
bun run typecheck
bun run test
bun run test:e2e                              # on mocks: starts its own server on port 3100 with NUXT_PUBLIC_API_MOCKS=true
bun run test:e2e:real                         # against the real backend, see "Running the app"
bun run api:generate
```

## Configuration and secrets

- Runtime configuration through `runtimeConfig` and environment variables. Public values go under `runtimeConfig.public`.
- Never commit secrets or `.env` files. Provide a `.env.example` with placeholder values.
