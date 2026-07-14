// Node HTTP entry — replaces src/server.ts inside the self-hosted Docker build.
// The Cloudflare Worker `export default { fetch }` shape is not what Node needs.
// TanStack Start's node-server preset expects the server entry to import and
// re-export the built-in server handler; the framework wires the HTTP listener.
import handler from "@tanstack/react-start/server-entry";
export default handler;
