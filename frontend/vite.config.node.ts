// Node-target Vite config used ONLY inside the self-hosted Docker build.
// Copied over the repo-root `vite.config.ts` by frontend/Dockerfile.
//
// Differences vs the Lovable dev config:
//  - No `@cloudflare/vite-plugin` (we run on Node, not Workers)
//  - No `@lovable.dev/vite-tanstack-config` wrapper (would re-inject Cloudflare)
//  - TanStack Start configured with the default Node server preset
import { defineConfig } from "vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    tanstackStart({
      target: "node-server",
      server: { entry: "./src/server.ts" },
    }),
    react(),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
  server: { host: "0.0.0.0", port: 3000 },
});
