"use strict";
// Openverse (CC index). Verified 2026-09-26: base https://api.openverse.org/v1/ ;
// anonymous limits (response headers) 20 req/min burst, 200 req/day sustained.
// We ask only for licences allowing commercial use + modification, and re-check each
// result with our own licence gate.

const { normalizeLicense } = require("../license");
const { cleanAuthor } = require("../credits");

const API = "https://api.openverse.org/v1/images/";

function parseResults(json, query) {
  const out = [];
  for (const r of (json && json.results) || []) {
    if (r.mature) continue;
    const licence = normalizeLicense(r.license, { version: r.license_version, url: r.license_url });
    out.push({
      source: "openverse",
      via: "openverse:search",
      query,
      id: r.id,
      provider: r.source || r.provider,
      title: r.title || "",
      pageUrl: r.foreign_landing_url || "",
      fileUrl: r.url,
      origWidth: r.width || 0,
      origHeight: r.height || 0,
      width: r.width || 0,
      height: r.height || 0,
      mime: r.filetype ? `image/${r.filetype === "jpg" ? "jpeg" : r.filetype}` : "",
      mediaType: "image",
      author: cleanAuthor(r.creator || ""),
      licence,
      attribution: r.attribution || "",
      description: (r.tags || []).map((t) => t.name).slice(0, 12).join(", "),
    });
  }
  return out;
}

async function search(http, query, { limit = 12 } = {}) {
  const url = `${API}?q=${encodeURIComponent(query)}&license_type=commercial,modification&page_size=${limit}&mature=false`;
  const json = await http.getJson(url);
  // Openverse also indexes Commons; those are better fetched from Commons itself (the resolver dedupes by URL)
  return parseResults(json, query);
}

module.exports = { search, parseResults, API };
