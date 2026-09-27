"use strict";
/**
 * Licensed face cut-out for thumbnails v2 (long-form v2 plan §8).
 *
 * findFace({name}) searches Wikimedia Commons for photos of a real person (Wikidata P18, the person's
 * Commons category, full-text search), keeps only licences that allow a modified reuse without
 * share-alike (public domain, CC0, CC BY, GODL-India), asks the lite vision model which pictures really
 * show that person and where the face is, picks the largest sharp frontal face, crops head + shoulders
 * and removes the background with fal BiRefNet. Never an AI-generated face of a real person.
 *
 * Returns {file (transparent PNG), width, height, faceBox [x,y,w,h] px in that PNG, facePx, credit,
 * creditFull, licence, licenceUrl, pageUrl, title, cost} or null.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { createHttp } = require("../media/http");
const { thumbJpeg, sniffImage } = require("../media/image");
const { shortCredit, fullCredit } = require("../media/credits");
const { DEFAULT_CACHE_DIR } = require("../media/cache");

const OK_LICENCES = new Set(["pd", "cc0", "cc-by", "godl-india"]);
const MAX_VET = 8;
const MIN_FACE_PX = 90;
// quality gate (coordinator review): a source under ~600 px tall looks soft at thumbnail size, and a
// head-and-shoulders crop that runs into the photo edge gives the cut-out a straight edge -> prop hero
const MIN_SOURCE_H = 600;

function licenceOk(l) {
  return !!(l && l.allowed && !l.sa && OK_LICENCES.has(l.id));
}

// Commons serves standard thumbnail buckets; 960 px is one of them (other widths answer HTTP 400)
function vetUrl(c) {
  return String(c.fileUrl || "").replace(/\/1920px-/, "/960px-");
}

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Keep usable still photos, licence-filtered, de-duplicated. A search hit must name the person's
 * surname in its file title (full-text search also returns namesakes: "Mingo" for "Domingo");
 * Wikidata/category files are trusted. Named "(cropped)" portraits and P18 first, then by resolution.
 */
function screenCandidates(cands, name = "") {
  const surname = fold(String(name).trim().split(/\s+/).slice(-1)[0]);
  const seen = new Set();
  const out = [];
  for (const c of cands) {
    if (!c || c.mediaType !== "image" || c.vector || seen.has(c.id)) continue;
    seen.add(c.id);
    if (!licenceOk(c.licence)) continue;
    if (/\.(svg|gif|tiff?|pdf)$/i.test(c.id) || /signature|firma|coat of arms|logo|map|ballot|boleta|stamp/i.test(c.id)) continue;
    if ((c.origHeight || c.height || 0) < MIN_SOURCE_H || (c.origWidth || c.width || 0) < 400) continue;
    const named = surname && fold(c.id).includes(surname);
    const trusted = /^(wikidata|commons:category)/.test(c.via || "");
    if (surname && !named && !trusted) continue;
    out.push({ ...c, _pri: (/^wikidata/.test(c.via || "") ? 0 : 2) + (named ? 0 : 1) - (/crop|recort|portrait|retrato/i.test(c.id) ? 1 : 0) });
  }
  return out.sort((a, b) => a._pri - b._pri || (b.origHeight || b.height) - (a.origHeight || a.height));
}

function facePrompt(name, description, titles) {
  const n = titles.length;
  return `You check candidate photos for a YouTube thumbnail face cut-out of ${name}${description ? ` (${description})` : ""}.
There are ${n} images labelled "Image #1" ... "Image #${n}". Their Wikimedia Commons file titles:
${titles.map((t, k) => `  #${k + 1}: ${t}`).join("\n")}
For each, return:
 {"i": number,
  "faces": how many human faces are clearly visible (count everyone, also in the background),
  "isPerson": true only if it is a real photograph in which ${name} is clearly identifiable (not a drawing, statue, poster, screen, stamp or document),
  "confidence": 0..1 for isPerson,
  "faceBox": [x, y, w, h] the box of ${name}'s face (forehead to chin, ear to ear) as fractions 0..1 of the image width/height,
  "frontal": true if the face looks roughly towards the camera,
  "sharp": true if the face is in focus and not heavily compressed,
  "occluded": true if a hand, microphone, glasses glare or another person covers part of the face,
  "expression": one word (neutral, serious, smiling, shouting, worried, ...)}
Return JSON {"results": [...]}.`;
}

function score(v, c) {
  if (!v || !v.isPerson || Number(v.confidence) < 0.6 || !Array.isArray(v.faceBox) || v.faceBox.length !== 4) return -1;
  // with two or more faces the model can box the wrong person: only single-face photos are used
  if (Number(v.faces) !== 1) return -1;
  const [, , fw, fh] = v.faceBox.map(Number);
  const H = c.height || c.origHeight;
  const Wd = c.width || c.origWidth;
  const facePx = Math.min(fh * H, fw * Wd * 1.35);
  if (!(facePx >= MIN_FACE_PX)) return -1;
  let s = Math.min(facePx, 600);
  if (v.frontal) s *= 1.25;
  if (v.sharp === false) s *= 0.5;
  if (v.occluded) s *= 0.6;
  if (/smil|laugh/i.test(v.expression || "")) s *= 0.9; // thumbnails want tension
  return s;
}

function ffmpeg(args) {
  const r = spawnSync(process.env.FFMPEG || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { windowsHide: true });
  if (r.status !== 0) throw new Error(`ffmpeg: ${String(r.stderr).slice(0, 200)}`);
}

/** head-and-shoulders crop box (px) around a face box, clamped to the image; `edge`: the wanted box ran
 * past the left, right or top of the photo (the bottom may end at the frame: the cut-out fades out there) */
function cropBox([fx, fy, fw, fh], W, H) {
  const cx = fx + fw / 2;
  let w = fw * 3.4;
  let top = fy - fh * 0.65;
  let bottom = fy + fh * 3.6;
  const edge = top < 0 || cx - w / 2 < 0 || cx + w / 2 > W;
  top = Math.max(0, top);
  bottom = Math.min(H, bottom);
  let left = Math.max(0, cx - w / 2);
  let right = Math.min(W, cx + w / 2);
  const even = (n) => Math.max(2, Math.floor(n / 2) * 2);
  return { x: Math.floor(left), y: Math.floor(top), w: even(right - left), h: even(bottom - top), edge };
}

/**
 * @param {{name: string, workDir: string, gemini: object, fal?: object, http?: object, cacheDir?: string, log?: Function, extra?: object[]}} o
 *   extra: manifest-derived candidates already in the cache ({file (abs), width, height, licence, credit, ...})
 */
async function findFace(o) {
  const log = o.log || (() => {});
  const cacheDir = o.cacheDir || DEFAULT_CACHE_DIR;
  const http = o.http || createHttp({ cacheDir, log });
  const fal = o.fal || require("../media/fal");
  const commons = require("../media/providers/commons");
  const wikidata = require("../media/providers/wikidata");
  if (!o.gemini) throw new Error("findFace needs the Gemini client for face vetting");

  let entity = null;
  const lists = [];
  try {
    entity = await wikidata.lookup(http, o.name, { classHint: "human", intent: `portrait of ${o.name}` });
  } catch (err) {
    log(`thumbnail face: wikidata ${err.message}`);
  }
  if (entity) {
    const want = wikidata.filesForKind(entity, "portrait", `portrait of ${o.name}`);
    if (want.length) lists.push(await commons.files(http, want.map((w) => w.file), { via: "wikidata" }).catch(() => []));
    if (entity.commonsCategory) lists.push(await commons.category(http, entity.commonsCategory, { limit: 20 }).catch(() => []));
  }
  lists.push(await commons.search(http, o.name, { limit: 15 }).catch(() => []));
  lists.push(await commons.search(http, `${o.name} portrait`, { limit: 10 }).catch(() => []));
  const cands = screenCandidates(lists.flat(), o.name).slice(0, MAX_VET);
  log(`thumbnail face: ${cands.length} licensed candidate photo(s) of ${o.name}`);
  if (!cands.length) return null;

  const items = [];
  for (const c of cands) {
    try {
      const buf = await http.getBuffer(vetUrl(c), { maxBytes: 20 * 1024 * 1024 });
      items.push({ c, thumb: await thumbJpeg(buf, 640) });
    } catch (err) {
      log(`thumbnail face: skip ${c.id} (${err.message.slice(0, 60)})`);
    }
  }
  if (!items.length) return null;
  const raw = await o.gemini.json(facePrompt(o.name, entity && entity.description, items.map((it) => it.c.id)), {
    images: items.map((it, k) => ({ label: `Image #${k + 1}`, mime: "image/jpeg", data: it.thumb })),
    task: "longform.thumbnail",
    temperature: 0,
  });
  const res = (raw && raw.results) || [];
  const ranked = items
    .map((it, k) => {
      const v = res.find((r) => Number(r.i) === k + 1);
      return { ...it, v, s: score(v, it.c) };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  const clear = ranked.filter((x) => {
    const W0 = x.c.width || x.c.origWidth;
    const H0 = x.c.height || x.c.origHeight;
    const [bx, by, bw, bh] = x.v.faceBox.map(Number);
    return !cropBox([bx * W0, by * H0, bw * W0, bh * H0], W0, H0).edge;
  });
  if (ranked.length && !clear.length) log(`thumbnail face: every photo of ${o.name} crops into the frame edge`);
  if (!clear.length) {
    log(`thumbnail face: no sharp, uncropped photo clearly shows ${o.name}; prop hero instead`);
    return null;
  }
  const best = clear[0];
  const c = best.c;
  const full = await http.getBuffer(c.fileUrl, { maxBytes: 40 * 1024 * 1024 });
  const info = sniffImage(full);
  if (!info || !info.width) return null;
  fs.mkdirSync(o.workDir, { recursive: true });
  const srcFile = path.join(o.workDir, `face-src.${info.ext}`);
  fs.writeFileSync(srcFile, full);
  const [bx, by, bw, bh] = best.v.faceBox.map(Number);
  const face = [bx * info.width, by * info.height, bw * info.width, bh * info.height];
  const cb = cropBox(face, info.width, info.height);
  const cropFile = path.join(o.workDir, "face-crop.png");
  // small sources (Commons headshots are often ~400 px) get a clean 2x lanczos + light unsharp before the
  // cut-out: the thumbnail shows the face at ~300 px and browser upscaling alone looks soft
  const up = cb.h < 700 ? 2 : 1;
  const vf = `crop=${cb.w}:${cb.h}:${cb.x}:${cb.y}${up > 1 ? `,scale=${cb.w * up}:${cb.h * up}:flags=lanczos,unsharp=5:5:0.7` : ""}`;
  ffmpeg(["-i", srcFile, "-vf", vf, "-frames:v", "1", cropFile]);
  const cut = await fal.removeBackground({ file: cropFile, outDir: o.workDir, name: "face-cutout", variant: "Portrait", cacheDir });
  const rec = { kind: "portrait", source: c.source, title: c.title, author: c.author, licence: c.licence, pageUrl: c.pageUrl, fileUrl: c.fileUrl };
  const out = {
    file: cut.file,
    width: cb.w * up,
    height: cb.h * up,
    faceBox: [face[0] - cb.x, face[1] - cb.y, face[2], face[3]].map((n) => Math.round(n * up)),
    facePx: Math.round(face[3]),
    upscale: up,
    expression: best.v.expression || null,
    credit: shortCredit(rec),
    creditFull: fullCredit(rec),
    licence: c.licence.label,
    licenceUrl: c.licence.url || null,
    pageUrl: c.pageUrl,
    title: c.title,
    cost: cut.cost,
    edits: "cropped, background removed, colour graded",
  };
  log(`thumbnail face: ${c.id} (${out.licence}), face ${out.facePx}px, ${best.v.expression || ""}`);
  return out;
}

module.exports = { findFace, screenCandidates, cropBox, score, licenceOk };
