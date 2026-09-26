"use strict";
// resolveMedia(intents, opts) -> manifest
// Fallback chain per slot (plan §5): Wikidata entity + Commons (category, search) -> Openverse
// -> NASA (when relevant) -> AI illustration (kind "illustration", or intent.allowIllustration)
// -> {status: "fallback"} (the module renders its no-image state).
// Every network call happens here; renders read only the cached files named in the manifest.

const fs = require("fs");
const path = require("path");
const { createHttp } = require("./http");
const { store, ensureCacheDir, DEFAULT_CACHE_DIR } = require("./cache");
const { planQueries, fallbackPlan } = require("./queries");
const { vet, verdictProblems } = require("./vision");
const { qualityProblems, slotSize } = require("./quality");
const { shortCredit, fullCredit } = require("./credits");
const { sniffImage, dhash, thumbJpeg, isDuplicate } = require("./image");

const KINDS = new Set(["photo", "portrait", "logo", "video", "map", "illustration"]);
const VET_PER_STAGE = { commons: 6, openverse: 4, nasa: 3 };
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

const defaultProviders = () => ({
  commons: require("./providers/commons"),
  wikidata: require("./providers/wikidata"),
  openverse: require("./providers/openverse"),
  nasa: require("./providers/nasa"),
  illustrate: require("./providers/illustrate"),
});

function validateIntents(intents) {
  if (!Array.isArray(intents)) throw new Error("intents must be an array");
  const seen = new Set();
  return intents.map((it, i) => {
    if (!it || typeof it !== "object") throw new Error(`intent ${i}: not an object`);
    if (!it.slot) throw new Error(`intent ${i}: missing slot`);
    if (seen.has(it.slot)) throw new Error(`intent ${i}: duplicate slot "${it.slot}"`);
    seen.add(it.slot);
    if (!KINDS.has(it.kind)) throw new Error(`intent ${it.slot}: kind must be one of ${[...KINDS].join("|")}`);
    if (!it.intent || typeof it.intent !== "string") throw new Error(`intent ${it.slot}: missing intent text`);
    return { ...it };
  });
}

// interleave lists (q1#1, q2#1, q1#2, …) so one bad query cannot fill the vetting budget
function interleave(lists) {
  const out = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

// Commons serves standard thumbnail buckets; the 960 px one is plenty for vetting and hashing
function vetUrl(c) {
  if (c.mediaType === "video") return c.posterUrl;
  if (c.source === "commons" && /\/1920px-/.test(c.fileUrl)) return c.fileUrl.replace("/1920px-", "/960px-");
  return c.fileUrl;
}

function licencePref(l) {
  return l.id === "pd" || l.id === "cc0" ? 0.06 : l.id === "cc-by" ? 0.04 : 0;
}

/**
 * @param {object[]} intents [{slot, kind, entity?, intent, mood?, era?, minWidth?, size?, allowIllustration?}]
 * @param {{cacheDir?: string, gemini?: object|null, log?: Function, concurrency?: number, http?: object,
 *          providers?: object, outDir?: string, vision?: boolean, fetch?: Function, offline?: boolean}} opts
 */
async function resolveMedia(intents, opts = {}) {
  const t0 = Date.now();
  const list = validateIntents(intents);
  const cacheDir = opts.cacheDir || DEFAULT_CACHE_DIR;
  ensureCacheDir(cacheDir);
  const log = opts.log || (() => {});
  const http = opts.http || createHttp({ cacheDir, log, fetch: opts.fetch, offline: opts.offline });
  const providers = { ...defaultProviders(), ...(opts.providers || {}) };
  const gemini = opts.gemini || null;
  const useVision = opts.vision !== false && !!gemini;
  const ctx = { cacheDir, log, http, providers, gemini, useVision };

  // phase 1: slots in parallel, each returns its ranked passing candidates
  const results = new Array(list.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(opts.concurrency || 3, list.length)) }, async () => {
    while (next < list.length) {
      const i = next++;
      results[i] = await resolveSlot(list[i], ctx, { exclude: [] });
    }
  });
  await Promise.all(workers);

  // phase 2: assign in slot order, rejecting near-duplicates (dHash) within this manifest
  const used = [];
  const manifest = {};
  const report = { startedAt: new Date(t0).toISOString(), slots: {} };
  for (let i = 0; i < list.length; i++) {
    const intent = list[i];
    let r = results[i];
    let pick = r.ranked.find((x) => !isDuplicate(x.hash, used));
    if (!pick && r.ranked.length) {
      log(`[${intent.slot}] all picks duplicate earlier slots; re-resolving`);
      r = await resolveSlot(intent, ctx, { exclude: used.slice(), skipUrls: new Set(r.ranked.map((x) => x.cand.fileUrl)), trace: r.trace });
      pick = r.ranked.find((x) => !isDuplicate(x.hash, used));
    }
    if (!pick) {
      manifest[intent.slot] = { status: "fallback", kind: intent.kind, reason: r.reason || "no acceptable media" };
      report.slots[intent.slot] = { intent, status: "fallback", ms: r.ms, plan: r.plan, trace: r.trace };
      continue;
    }
    used.push(pick.hash);
    const entry = await finalize(pick, intent, ctx);
    manifest[intent.slot] = entry;
    report.slots[intent.slot] = { intent, status: entry.status, stage: pick.stage, ms: r.ms, plan: r.plan, pick: { id: pick.cand.id, depicts: pick.verdict.depicts, confidence: pick.verdict.confidence }, trace: r.trace };
  }
  report.ms = Date.now() - t0;
  report.http = http.stats;
  report.counts = countStatuses(manifest);

  if (opts.outDir) writeOutputs(opts.outDir, manifest, report);
  return { manifest, report };
}

function countStatuses(manifest) {
  const c = { ok: 0, illustration: 0, fallback: 0 };
  for (const e of Object.values(manifest)) c[e.status] = (c[e.status] || 0) + 1;
  return c;
}

async function resolveSlot(intent, ctx, { exclude = [], skipUrls = new Set(), trace = [] } = {}) {
  const t = Date.now();
  const { log } = ctx;
  let plan;
  try {
    // an illustration needs no search queries: skip the model call
    plan = intent.kind === "illustration" ? fallbackPlan(intent) : await planQueries(intent, { gemini: ctx.gemini, cacheDir: ctx.cacheDir, log });
  } catch (err) {
    trace.push({ stage: "queries", error: err.message });
    plan = { queries: [intent.entity || intent.intent], rubric: intent.intent, nasaRelevant: false, wikidataSearch: intent.entity || null };
  }
  log(`[${intent.slot}] ${intent.kind}: ${plan.queries.join(" | ")}`);

  const stages = [];
  if (intent.kind !== "illustration") {
    stages.push(["commons", () => gatherCommons(intent, plan, ctx, trace)]);
    stages.push(["openverse", () => gatherSearch("openverse", intent, plan.queries.slice(0, 2), ctx, trace)]);
    if (plan.nasaRelevant || intent.nasa === true) stages.push(["nasa", () => gatherSearch("nasa", intent, plan.queries.slice(0, 2), ctx, trace)]);
  }
  for (const [stage, gather] of stages) {
    let cands;
    try {
      cands = await gather();
    } catch (err) {
      trace.push({ stage, error: err.message });
      log(`[${intent.slot}] ${stage} failed: ${err.message}`);
      continue;
    }
    const ranked = await screenAndVet(stage, cands, intent, plan, ctx, { exclude, skipUrls, trace });
    if (ranked.length) return { ranked, plan, trace, ms: Date.now() - t };
  }
  // a full-bleed photo slot with nothing at full size: accept a card-sized picture (portrait-orientation
  // buildings, 1024 px Flickr files) and say so in the manifest, so the template can use a split/card layout.
  // API responses and verdicts are cached, so this pass mostly costs vetting downloads.
  if (intent.kind !== "illustration" && !intent.size && slotSize(intent).name === "full" && intent.allowCard !== false) {
    const cardIntent = { ...intent, size: "card" };
    for (const [stage, gather] of stages) {
      let cands;
      try {
        cands = await gather();
      } catch (err) {
        continue;
      }
      const ranked = await screenAndVet(`${stage}`, cands, cardIntent, plan, ctx, { exclude, skipUrls, trace, label: `${stage}:card` });
      if (ranked.length) return { ranked: ranked.map((r) => ({ ...r, size: "card" })), plan, trace, ms: Date.now() - t };
    }
  }
  if (intent.kind === "illustration" || intent.allowIllustration) {
    try {
      const r = await illustrationCandidate(intent, plan, ctx, trace);
      if (r) return { ranked: [r], plan, trace, ms: Date.now() - t };
    } catch (err) {
      trace.push({ stage: "illustration", error: err.message });
      log(`[${intent.slot}] illustration failed: ${err.message}`);
    }
  }
  return { ranked: [], plan, trace, ms: Date.now() - t, reason: summariseTrace(trace) };
}

function summariseTrace(trace) {
  const bits = trace.map((s) => (s.error ? `${s.stage}: error (${String(s.error).slice(0, 80)})` : s.stage === "illustration" ? `illustration: ${s.attempts || 0} attempt(s) rejected` : `${s.stage}: ${s.found || 0} found, ${s.eligible || 0} eligible, ${s.vetted || 0} vetted, 0 passed`));
  return bits.join("; ") || "no candidates";
}

async function gatherCommons(intent, plan, ctx, trace) {
  const { http, providers } = ctx;
  const lists = [];
  const isVideo = intent.kind === "video";
  const filetype = intent.kind === "logo" || intent.kind === "map" ? "bitmap|drawing" : "bitmap";
  // 1) Wikidata entity: claim images first, then its Commons category
  let entity = null;
  if (plan.wikidataSearch) {
    try {
      entity = await providers.wikidata.lookup(http, plan.wikidataSearch, { classHint: plan.entityClass, intent: intent.intent });
    } catch (err) {
      trace.push({ stage: "wikidata", error: err.message });
    }
    if (entity) {
      const want = providers.wikidata.filesForKind(entity, intent.kind, intent.intent);
      if (want.length) {
        const got = await providers.commons.files(http, want.map((w) => w.file), { via: "wikidata" });
        const norm = (t) => String(t).replace(/^File:/i, "").replace(/_/g, " ").toLowerCase();
        got.forEach((c) => {
          const w = want.find((x) => norm(x.file) === norm(c.id));
          c.via = `wikidata:${w ? w.prop : ""}`;
        });
        lists.push(got);
      }
      if (entity.commonsCategory && intent.kind !== "logo" && intent.kind !== "map") {
        try {
          lists.push(await providers.commons.category(http, entity.commonsCategory, { limit: 15, filetype: isVideo ? "video" : filetype }));
        } catch (err) {
          trace.push({ stage: "commons:category", error: err.message });
        }
      }
    }
  }
  // 2) full-text search per query
  const searches = [];
  for (const q of plan.queries) {
    try {
      searches.push(await providers.commons.search(http, q, { limit: 12, filetype: isVideo ? "video" : filetype }));
    } catch (err) {
      trace.push({ stage: "commons:search", query: q, error: err.message });
    }
  }
  if (isVideo) {
    // real finance footage is rare: fall back to stills of the same subject
    for (const q of plan.queries.slice(0, 2)) {
      try {
        searches.push(await providers.commons.search(http, q, { limit: 12, filetype: "bitmap" }));
      } catch (err) {
        trace.push({ stage: "commons:search", query: q, error: err.message });
      }
    }
  }
  const out = [...lists.flat(), ...interleave(searches)];
  if (entity) out.entity = { id: entity.id, label: entity.label, description: entity.description };
  return out;
}

async function gatherSearch(name, intent, queries, ctx, trace) {
  const lists = [];
  for (const q of queries) {
    try {
      lists.push(await ctx.providers[name].search(ctx.http, q, { limit: 12 }));
    } catch (err) {
      trace.push({ stage: `${name}:search`, query: q, error: err.message });
    }
  }
  return interleave(lists);
}

function metadataProblems(c, intent) {
  const p = [];
  if (!c.licence || !c.licence.allowed) p.push(`licence: ${(c.licence && (c.licence.reason || c.licence.label)) || "unknown"}`);
  if (c.licence && c.licence.attribution && !c.author) p.push("no author for attribution");
  if (c.mediaType === "video") {
    if ((c.origWidth || 0) < 1280) p.push(`video width ${c.origWidth} < 1280`);
    if (c.bytes && c.bytes > MAX_VIDEO_BYTES) p.push("video too large");
    if (!c.posterUrl) p.push("no poster");
  } else p.push(...qualityProblems(c, intent));
  return p;
}

async function screenAndVet(stage, cands, intent, plan, ctx, { exclude, skipUrls, trace, label }) {
  const { http, log } = ctx;
  const seen = new Set();
  const rejects = [];
  const eligible = [];
  for (const c of cands) {
    if (!c || !c.fileUrl || seen.has(c.fileUrl) || skipUrls.has(c.fileUrl)) continue;
    seen.add(c.fileUrl);
    const p = metadataProblems(c, intent);
    if (p.length) rejects.push({ id: c.id, why: p });
    else eligible.push(c);
  }
  const entry = { stage: label || stage, found: seen.size, eligible: eligible.length, vetted: 0, passed: 0, rejects: rejects.slice(0, 8) };
  if (cands.entity) entry.entity = cands.entity;
  trace.push(entry);
  if (!eligible.length) return [];

  // download (vet-sized), hash, drop duplicates of each other / of earlier slots
  const budget = VET_PER_STAGE[stage] || 4;
  const items = [];
  for (const c of eligible) {
    if (items.length >= budget) break;
    let buf;
    try {
      buf = await http.getBuffer(vetUrl(c));
    } catch (err) {
      entry.rejects.push({ id: c.id, why: [`download: ${err.message}`] });
      continue;
    }
    const info = sniffImage(buf);
    if (!info) {
      entry.rejects.push({ id: c.id, why: ["not a decodable image"] });
      continue;
    }
    let hash;
    try {
      hash = await dhash(buf);
    } catch (err) {
      entry.rejects.push({ id: c.id, why: [`decode: ${err.message}`] });
      continue;
    }
    if (isDuplicate(hash, exclude) || isDuplicate(hash, items.map((x) => x.hash))) {
      entry.rejects.push({ id: c.id, why: ["duplicate (dHash)"] });
      continue;
    }
    items.push({ cand: c, hash, thumb: await thumbJpeg(buf, 768), stage });
  }
  entry.vetted = items.length;
  if (!items.length) return [];

  let verdicts;
  if (ctx.useVision) {
    try {
      verdicts = await vet(items, intent, plan.rubric, { gemini: ctx.gemini, cacheDir: ctx.cacheDir, subject: cands.entity });
    } catch (err) {
      entry.error = `vision: ${err.message}`;
      log(`[${intent.slot}] vision failed: ${err.message}`);
      return [];
    }
  } else {
    verdicts = items.map((_, k) => ({ i: k + 1, matches: true, confidence: 0.5, watermark: false, heavyText: false, graphic: false, isScreenshot: false, focal: [0, 0, 1, 1], depicts: "", unvetted: true }));
  }
  const ranked = [];
  items.forEach((it, k) => {
    const v = verdicts[k];
    const p = verdictProblems(v, intent.kind);
    if (p.length) {
      entry.rejects.push({ id: it.cand.id, why: p });
      return;
    }
    const size = slotSize(intent);
    const headroom = Math.min(1, (it.cand.width || 0) / (size.w * 1.5));
    const score = v.confidence + licencePref(it.cand.licence) + 0.05 * headroom + (it.cand.via === "wikidata:P154" && intent.kind === "logo" ? 0.2 : /^wikidata/.test(it.cand.via) ? 0.05 : 0);
    ranked.push({ ...it, verdict: v, score });
  });
  entry.passed = ranked.length;
  ranked.sort((a, b) => b.score - a.score);
  log(`[${intent.slot}] ${entry.stage}: ${entry.found} found, ${entry.eligible} eligible, ${entry.vetted} vetted, ${entry.passed} passed`);
  return ranked;
}

async function illustrationCandidate(intent, plan, ctx, trace) {
  const entry = { stage: "illustration", attempts: 0 };
  trace.push(entry);
  // first try + up to 2 retries when vision finds text or a mismatch
  for (let attempt = 0; attempt < 3; attempt++) {
    entry.attempts++;
    const img = await ctx.providers.illustrate.illustrate(ctx.gemini, intent);
    const info = sniffImage(img.data);
    if (!info) continue;
    const hash = await dhash(img.data);
    const cand = {
      source: "illustration",
      via: "gemini:image",
      id: `ai:${intent.slot}`,
      title: intent.intent,
      width: info.width,
      height: info.height,
      mediaType: "image",
      licence: { id: "ai", label: "AI-generated", allowed: true, sa: false, attribution: false, url: "" },
      author: "",
      model: img.model,
      prompt: img.prompt,
      data: img.data,
      ext: info.ext,
    };
    let verdict = { matches: true, confidence: 0.7, watermark: false, heavyText: false, graphic: false, isScreenshot: false, focal: [0, 0, 1, 1], depicts: "" };
    if (ctx.useVision) {
      const thumb = await thumbJpeg(img.data, 768);
      try {
        [verdict] = await vet([{ hash, thumb }], { ...intent, kind: "illustration" }, `A flat editorial illustration of: ${intent.intent}. It must contain no letters, words, numbers or text of any kind, and no real person's likeness.`, {
        gemini: ctx.gemini,
          cacheDir: ctx.cacheDir,
        });
      } catch (err) {
        // a failed vetting call never passes an image: count it as a rejected attempt
        entry.rejects = (entry.rejects || []).concat([{ why: [`vision: ${err.message.slice(0, 80)}`] }]);
        continue;
      }
      const p = verdictProblems(verdict, "illustration");
      if (p.length) {
        entry.rejects = (entry.rejects || []).concat([{ why: p }]);
        continue;
      }
    }
    entry.passed = 1;
    return { cand, hash, verdict, stage: "illustration", score: verdict.confidence };
  }
  return null;
}

async function finalize(pick, intent, ctx) {
  const c = pick.cand;
  let buf;
  let ext;
  if (c.source === "illustration") {
    buf = c.data;
    ext = c.ext;
  } else {
    buf = await ctx.http.getBuffer(c.fileUrl, { maxBytes: c.mediaType === "video" ? MAX_VIDEO_BYTES : 40 * 1024 * 1024 });
    if (c.mediaType === "video") ext = /\.ogv$/i.test(c.fileUrl) ? "ogv" : "webm";
    else {
      const info = sniffImage(buf);
      ext = info ? info.ext : "jpg";
      if (info && info.width) {
        c.width = info.width;
        c.height = info.height;
      }
    }
  }
  const rec = {
    kind: intent.kind,
    source: c.source,
    provider: c.provider,
    title: c.title,
    author: c.author,
    licence: c.licence,
    pageUrl: c.pageUrl,
    fileUrl: c.fileUrl,
    model: c.model,
  };
  const credit = shortCredit(rec);
  const creditFull = fullCredit(rec);
  const status = c.source === "illustration" ? "illustration" : "ok";
  const sidecar = {
    kind: c.mediaType === "video" ? "video" : "image",
    source: c.source,
    via: c.via,
    provider: c.provider || undefined,
    id: c.id,
    title: c.title,
    pageUrl: c.pageUrl || null,
    fileUrl: c.fileUrl || null,
    author: c.author || null,
    licence: c.licence.label,
    licenceUrl: c.licence.url || null,
    sa: !!c.licence.sa,
    credit,
    creditFull,
    width: c.width,
    height: c.height,
    origWidth: c.origWidth || c.width,
    origHeight: c.origHeight || c.height,
    focal: pick.verdict.focal,
    dhash: pick.hash,
    query: c.query || null,
    intent: intent.intent,
    vision: { depicts: pick.verdict.depicts, confidence: pick.verdict.confidence, unvetted: !!pick.verdict.unvetted },
    prompt: c.prompt,
    model: c.model,
    fetchedAt: new Date().toISOString(),
    resolverVersion: 1,
  };
  const s = store(ctx.cacheDir, buf, ext, sidecar);
  return {
    status,
    kind: sidecar.kind,
    source: c.source,
    sha: s.sha,
    file: s.file,
    credit,
    creditFull,
    licence: c.licence.label,
    licenceUrl: c.licence.url || null,
    focal: pick.verdict.focal,
    width: c.width,
    height: c.height,
    pageUrl: c.pageUrl || null,
    depicts: pick.verdict.depicts || undefined,
    size: pick.size || slotSize(intent).name,
  };
}

function creditsText(manifest) {
  const lines = ["Image credits", ""];
  for (const [slot, e] of Object.entries(manifest)) {
    if (e.status === "fallback") continue;
    lines.push(e.creditFull.startsWith("[") ? e.creditFull : `[${slot}] ${e.creditFull}`);
  }
  return lines.join("\n") + "\n";
}

function writeOutputs(outDir, manifest, report) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "media-manifest.json"), JSON.stringify({ version: "media-manifest.v1", slots: manifest }, null, 2));
  fs.writeFileSync(path.join(outDir, "credits.txt"), creditsText(manifest));
  fs.writeFileSync(path.join(outDir, "media-report.json"), JSON.stringify(report, null, 2));
}

module.exports = { resolveMedia, validateIntents, creditsText, interleave, metadataProblems };
