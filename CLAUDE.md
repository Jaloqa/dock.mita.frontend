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

## Mocks

Until the backend is ready the app runs on mocks. `runtimeConfig.public.apiMocks` (`NUXT_PUBLIC_API_MOCKS`) switches the transport of the shared API client between `http` and `mock`. Full design: [docs/superpowers/specs/2026-10-15-frontend-mocks-design.md](docs/superpowers/specs/2026-10-15-frontend-mocks-design.md).

- Feature API modules (`features/<x>/api`) call `apiClient` only. They never know which transport is active.
- The mock transport routes requests to handlers in `mocks/handlers`, which work on a `localStorage` database. Business rules (balances, currency conversion, budget statuses, aggregates) live in those handlers, as they will in the backend.
- Mock handlers behave like the real API: `/v1` paths, `userId` from the session, paginated lists, latency, RFC 9457 ProblemDetails for validation errors.
- Hybrid mode: with `NUXT_PUBLIC_API_MOCKS=true`, `NUXT_PUBLIC_API_REAL_PATHS` (comma-separated, whole path segments, e.g. `/v1/auth,/v1/me,/v1/settings`) routes those paths to the real backend and the rest to mocks. An empty list is pure mock mode; `NUXT_PUBLIC_API_MOCKS=false` sends everything over HTTP.
- The HTTP transport is same-origin: a Nitro middleware (`server/middleware/apiProxy.ts`) forwards `/v1/**` to `NUXT_API_PROXY_TARGET` (`http://localhost:8080` locally, `http://host.docker.internal:8080` in Docker dev). The target is read at runtime from `runtimeConfig.apiProxyTarget`, so a built image honours the variable; when it is empty the middleware does nothing.
- `mocks/` is loaded only when the flag is on. Removing mocks later means deleting `mocks/` and the mock transport; nothing else changes.

## Running against the backend

Authentication, the profile, the settings and the exchange rates (`/v1/rates`) come from the real backend in hybrid mode; every other screen stays on mocks, which clone the demo data for a newly seen user. `/v1/accounts` and `/v1/transfers` are opt-in (append them to `NUXT_PUBLIC_API_REAL_PATHS`) because the mocked transactions and goals still reference mock account ids.

1. Start the backend from its repository (`dock.mita.backend`): `cp .env.example .env` once, then `docker compose up -d --build`. The API listens on `http://localhost:8080`; `GET /health/ready` answers 200 when it is up.
2. Start the frontend in hybrid mode: `docker compose up --build` with the values from `.env.example`, or locally `NUXT_PUBLIC_API_MOCKS=true NUXT_PUBLIC_API_REAL_PATHS=/v1/auth,/v1/me,/v1/settings,/v1/rates NUXT_API_PROXY_TARGET=http://localhost:8080 bun run dev`.
3. Run the end-to-end check against it: `bun run test:e2e:hybrid` (`E2E_BASE_URL` selects the dev server, `http://localhost:3000` by default). It registers a new user with a unique email, changes a setting, signs out and in, and deletes the account. The accounts spec needs `/v1/accounts,/v1/transfers` in `NUXT_PUBLIC_API_REAL_PATHS`; it creates accounts, transfers between them and archives one. The backend allows 10 register, login and delete calls per minute per IP, so wait a minute between repeated runs.
4. Stop the backend with `docker compose down` (add `-v` to drop its database).

The hybrid suite lives in `tests/e2e-hybrid` with its own `playwright.hybrid.config.ts`; it signs in for real and never uses the mock sign-in state of `bun run test:e2e`.

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
docker compose -f compose.yaml up -d --build  # preprod / prod: built image, config from .env
bun install
bun run dev
bun run build
bun run lint
bun run typecheck
bun run test
bun run test:e2e
bun run test:e2e:hybrid                       # against the real backend, see "Running against the backend"
bun run api:generate
```

## Configuration and secrets

- Runtime configuration through `runtimeConfig` and environment variables. Public values go under `runtimeConfig.public`.
- Never commit secrets or `.env` files. Provide a `.env.example` with placeholder values.
