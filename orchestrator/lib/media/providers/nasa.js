"use strict";
// NASA Image and Video Library (images-api.nasa.gov). No key. NASA media is generally
// not copyrighted; items credited to third parties or marked copyrighted are rejected.

const API = "https://images-api.nasa.gov/search";

const THIRD_PARTY = /©|copyright|courtesy of (?!nasa)|getty|reuters|associated press|\bAP photo/i;

function pickLink(links) {
  const imgs = (links || []).filter((l) => l.render === "image" && l.href);
  if (!imgs.length) return null;
  const size = (l) => l.width || 0;
  // prefer the largest rendition up to 2400 px wide, otherwise the smallest above it
  const under = imgs.filter((l) => size(l) && size(l) <= 2400).sort((a, b) => size(b) - size(a));
  if (under.length) return under[0];
  const over = imgs.filter((l) => size(l)).sort((a, b) => size(a) - size(b));
  return over[0] || imgs[0];
}

function parseResults(json, query) {
  const out = [];
  for (const it of (json && json.collection && json.collection.items) || []) {
    const d = (it.data || [])[0];
    if (!d || d.media_type !== "image") continue;
    const link = pickLink(it.links);
    if (!link) continue;
    const author = d.photographer || d.secondary_creator || "";
    const thirdParty = THIRD_PARTY.test(`${d.description || ""} ${author}`) || (author && !/nasa/i.test(author) && !d.center);
    out.push({
      source: "nasa",
      via: "nasa:search",
      query,
      id: d.nasa_id,
      title: d.title || d.nasa_id,
      pageUrl: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
      fileUrl: link.href,
      origWidth: link.width || 0,
      origHeight: link.height || 0,
      width: link.width || 0,
      height: link.height || 0,
      mime: "image/jpeg",
      mediaType: "image",
      author,
      licence: thirdParty
        ? { id: "unknown", label: "third-party", allowed: false, reason: "NASA item credited to a third party", sa: false, attribution: false, url: "" }
        : { id: "pd", label: "Public domain", allowed: true, sa: false, attribution: false, url: "https://www.nasa.gov/nasa-brand-center/images-and-media/" },
      description: String(d.description || "").slice(0, 300),
    });
  }
  return out;
}

async function search(http, query, { limit = 12 } = {}) {
  const json = await http.getJson(`${API}?q=${encodeURIComponent(query)}&media_type=image&page_size=${limit}`);
  return parseResults(json, query);
}

module.exports = { search, parseResults, pickLink, API };
