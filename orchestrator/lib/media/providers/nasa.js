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

// ---- videos: search media_type=video; the asset manifest (collection.json) lists the mp4 renditions
function nasaLicence(d, author) {
  const thirdParty = THIRD_PARTY.test(`${d.description || ""} ${author}`) || (author && !/nasa/i.test(author) && !d.center);
  return thirdParty
    ? { id: "unknown", label: "third-party", allowed: false, reason: "NASA item credited to a third party", sa: false, attribution: false, url: "" }
    : { id: "pd", label: "Public domain", allowed: true, sa: false, attribution: false, url: "https://www.nasa.gov/nasa-brand-center/images-and-media/" };
}

function parseVideoResults(json, query) {
  const out = [];
  for (const it of (json && json.collection && json.collection.items) || []) {
    const d = (it.data || [])[0];
    if (!d || d.media_type !== "video" || !it.href) continue;
    const poster = pickLink(it.links);
    const author = d.photographer || d.secondary_creator || "";
    out.push({
      source: "nasa",
      via: "nasa:video",
      query,
      id: d.nasa_id,
      title: d.title || d.nasa_id,
      pageUrl: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
      // resolved to an mp4 rendition by renditions() before processing; the manifest URL is the dedupe key until then
      fileUrl: it.href,
      assetUrl: it.href,
      posterUrl: poster ? poster.href : undefined,
      origWidth: 0,
      origHeight: 0,
      width: 0,
      height: 0,
      mime: "video/mp4",
      mediaType: "video",
      author,
      licence: nasaLicence(d, author),
      description: String(d.description || "").slice(0, 300),
      hasCaptions: (it.links || []).some((l) => l.rel === "captions"),
    });
  }
  return out;
}

async function searchVideo(http, query, { limit = 10 } = {}) {
  const json = await http.getJson(`${API}?q=${encodeURIComponent(query)}&media_type=video&page_size=${limit}`);
  return parseVideoResults(json, query);
}

/** mp4 renditions from an asset manifest (array of URLs), best first: ~large (1080p), ~medium (720p), ~orig */
function pickVideoRendition(list) {
  const arr = Array.isArray(list) ? list : list && list.collection ? (list.collection.items || []).map((i) => i.href) : [];
  const urls = arr.map((u) => String(u).replace(/^http:\/\//, "https://")).filter((u) => /\.mp4$/i.test(u));
  for (const k of ["~large.mp4", "~medium.mp4", "~orig.mp4"]) {
    const u = urls.find((x) => x.endsWith(k));
    if (u) return { url: encodeURI(decodeURI(u)), label: k.slice(1, -4) };
  }
  return null;
}

async function renditions(http, cand) {
  const list = await http.getJson(String(cand.assetUrl).replace(/ /g, "%20"));
  return pickVideoRendition(list);
}

async function search(http, query, { limit = 12 } = {}) {
  const json = await http.getJson(`${API}?q=${encodeURIComponent(query)}&media_type=image&page_size=${limit}`);
  return parseResults(json, query);
}

module.exports = { search, parseResults, pickLink, API, searchVideo, parseVideoResults, pickVideoRendition, renditions };
