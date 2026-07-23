// Standalone Node HTTP entry for the self-hosted Docker image.
//
// TanStack Start's Vite plugin (>=1.168, post-Vinxi/Nitro) only builds a
// Web-standard `{ fetch }` handler — `dist/server/server.js` — plus static
// client assets in `dist/client/`. There is no `.output/server/index.mjs`
// and nothing calls `.listen()` anywhere in the build output. This script is
// the missing piece: it serves `dist/client/`'s static files directly and
// bridges everything else through a plain node:http server into the built
// fetch handler, using Node 20's built-in Request/Response/Headers globals.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, "dist", "client");
const PORT = Number(process.env.PORT) || 3000;

const { default: handler } = await import("./dist/server/server.js");

const MIME_TYPES = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

// Resolves a request path against CLIENT_DIR without ever escaping it —
// blocks `..` path-traversal regardless of encoding tricks in req.url.
function resolveStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const resolved = path.normalize(path.join(CLIENT_DIR, decoded));
  if (resolved !== CLIENT_DIR && !resolved.startsWith(CLIENT_DIR + path.sep)) {
    return null;
  }
  return resolved;
}

async function tryServeStatic(res, filePath) {
  const info = await stat(filePath);
  if (!info.isFile()) return false;
  const ext = path.extname(filePath);
  const body = await readFile(filePath);
  res.writeHead(200, {
    "content-type": MIME_TYPES[ext] ?? "application/octet-stream",
    "content-length": body.length,
    // Vite fingerprints everything under /assets/ — safe to cache forever.
    "cache-control": filePath.includes(`${path.sep}assets${path.sep}`)
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600",
  });
  res.end(body);
  return true;
}

function nodeRequestToFetchRequest(req) {
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.append(key, value);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

function sendFetchResponse(res, response) {
  const headers = {};
  for (const [key, value] of response.headers) headers[key] = value;
  res.writeHead(response.status, headers);
  if (!response.body) {
    res.end();
    return;
  }
  Readable.fromWeb(response.body).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" || req.method === "HEAD") {
      const staticPath = resolveStaticPath(req.url);
      if (staticPath) {
        const served = await tryServeStatic(res, staticPath).catch(() => false);
        if (served) return;
      }
    }
    const request = nodeRequestToFetchRequest(req);
    const response = await handler.fetch(request, {}, {});
    sendFetchResponse(res, response);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    }
    res.end("Internal Server Error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[serve] listening on 0.0.0.0:${PORT}`);
});
