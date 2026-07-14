# Multi-stage build for the TanStack Start app.
# Build context is the repo root (see docker-compose.yml).
#
# The Lovable dev setup uses `@lovable.dev/vite-tanstack-config` which targets
# Cloudflare Workers. For self-hosting we override that config with the
# Node-target config in `frontend/vite.config.node.ts` and swap `src/server.ts`
# for a Node HTTP entry in `frontend/server-node.ts` at build time.

# ---- deps -------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare bun@1.1.30 --activate || true
RUN apk add --no-cache libc6-compat
COPY package.json bun.lockb* package-lock.json* ./
RUN if [ -f bun.lockb ]; then \
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
COPY --from=build --chown=app:app /app/.output ./.output
COPY --from=build --chown=app:app /app/package.json ./package.json
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/ >/dev/null 2>&1 || exit 1
CMD ["node", ".output/server/index.mjs"]
