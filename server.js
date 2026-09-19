import http from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.PORT || 8080);
const indexHtml = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const episodes = JSON.parse(readFileSync(new URL("./episodes-fallback.json", import.meta.url), "utf8"));
const serviceWorker = readFileSync(new URL("./sw.js", import.meta.url), "utf8");
const manifest = readFileSync(new URL("./manifest.webmanifest", import.meta.url), "utf8");
const icon = readFileSync(new URL("./icon.svg", import.meta.url), "utf8");

function send(res, status, body, type, cache = "no-store", extra = {}) {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": cache,
    ...extra
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/health") {
    return send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
  }

  if (url.pathname === "/api/episodes") {
    return send(
      res,
      200,
      JSON.stringify({ source: "bundled", items: episodes }),
      "application/json; charset=utf-8",
      "public, max-age=60"
    );
  }

  if (url.pathname === "/episodes-fallback.json") {
    return send(
      res,
      200,
      JSON.stringify(episodes),
      "application/json; charset=utf-8",
      "public, max-age=300"
    );
  }

  if (url.pathname === "/sw.js") {
    return send(
      res,
      200,
      serviceWorker,
      "application/javascript; charset=utf-8",
      "no-cache",
      { "Service-Worker-Allowed": "/" }
    );
  }

  if (url.pathname === "/manifest.webmanifest") {
    return send(res, 200, manifest, "application/manifest+json; charset=utf-8", "public, max-age=3600");
  }

  if (url.pathname === "/icon.svg") {
    return send(res, 200, icon, "image/svg+xml; charset=utf-8", "public, max-age=86400");
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    return send(res, 200, indexHtml, "text/html; charset=utf-8", "no-cache");
  }

  return send(res, 404, "Not found", "text/plain; charset=utf-8");
});

server.listen(PORT);
