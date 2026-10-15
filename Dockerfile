FROM oven/bun:1.4-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --ignore-scripts

FROM deps AS dev
COPY . .
RUN bun --bun run postinstall
EXPOSE 3000
CMD ["sh", "-c", "bun install --frozen-lockfile && bun --bun run dev --host 0.0.0.0"]

FROM deps AS build
COPY . .
RUN bun --bun run build

FROM oven/bun:1.4-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=bun:bun /app/.output ./.output
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["bun", ".output/server/index.mjs"]
