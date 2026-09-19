import http from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.PORT || 8080);
const indexHtml = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const episodes = JSON.parse(readFileSync(new URL("./episodes-fallback.json", import.meta.url), "utf8"));

function send(res, status, body, type, cache = "no-store") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": cache
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

  return send(res, 200, indexHtml, "text/html; charset=utf-8", "no-cache");
});

server.listen(PORT);
