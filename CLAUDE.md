# CLAUDE.md

Frontend of dock.mita. Guidance for working in this repository.

## Stack

- Nuxt 4 (Vue 3, Composition API, `<script setup lang="ts">`)
- TypeScript in strict mode
- Pinia for shared client state
- Tailwind CSS with Nuxt UI for components
- Typed API client generated from the backend OpenAPI document (`openapi-typescript` + `openapi-fetch`)
- Forms: Nuxt UI `UForm` with Zod schemas
- i18n: `@nuxtjs/i18n` (vue-i18n), locales `en` (default), `pl`, `ru`, `uk`
- Testing: Vitest and Vue Test Utils for units, Playwright for end-to-end
- ESLint (`@nuxt/eslint`) and Prettier
- pnpm as the package manager
- Docker for production builds

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
- Server data is fetched with `useAsyncData` / `useFetch` wrappers in feature composables. Pinia is for client state only, not a cache of server data.
- The API client types are generated, never hand-written. Regenerate after backend contract changes.
- Component props and emits are fully typed. No `any`; use `unknown` and narrow.
- Component files use PascalCase, composables use `useXxx`, one component per file.
- Prefer Tailwind utility classes. Avoid custom CSS unless a utility cannot express it.
- Accessibility is required: semantic elements, labels for inputs, keyboard navigation.

## Mocks

Until the backend is ready the app runs on mocks. `runtimeConfig.public.apiMocks` (`NUXT_PUBLIC_API_MOCKS`) switches every feature between the mock and the real API.

- Each feature's `api/` folder exports one interface with two implementations: `http` (generated client) and `mock`. Components and composables depend on the interface only.
- Mock data lives in the feature, typed with the same generated types the real API uses, and behaves like the API (latency, pagination, validation errors).
- Removing mocks later means deleting the `mock` implementation; nothing else changes.

## Internationalization

- No user-facing text is hard-coded. Every string goes through `t()` / `$t()`, including labels, placeholders, `aria-label`, page titles and validation messages.
- Locale files live in `i18n/locales/<locale>.json`, lazy-loaded. `en` is the source of truth and the fallback locale. Add a key to every locale in the same change.
- Keys are namespaced by feature and use camelCase: `orders.list.emptyState`, `shared.actions.save`. Generic strings go under `shared`.
- Use interpolation and pluralization instead of string concatenation.
- Zod error messages map to i18n keys, not literal text.
- Dates, numbers and currency are formatted with `useI18n` formatters (`d`, `n`), never manually.
- Routing strategy `prefix_except_default`: `en` has no prefix, other locales are prefixed (`/pl/...`, `/ru/...`, `/uk/...`). Build links with `useLocalePath`.
- Pluralization rules differ: `ru` and `uk` have three plural forms, `pl` has three, `en` has two. Always provide every form. Custom `pluralRules` for `ru`, `uk` and `pl` are registered in the i18n config, since vue-i18n defaults to English rules.
- The selected locale is persisted in a cookie and sent to the backend as `Accept-Language`.

## Design

Source of truth: Claude Design project "Mita — финансовый планер" (https://claude.ai/artifact/W7Jn2A5ccqeaw91PAtw5JH). Palette "Graphite and rose", light and dark themes.

Colors are defined once as semantic tokens (CSS variables in `app/assets/css/main.css`, mapped into the Tailwind theme and the Nuxt UI `primary` / `neutral` colors). Components use token names only, never raw hex values.

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

- Fonts: Manrope 400–700 for UI, JetBrains Mono 400–500 for every amount, percentage and numeric value. Self-host through `@nuxt/fonts`.
- Radius: 8px small controls inside groups, 10px buttons and inputs, 16px cards, 20px large panels.
- Sizes: primary buttons and inputs at least 44px high. Page titles 28px/700, section titles 16px/600, body 14px, captions 12–13px.
- Layout: web has a 232px sidebar and content up to 1240px wide; mobile is designed at 390px with a bottom navigation.
- Icons: outline, 24px grid, stroke width 1.8, `currentColor`. Use one icon set (Lucide via Nuxt UI).
- Income amounts use `accent`, expenses use `ink`. Money is always formatted through `n()` with the account currency.
- Theme follows the system by default and can be switched in Settings (`@nuxtjs/color-mode`).
- Logo: the ミ mark (two graphite strokes, one rose stroke) next to the "Mita" wordmark. Keep it as an SVG component in `shared/components`.

## Code style

- All code, identifiers, commit messages and comments are in English.
- Do not write comments. Add one only for a genuinely non-obvious or controversial decision, and explain why, not what.
- Prefer clear naming over explanation.
- No unused code, no commented-out code, no `console.log` left behind.
- Code must pass ESLint, `nuxt typecheck` and Prettier before commit.

## Git workflow

- Branches: `prod` (production), `preprod`, `develop`. Work happens in `feature/*`, `bugfix/*`, `hotfix/*` branches.
- Flow: `feature/*` -> `develop` -> `preprod` -> `prod`. Hotfixes go to `prod` and are back-merged into `develop`.
- Everything reaches the long-lived branches through pull requests.
- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`.
- Never mention Claude, AI or any assistant in commit messages, PR titles or descriptions, code comments, or any other artifact. No `Co-Authored-By` trailers, no "Generated with" lines.

## Commands

```
docker compose up --build                     # dev: compose.override.yaml adds hot reload
docker compose -f compose.yaml up -d --build  # preprod / prod: built image, config from .env
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm api:generate
```

## Configuration and secrets

- Runtime configuration through `runtimeConfig` and environment variables. Public values go under `runtimeConfig.public`.
- Never commit secrets or `.env` files. Provide a `.env.example` with placeholder values.
