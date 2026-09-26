"use strict";
// Local media library: reuse an already-resolved, already-vetted cached file for an intent whose
// text (and kind family) matches a cache sidecar exactly. No network, no Gemini: this is how a
// long-form re-run, or a second video on the same topic, gets its media for free, and how the
// offline pipeline proof runs (make-longform.js media stage, before resolveMedia()).
//
// A sidecar carries the intent it was vetted for (`intent`), the licence/credit strings and the
// focal box (lib/media/resolve.js finalize()). Only entries that passed the resolver (credit +
// licence present) and whose file still exists are offered; size rules follow quality.slotSize.

const fs = require("fs");
const path = require("path");
const { DEFAULT_CACHE_DIR, relFile } = require("./cache");

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const IMAGE_KINDS = new Set(["photo", "portrait", "logo", "map"]);
const MIN_LONG_EDGE = { full: 1280, card: 800 };

/** index every usable sidecar in the cache: normalized intent -> [record] (newest first) */
function indexLibrary(cacheDir = DEFAULT_CACHE_DIR) {
  const idx = new Map();
  if (!fs.existsSync(cacheDir)) return idx;
  for (const d of fs.readdirSync(cacheDir)) {
    const dir = path.join(cacheDir, d);
    if (d.startsWith("_") || !fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      let rec;
      try {
        rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
      } catch (_) {
        continue;
      }
      if (!rec || !rec.intent || !rec.credit || !rec.licence || !rec.sha256) continue;
      const media = fs.readdirSync(dir).find((x) => x.startsWith(rec.sha256) && !x.endsWith(".json"));
      if (!media) continue;
      rec._abs = path.join(dir, media);
      const k = norm(rec.intent);
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(rec);
    }
  }
  for (const list of idx.values()) list.sort((a, b) => String(b.fetchedAt).localeCompare(String(a.fetchedAt)));
  return idx;
}

function kindFits(intentKind, rec) {
  if (intentKind === "illustration") return rec.source === "illustration";
  if (intentKind === "video") return rec.kind === "video";
  // real-world kinds never take an AI illustration from the library
  return IMAGE_KINDS.has(intentKind) && rec.kind === "image" && rec.source !== "illustration";
}

function sizeFits(intent, rec) {
  const size = intent.size || (intent.kind === "photo" || intent.kind === "illustration" || intent.kind === "video" ? "full" : "card");
  const need = MIN_LONG_EDGE[size] || 0;
  return Math.max(Number(rec.width) || 0, Number(rec.height) || 0) >= need || rec.source === "illustration";
}

/** manifest entry (lib/media/resolve.js finalize() shape) from a sidecar */
function entryFromSidecar(rec) {
  return {
    status: rec.source === "illustration" ? "illustration" : "ok",
    kind: rec.kind || "image",
    source: rec.source,
    sha: rec.sha256,
    file: relFile(rec._abs),
    credit: rec.credit,
    creditFull: rec.creditFull || rec.credit,
    licence: rec.licence,
    licenceUrl: rec.licenceUrl || null,
    focal: rec.focal || [0, 0, 1, 1],
    width: rec.width,
    height: rec.height,
    pageUrl: rec.pageUrl || null,
    depicts: (rec.vision && rec.vision.depicts) || undefined,
    library: true,
  };
}

/**
 * Split intents into library hits and the rest.
 * @returns {{hits: {[slot]: entry}, rest: object[]}}
 */
function matchLibrary(intents, opts = {}) {
  const idx = opts.index || indexLibrary(opts.cacheDir);
  const hits = {};
  const rest = [];
  const usedSha = new Set(opts.excludeSha || []);
  for (const it of intents) {
    const cands = (idx.get(norm(it.intent)) || []).filter((r) => kindFits(it.kind, r) && sizeFits(it, r) && !usedSha.has(r.sha256));
    if (cands.length) {
      hits[it.slot] = entryFromSidecar(cands[0]);
      usedSha.add(cands[0].sha256);
    } else rest.push(it);
  }
  return { hits, rest };
}

module.exports = { indexLibrary, matchLibrary, entryFromSidecar, norm };
