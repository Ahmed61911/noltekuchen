# frontend/

Self-hosting artifacts for the TanStack Start app.

The application source lives at the **repo root** (`src/`, `package.json`,
etc.) — this is intentional so Lovable's dev preview keeps working. Docker
builds use the repo root as build context and swap in the Node-target
config from this directory.

Files:
- `Dockerfile` — multi-stage build; final image runs `node .output/server/index.mjs`
- `vite.config.node.ts` — Node-server Vite config (replaces the Cloudflare-targeted one at build time)
- `server-node.ts` — Node HTTP entry (replaces `src/server.ts` at build time)

See `MIGRATION.md` in the repo root for the full workflow.
