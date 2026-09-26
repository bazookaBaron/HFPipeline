"use strict";
// Wikimedia Commons (MediaWiki Action API). No key; polite UA via http.js.
// Candidates carry the 1920 px thumb URL (iiurlwidth) so we never pull giant originals.

const { normalizeLicense } = require("../license");
const { cleanAuthor, htmlToText } = require("../credits");

const API = "https://commons.wikimedia.org/w/api.php";
const META = "LicenseShortName|LicenseUrl|Artist|Credit|AttributionRequired|UsageTerms|ImageDescription|ObjectName";

function qs(params) {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
}

function baseParams(width) {
  return {
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo|categories",
    cllimit: "max",
    iiprop: "size|mime|url|extmetadata",
    iiextmetadatafilter: META,
    iiurlwidth: String(width || 1920),
  };
}

/** Parse an Action API response (formatversion=2) into candidates, in search-rank order. */
function parsePages(json, via = "commons:search", query) {
  const pages = (json && json.query && json.query.pages) || [];
  const sorted = pages.slice().sort((a, b) => (a.index == null ? 0 : a.index) - (b.index == null ? 0 : b.index));
  const out = [];
  for (const p of sorted) {
    const ii = p.imageinfo && p.imageinfo[0];
    if (!ii) continue;
    const em = ii.extmetadata || {};
    const val = (k) => (em[k] && em[k].value != null ? String(em[k].value) : "");
    const mime = ii.mime || "";
    const isVideo = /^video\//.test(mime) || /\.(webm|ogv)$/i.test(p.title);
    const isSvg = mime === "image/svg+xml";
    const cats = (p.categories || []).map((c) => c.title);
    const licence = normalizeLicense(val("LicenseShortName"), { url: val("LicenseUrl"), categories: cats });
    // downloaded size: the thumb when the original is larger than the requested width, else the original
    const thumbW = ii.thumbwidth || ii.width;
    const thumbH = ii.thumbheight || ii.height;
    const scaled = !isVideo && ii.thumburl && (isSvg || ii.width > thumbW);
    let author = cleanAuthor(val("Artist"));
    if (!author) author = cleanAuthor(val("Credit"));
    out.push({
      source: "commons",
      via,
      query,
      id: p.title,
      title: p.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""),
      pageUrl: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
      fileUrl: isVideo ? ii.url : scaled ? ii.thumburl : ii.url,
      posterUrl: isVideo ? ii.thumburl : undefined,
      origWidth: ii.width,
      origHeight: ii.height,
      width: isSvg ? thumbW : scaled ? thumbW : ii.width,
      height: isSvg ? thumbH : scaled ? thumbH : ii.height,
      bytes: ii.size,
      mime: isSvg ? "image/png" : mime,
      vector: isSvg,
      mediaType: isVideo ? "video" : "image",
      author,
      licence,
      attributionRequired: val("AttributionRequired") !== "false",
      description: htmlToText(val("ImageDescription")).slice(0, 300),
    });
  }
  return out;
}

/** Full-text file search. filetype: "bitmap" | "bitmap|drawing" | "video" */
async function search(http, query, { limit = 12, filetype = "bitmap", width } = {}) {
  const params = {
    ...baseParams(width),
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: String(limit),
    gsrsearch: `${query} filetype:${filetype}`,
  };
  const json = await http.getJson(`${API}?${qs(params)}`);
  return parsePages(json, "commons:search", query);
}

/** Metadata for known file titles (e.g. Wikidata P18/P154 values). */
async function files(http, titles, { via = "wikidata", width } = {}) {
  if (!titles.length) return [];
  const params = { ...baseParams(width), titles: titles.map((t) => (/^File:/i.test(t) ? t : `File:${t}`)).join("|") };
  const json = await http.getJson(`${API}?${qs(params)}`);
  const byTitle = parsePages(json, via);
  // keep the caller's order (P18 before P154 etc.)
  const norm = (t) => t.replace(/^File:/i, "").replace(/_/g, " ").toLowerCase();
  return titles.map((t) => byTitle.find((c) => norm(c.id) === norm(t))).filter(Boolean);
}

/** Files in a Commons category (Wikidata P373). */
async function category(http, cat, { limit = 20, width, filetype = "bitmap" } = {}) {
  const name = cat.replace(/^Category:/i, "");
  const params = {
    ...baseParams(width),
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: String(limit),
    gsrsearch: `incategory:"${name.replace(/"/g, "")}" filetype:${filetype}`,
  };
  const json = await http.getJson(`${API}?${qs(params)}`);
  return parsePages(json, "commons:category", `incategory:${name}`);
}

module.exports = { search, files, category, parsePages, API };
