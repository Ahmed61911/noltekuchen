# Multi-stage build for the TanStack Start app.
# Build context is the repo root (see docker-compose.yml).
#
# The Lovable dev setup uses `@lovable.dev/vite-tanstack-config` which targets
# Cloudflare Workers. For self-hosting we override that config with the
# Node-target config in `frontend/vite.config.node.ts` and swap `src/server.ts`
# for a Node-compatible SSR entry in `frontend/server-node.ts` at build time.
#
# TanStack Start's Vite plugin (>=1.168) dropped its old Vinxi/Nitro-based
# Node presets — `vite build` only emits a Web-standard `{ fetch }` handler
# (dist/server/server.js) plus static assets (dist/client/), nothing that
# calls `.listen()`. frontend/serve.mjs is a small hand-rolled Node HTTP
# server that serves dist/client/ directly and bridges everything else into
# that fetch handler.

# ---- deps -------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
# The repo pins deps with Bun's text lockfile (bun.lock), not the legacy
# binary bun.lockb — check for both so this doesn't silently fall through
# to `npm ci`, which fails outright since no package-lock.json is committed.
COPY package.json bun.lock* bun.lockb* package-lock.json* ./
RUN if [ -f bun.lock ] || [ -f bun.lockb ]; then \
      npm i -g bun && bun install --frozen-lockfile; \
    else \
      npm ci; \
    fi

# ---- build ------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Swap in Node-target Vite config + server entry
COPY frontend/vite.config.node.ts ./vite.config.ts
COPY frontend/server-node.ts ./src/server.ts
# Vite needs VITE_* vars at build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
RUN npm run build

# ---- runtime ----------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/dist ./dist
# Needed so Node's ESM loader treats dist/server/*.js as ES modules (no
# closer package.json exists under dist/ to declare that itself).
COPY --from=build --chown=app:app /app/package.json ./package.json
# vite's SSR build externalizes npm deps (e.g. h3-v2) instead of bundling
# them — there's no Nitro step here to inline everything into one file — so
# node_modules has to be present at runtime for dist/server/server.js's
# imports to resolve.
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --chown=app:app frontend/serve.mjs ./serve.mjs
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1
CMD ["node", "serve.mjs"]
