# CLAUDE.md

Frontend of dock.mita. Guidance for working in this repository.

## Stack

- Nuxt 4 (Vue 3, Composition API, `<script setup lang="ts">`)
- TypeScript in strict mode
- Pinia for shared client state
- Tailwind CSS with Nuxt UI for components
- Typed API client generated from the backend OpenAPI document (`openapi-typescript` + `openapi-fetch`)
- Forms: VeeValidate with Zod schemas
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
