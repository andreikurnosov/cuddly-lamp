const SOURCES = [
  "https://radio-t.com/site-api/last/70?categories=podcast",
  "https://radio-t.com/podcast.rss",
  "https://feeds.rucast.net/radio-t"
];

function decodeXml(s = "") {
  return s
    .replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tag(block, name) {
  const m = block.match(new RegExp("<" + name + "(?:\\\\s[^>]*)?>([\\\\s\\\\S]*?)<\\\\/" + name + ">", "i"));
  return m ? decodeXml(m[1].trim()) : "";
}

function attr(block, tagName, attrName) {
  const m = block.match(new RegExp("<" + tagName + "\\\\b[^>]*\\\\b" + attrName + "=[\\\"']([^\\\"']+)[\\\"'][^>]*>", "i"));
  return m ? decodeXml(m[1]) : "";
}

function rssToEntries(xml, limit) {
  const items = [...xml.matchAll(/<item\\b[^>]*>([\\s\\S]*?)<\\/item>/gi)].map(m => m[1]);
  return items.slice(0, limit).map(block => ({
    title: tag(block, "title"),
    date: tag(block, "pubDate"),
    url: tag(block, "link"),
    body: tag(block, "description") || tag(block, "content:encoded"),
    show_notes: tag(block, "itunes:summary"),
    audio_url: attr(block, "enclosure", "url")
  })).filter(e => e.title && e.audio_url);
}

async function fetchText(url) {
  const r = await fetch(url, {
    headers: {
      "accept": "application/json, application/rss+xml, application/xml, text/xml, */*",
      "user-agent": "RadioT-Web/2.0"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10000)
  });
  return { status: r.status, type: r.headers.get("content-type") || "", body: await r.text() };
}

export default async function handler(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit || 70), 1), 100);
  const errors = [];

  try {
    const r = await fetchText("https://radio-t.com/site-api/last/" + limit + "?categories=podcast");
    if (r.status >= 200 && r.status < 300) {
      const data = JSON.parse(r.body);
      if (Array.isArray(data) && data.length) {
        res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
        return res.status(200).json({ source: "site-api", items: data });
      }
      errors.push("site-api empty");
    } else errors.push("site-api HTTP " + r.status);
  } catch (e) {
    errors.push("site-api: " + e.message);
  }

  for (const source of SOURCES.slice(1)) {
    try {
      const r = await fetchText(source);
      if (r.status >= 200 && r.status < 300) {
        const items = rssToEntries(r.body, limit);
        if (items.length) {
          res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
          return res.status(200).json({ source, items });
        }
        errors.push(source + " empty");
      } else errors.push(source + " HTTP " + r.status);
    } catch (e) {
      errors.push(source + ": " + e.message);
    }
  }

  return res.status(502).json({ error: "upstream unavailable", detail: errors.join("; ") });
}
