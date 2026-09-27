"use strict";

/**
 * Long-form YouTube thumbnails (plan §9, stage "thumbnail" after package).
 *
 * Three 1280x720 PNG variants (< 2 MB each), composed in HTML/CSS with the LF brand tokens
 * (profile-lf.js: paper #F7F6F1, ink #16202A, red #B23A3F, hot #FFC93C; Inter heavy + JetBrains Mono)
 * and rendered by puppeteer:
 *   a  photo left-bleed + huge title right on the paper plate
 *   b  full-bleed scene photo, dark scrim, title with a yellow highlight chip + red stat chip
 *   c  big number/stat + photo drop-in card
 *
 * Inputs are the run's artefacts only: the media manifest (hero = a real photo of the main entity,
 * never an AI illustration while a real photo exists), the outline title, the dossier facts (the stat
 * must be a dossier fact value: numbersPolicy) and an optional `ask(prompt)` (Gemini lite,
 * task "longform.thumbnail") for the 2-4 word title; a deterministic title is used without it.
 *
 * Every variant is checked after rendering: every text element >= 56 px at 1280 (>= 7 px at the
 * 160x90 feed size), contrast of text against what is actually behind it (text hidden, 90th/10th
 * percentile luminance) >= 3:1, text never over the subject's face/focal box, file < 2 MB.
 * thumbnails.json records the checks and the asset used (slot, file, credit, licence).
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const W = 1280;
const H = 720;
const MAX_BYTES = 2 * 1024 * 1024;
const MIN_FONT = 56; // 7 px at 160x90
const MIN_CONTRAST = 3;
const VERSION = "lf-thumb.2"; // cache key for the thumbnail stage (v2 composer; v1 layouts as fallback)
const REPO = path.resolve(__dirname, "..", "..", "..");
const VIDEO_ENGINE = path.join(REPO, "video-engine");
const PUPPETEER_FROM = path.join(REPO, "carousel-engine");

const T = { paper: "#f7f6f1", card: "#fffefb", line: "#dedbd1", ink: "#16202a", ink2: "#3f4648", red: "#b23a3f", redHot: "#d7263d", blue: "#1d5ebd", hot: "#ffc93c", marker: "#fde587" };

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ------------------------------------------------------------------------------ hero selection

function sidecarVision(entry) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(VIDEO_ENGINE, entry.file).replace(/\.[a-z0-9]+$/i, ".json"), "utf-8"));
    return j.vision || null;
  } catch (_) {
    return null;
  }
}

/** entity names that matter, most important first: those in the title/angle, then dossier order */
function mainEntities(dossier, outline, topic) {
  const text = `${(outline && outline.title) || ""} ${(dossier && dossier.angle) || ""} ${topic || ""}`.toLowerCase();
  const ents = ((dossier && dossier.entities) || []).map((e, i) => ({ name: clean(e.name), kind: e.kind, i }));
  return ents
    .map((e) => ({ ...e, inText: text.includes(e.name.toLowerCase()) || text.includes(e.name.split(" ")[0].toLowerCase()) }))
    .sort((a, b) => (b.inText - a.inText) || a.i - b.i);
}

/**
 * Rank manifest images for a thumbnail. Real photos only when any exist; person/portrait of a main
 * entity first, then brand/product photos; vision confidence and pixel size break ties.
 * @returns {{slot, entry, score, kind, entity, confidence, real}[]}
 */
function rankHeroes({ manifest, intents = [], report = {}, dossier, outline, topic, vision = sidecarVision }) {
  const byslot = Object.fromEntries((intents || []).map((i) => [i.slot, i]));
  const ents = mainEntities(dossier, outline, topic);
  const top = ents.slice(0, 4);
  const out = [];
  for (const [slot, e] of Object.entries((manifest && manifest.slots) || {})) {
    if (!e || !e.file || e.status === "fallback" || e.kind === "video") continue;
    const intent = byslot[slot] || {};
    const kind = intent.kind || "photo";
    if (kind === "logo" || kind === "map") continue;
    const real = e.status !== "illustration" && e.source !== "illustration" && !/ai-generated/i.test(e.licence || "");
    const rslots = (report && (report.slots || (report.resolver && report.resolver.slots))) || {};
    const rep = rslots[slot] && rslots[slot].pick;
    const v = (rep && rep.confidence != null ? { confidence: rep.confidence } : null) || vision(e) || {};
    const confidence = Number.isFinite(Number(v.confidence)) ? Number(v.confidence) : 0.5;
    const hay = `${intent.entity || ""} ${intent.intent || ""} ${e.depicts || ""}`.toLowerCase();
    const hit = top.findIndex((x) => hay.includes(x.name.toLowerCase()));
    const ent = hit >= 0 ? top[hit] : null;
    const person = kind === "portrait" || (ent && ent.kind === "person");
    let score = confidence + 0.3 * Math.min(1, ((e.width || 0) * (e.height || 0)) / (1920 * 1080));
    if (ent) score += (ent.inText ? 0.5 : 0.3) - 0.05 * hit;
    if (person) score += 0.35;
    else if (kind === "photo") score += 0.1;
    if (!real) score -= 2;
    if ((e.width || 0) < 800) score -= 0.5;
    out.push({ slot, entry: e, score: Number(score.toFixed(3)), kind, person, entity: ent ? ent.name : intent.entity || null, confidence, real });
  }
  out.sort((a, b) => b.score - a.score);
  // never an illustration while a real photo exists
  return out.some((x) => x.real) ? out.filter((x) => x.real) : out;
}

/** a landscape scene for the full-bleed variant: a different slot than the hero when a good one exists */
function pickScene(ranked, hero) {
  const land = ranked.filter((x) => x.slot !== hero.slot && !x.person && (x.entry.width || 0) / (x.entry.height || 1) >= 1.3 && (x.entry.width || 0) >= 1280);
  const heroLand = (hero.entry.width || 0) / (hero.entry.height || 1) >= 1.3 && !hero.person;
  if (heroLand || !land.length) return hero;
  // same entity family as the hero's story (brand photo), best score
  return land[0];
}

// ------------------------------------------------------------------------------ text: title + stat

const KILL = /\b(collapse[sd]?|crash(e[sd])?|fail(ed|s)?|bankrupt(cy)?|went bust|fell|fall|died|death|downfall|ruin(ed)?|sank|sink|default(ed)?|grounded|destroyed|killed)\b/i;
const RISE = /\b(rise|rose|built|won|wins|dominat\w*|conquer\w*|took over|beat)\b/i;

/** short display name: "Kingfisher Airlines" -> "KINGFISHER", "Vijay Mallya" -> "MALLYA" */
function shortName(ent) {
  if (!ent) return "";
  const w = ent.name.split(/\s+/);
  if (ent.kind === "person") return w[w.length - 1];
  const drop = /^(airlines?|ltd|limited|inc|corp(oration)?|group|bank|industries|holdings|company|co)$/i;
  const kept = w.filter((x, i) => i === 0 || !drop.test(x));
  return kept.slice(0, 2).join(" ").length <= 12 ? kept.slice(0, 2).join(" ") : kept[0];
}

/** deterministic 2-4 word hook from the outline title (no model) */
function fallbackTitle({ outline, dossier, topic }) {
  const title = clean((outline && outline.title) || topic);
  const ents = mainEntities(dossier, outline, topic);
  const brand = ents.find((e) => e.inText && e.kind !== "person") || ents.find((e) => e.inText) || ents[0];
  const name = shortName(brand) || clean(topic).split(" ").slice(-1)[0];
  let words;
  let highlight;
  if (KILL.test(title) || KILL.test(topic || "")) {
    words = `WHAT KILLED ${name}?`;
    highlight = "KILLED";
  } else if (RISE.test(title) || RISE.test(topic || "")) {
    words = `HOW ${name} WON`;
    highlight = "WON";
  } else {
    words = `${name}: THE TRUTH`;
    highlight = "TRUTH";
  }
  return { text: words.toUpperCase(), highlight, source: "deterministic" };
}

function validTitle(t) {
  const s = clean(t).toUpperCase();
  const n = s.split(" ").filter(Boolean).length;
  return n >= 2 && n <= 4 && s.length <= 26 && !/[#@\u{1F300}-\u{1FAFF}]/u.test(s) ? s : null;
}

const INR = new Intl.NumberFormat("en-IN");
const USD = new Intl.NumberFormat("en-US");

/** "₹9,000 CR", "$147", "26.7%" from a dossier fact; null when the unit is not displayable */
function formatStat(f) {
  const v = Number(f.value);
  const u = String(f.unit || "").toLowerCase();
  if (!Number.isFinite(v) || v === 0) return null;
  const abs = Math.abs(v);
  if (/inr|₹|rupee/.test(u)) {
    if (/lakh crore/.test(u)) return `₹${INR.format(abs)} LAKH CR`;
    if (/crore/.test(u)) return abs >= 100000 ? `₹${INR.format(+(abs / 100000).toFixed(1))} LAKH CR` : `₹${INR.format(abs)} CR`;
    if (/billion/.test(u)) return `₹${USD.format(abs)}B`;
    return null;
  }
  if (/usd|\$|dollar/.test(u)) {
    if (/trillion/.test(u)) return `$${USD.format(abs)}T`;
    if (/billion/.test(u)) return `$${USD.format(abs)}B`;
    if (/million/.test(u)) return `$${USD.format(abs)}M`;
    if (/barrel|share|per /.test(u)) return null;
    return abs >= 1e9 ? `$${USD.format(+(abs / 1e9).toFixed(1))}B` : abs >= 1e6 ? `$${USD.format(+(abs / 1e6).toFixed(1))}M` : null;
  }
  return null;
}

function statLabel(claim) {
  const c = String(claim || "").toLowerCase();
  if (/debt|default|owed|liabilit|npa|loan/.test(c)) return "DEBT";
  if (/loss/.test(c)) return "LOSSES";
  if (/fraud|scam|launder/.test(c)) return "SCAM";
  if (/revenue|sales/.test(c)) return "REVENUE";
  if (/valuation|valued|market cap/.test(c)) return "VALUATION";
  if (/profit/.test(c)) return "PROFIT";
  return null;
}

/** the headline number: a money fact whose value is in the outline title first, else the biggest confident one */
function pickStat({ dossier, outline }) {
  const title = String((outline && outline.title) || "").replace(/,/g, "");
  const facts = ((dossier && dossier.facts) || []).filter((f) => f.value != null && f.confidence !== "low");
  const cands = facts.map((f) => ({ f, text: formatStat(f) })).filter((x) => x.text);
  if (!cands.length) return null;
  const inTitle = cands.filter((x) => new RegExp(`(^|[^0-9.])${String(Math.abs(Number(x.f.value)))}([^0-9.]|$)`).test(title));
  const pool = inTitle.length ? inTitle : cands;
  pool.sort((a, b) => Math.abs(b.f.value) - Math.abs(a.f.value) || (a.f.confidence === "high" ? -1 : 1));
  const best = pool[0];
  return { text: best.text, label: statLabel(best.f.claim), factId: best.f.id, value: best.f.value, unit: best.f.unit };
}

/** 2-4 word title: Gemini lite when `ask` is given (validated), deterministic otherwise */
async function makeTitle({ outline, dossier, topic, stat, ask, log = () => {} }) {
  const fb = fallbackTitle({ outline, dossier, topic });
  if (!ask) return fb;
  try {
    const prompt = [
      `Write the text for a YouTube thumbnail of a finance/business explainer.`,
      `Video title: "${clean(outline && outline.title)}". Topic: ${topic}. Angle: ${clean(dossier && dossier.angle)}.`,
      stat ? `The thumbnail also shows the number ${stat.text}${stat.label ? " " + stat.label : ""}, so do not repeat that number.` : "",
      `Rules: 2-4 words, max 24 characters, punchy, curiosity or stakes, COMPLEMENTS the title (never repeats it), no emojis, no hashtags, no lies.`,
      `Also pick ONE word of it to highlight. Return JSON {"text": string, "highlight": string}.`,
    ].filter(Boolean).join("\n");
    const r = await ask(prompt);
    const text = r && validTitle(r.text);
    if (text) {
      const hl = clean(r.highlight).toUpperCase();
      return { text, highlight: text.split(" ").includes(hl) ? hl : text.split(" ")[0], source: "gemini" };
    }
    log(`thumbnail: Gemini title rejected (${JSON.stringify(r).slice(0, 120)}); deterministic title`);
  } catch (err) {
    log(`thumbnail: Gemini title unavailable (${String(err.message).slice(0, 120)}); deterministic title`);
  }
  return fb;
}

// ------------------------------------------------------------------------------ layout helpers

/**
 * Cover-fit an image into a box so the focal centre lands at `target` (box fractions), zoomed by
 * `zoom` (>= 1). Returns the <img> rect in box coordinates and the subject rect (face estimate for
 * people: upper-centre of the focal box).
 */
function place({ boxW, boxH, imgW, imgH, focal = [0, 0, 1, 1], target = [0.5, 0.5], zoom = 1, person = false }) {
  const s = Math.max(boxW / imgW, boxH / imgH) * zoom;
  const dw = imgW * s;
  const dh = imgH * s;
  const [fx, fy, fw, fh] = focal;
  const subj = person ? [fx + 0.2 * fw, fy + 0.02 * fh, 0.6 * fw, 0.7 * fh] : [fx, fy, fw, fh];
  const cx = (subj[0] + subj[2] / 2) * dw;
  const cy = (subj[1] + subj[3] / 2) * dh;
  const left = Math.min(0, Math.max(boxW - dw, target[0] * boxW - cx));
  const top = Math.min(0, Math.max(boxH - dh, target[1] * boxH - cy));
  const r = (n) => Math.round(n * 10) / 10;
  return {
    img: { left: r(left), top: r(top), width: r(dw), height: r(dh) },
    subject: { x: r(left + subj[0] * dw), y: r(top + subj[1] * dh), w: r(subj[2] * dw), h: r(subj[3] * dh) },
  };
}

function fontFaces() {
  const css = [];
  const jb = path.join(VIDEO_ENGINE, "assets", "fonts", "jetbrains-mono");
  for (const [w, f] of [[700, "JetBrainsMono-Bold.woff2"], [800, "JetBrainsMono-ExtraBold.woff2"]]) {
    const p = path.join(jb, f);
    if (fs.existsSync(p)) css.push(`@font-face{font-family:'JetBrains Mono';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(p).toString("base64")}) format('woff2');}`);
  }
  // Inter: the installed family (what the stage renders with); a bundled latin subset as the fallback
  const interDir = path.join(REPO, ".agents", "skills", "embedded-captions", "modes", "standard", "fonts", "files");
  for (const w of [800, 900]) {
    const p = path.join(interDir, `inter-latin-${w}-normal.woff2`);
    const local = w === 900 ? "local('Inter Black'),local('Inter-Black')" : "local('Inter ExtraBold'),local('Inter-ExtraBold')";
    css.push(`@font-face{font-family:'InterThumb';font-weight:${w};src:${local}${fs.existsSync(p) ? `,url(data:font/woff2;base64,${fs.readFileSync(p).toString("base64")}) format('woff2')` : ""};}`);
  }
  return css.join("\n");
}

function dataUri(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
}

const SANS = "'InterThumb', Inter, 'Arial Black', sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

function baseCss() {
  return `*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${T.paper}}
body{font-family:${SANS};color:${T.ink};-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
.stage{position:absolute;inset:0;overflow:hidden}
.dots{position:absolute;inset:0;background-image:radial-gradient(circle,#e3e0d6 0,#e3e0d6 1.6px,transparent 2px);background-size:28px 28px;background-position:14px 14px}
.photo{position:absolute;overflow:hidden}
.photo img{position:absolute;display:block}
.subject{position:absolute;pointer-events:none}
.t{font-weight:900;letter-spacing:-0.035em;line-height:.92;text-transform:uppercase}
.fit{display:block}
.chip{display:inline-block;font-weight:900;letter-spacing:-0.01em;line-height:1;text-transform:uppercase;border-radius:12px}
.hl{display:inline-block;background:${T.hot};color:${T.ink};padding:0 .12em .02em;border-radius:.1em;transform:rotate(-1.5deg)}`;
}

/** title HTML: words, the highlight word wrapped; `br` = index of the word that starts line 2 */
function titleHtml(text, highlight, { mode = "chip", br = null } = {}) {
  const words = text.split(" ");
  const cut = br != null ? br : words.length <= 2 ? 1 : Math.ceil(words.length / 2);
  return words
    .map((w, i) => {
      const inner = w === highlight ? (mode === "chip" ? `<span class="hl">${esc(w)}</span>` : `<span style="color:${mode}">${esc(w)}</span>`) : esc(w);
      return (i === cut ? "<br>" : i ? " " : "") + inner;
    })
    .join("");
}

/** second line starts at the longest word when it is last ("WHAT KILLED / KINGFISHER?") */
function breakAt(text) {
  const w = text.split(" ");
  if (w.length <= 2) return 1;
  const longest = w.reduce((m, x, i) => (x.length > w[m].length ? i : m), 0);
  return longest === w.length - 1 ? w.length - 1 : Math.ceil(w.length / 2);
}

// ------------------------------------------------------------------------------ the three variants

function variantA({ hero, heroFile, title, stat }) {
  const PW = 560;
  const pl = place({ boxW: PW, boxH: H, imgW: hero.entry.width, imgH: hero.entry.height, focal: hero.entry.focal, target: [0.5, 0.44], zoom: hero.person ? 1.12 : 1.05, person: hero.person });
  const statHtml = stat ? `<div data-text class="chip" style="margin-top:34px;background:${T.red};color:#fff;font-size:64px;padding:14px 22px 12px">${esc(stat.text)}${stat.label ? " " + esc(stat.label) : ""}</div>` : "";
  return {
    subject: pl.subject,
    html: `<div class="stage"><div class="dots"></div>
<div class="photo" style="left:0;top:0;width:${PW}px;height:${H}px"><img src="${heroFile}" style="left:${pl.img.left}px;top:${pl.img.top}px;width:${pl.img.width}px;height:${pl.img.height}px"></div>
<div style="position:absolute;left:${PW}px;top:0;width:14px;height:${H}px;background:${T.red}"></div>
<div class="subject" data-subject style="left:${pl.subject.x}px;top:${pl.subject.y}px;width:${pl.subject.w}px;height:${pl.subject.h}px"></div>
<div style="position:absolute;left:${PW + 56}px;right:48px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start">
  <div data-text data-fit data-max="150" class="t fit" style="width:100%;font-size:150px;color:${T.ink}">${titleHtml(title.text, title.highlight, { mode: T.red, br: breakAt(title.text) })}</div>
  ${statHtml}
</div></div>`,
  };
}

function variantB({ scene, sceneFile, title, stat }) {
  const pl = place({ boxW: W, boxH: H, imgW: scene.entry.width, imgH: scene.entry.height, focal: scene.entry.focal, target: [0.66, 0.5], zoom: 1.08, person: scene.person });
  const statHtml = stat ? `<div data-text class="chip" style="background:${T.redHot};color:#fff;font-size:62px;padding:14px 20px 12px;margin-bottom:26px;box-shadow:0 6px 0 rgba(0,0,0,.35)">${esc(stat.text)}${stat.label ? " " + esc(stat.label) : ""}</div>` : "";
  return {
    subject: pl.subject,
    html: `<div class="stage" style="background:#0d1116">
<div class="photo" style="inset:0"><img src="${sceneFile}" style="left:${pl.img.left}px;top:${pl.img.top}px;width:${pl.img.width}px;height:${pl.img.height}px;filter:saturate(1.15) contrast(1.06)"></div>
<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(9,12,17,.93) 0%,rgba(9,12,17,.86) 36%,rgba(9,12,17,.45) 60%,rgba(9,12,17,.05) 82%)"></div>
<div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(9,12,17,.55) 0%,rgba(9,12,17,0) 30%)"></div>
<div class="subject" data-subject style="left:${pl.subject.x}px;top:${pl.subject.y}px;width:${pl.subject.w}px;height:${pl.subject.h}px"></div>
<div style="position:absolute;left:64px;top:0;bottom:0;width:760px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start">
  ${statHtml}
  <div data-text data-fit data-max="138" class="t fit" style="width:100%;font-size:138px;color:#fff;text-shadow:0 4px 18px rgba(0,0,0,.45)">${titleHtml(title.text, title.highlight, { mode: "chip", br: breakAt(title.text) })}</div>
</div>
<div style="position:absolute;left:0;right:0;bottom:0;height:12px;background:${T.redHot}"></div></div>`,
  };
}

function variantC({ hero, heroFile, title, stat }) {
  const CW = 470;
  const CH = 560;
  const pl = place({ boxW: CW, boxH: CH, imgW: hero.entry.width, imgH: hero.entry.height, focal: hero.entry.focal, target: [0.5, 0.42], zoom: hero.person ? 1.1 : 1.0, person: hero.person });
  const cardLeft = W - CW - 70;
  const cardTop = (H - CH) / 2 - 6;
  // the card is rotated 2.5deg; the subject box is reported unrotated (small error, generous checks)
  const subject = { x: cardLeft + pl.subject.x, y: cardTop + pl.subject.y, w: pl.subject.w, h: pl.subject.h };
  // number stacked: amount huge in red, then one ink chip with the unit + what it is ("CRORE DEBT")
  let big;
  if (stat) {
    const sp = stat.text.indexOf(" ");
    const amount = sp > 0 ? stat.text.slice(0, sp) : stat.text;
    const unit = sp > 0 ? stat.text.slice(sp + 1).replace(/\bCR\b/, "CRORE") : "";
    const chip = [unit, stat.label].filter(Boolean).join(" ");
    big = `<div data-text data-fit data-max="236" class="t fit" style="width:100%;font-size:236px;color:${T.red};letter-spacing:-0.05em;white-space:nowrap;line-height:.9">${esc(amount)}</div>
  ${chip ? `<div data-text data-fit data-max="92" class="chip fit" style="margin-top:22px;max-width:100%;background:${T.ink};color:#fff;font-size:92px;padding:14px 24px 12px;white-space:nowrap">${esc(chip)}</div>` : `<div data-text data-fit data-max="96" class="t fit" style="width:100%;margin-top:26px;font-size:96px;color:${T.ink}">${titleHtml(title.text, title.highlight, { mode: "chip", br: breakAt(title.text) })}</div>`}`;
  } else {
    big = `<div data-text data-fit data-max="150" class="t fit" style="width:100%;font-size:150px;color:${T.ink}">${titleHtml(title.text, title.highlight, { mode: "chip", br: breakAt(title.text) })}</div>`;
  }
  return {
    subject,
    html: `<div class="stage"><div class="dots"></div>
<div style="position:absolute;left:0;top:0;width:18px;height:${H}px;background:${T.red}"></div>
<div style="position:absolute;left:84px;top:0;bottom:0;width:${cardLeft - 84 - 40}px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start">
  ${big}
</div>
<div style="position:absolute;left:${cardLeft}px;top:${cardTop}px;width:${CW}px;height:${CH}px;transform:rotate(2.5deg);background:#fff;padding:12px;border-radius:18px;box-shadow:0 26px 60px rgba(22,32,42,.28),0 4px 10px rgba(22,32,42,.15)">
  <div class="photo" style="left:12px;top:12px;width:${CW - 24}px;height:${CH - 24}px;border-radius:10px"><img src="${heroFile}" style="left:${pl.img.left - 12}px;top:${pl.img.top - 12}px;width:${pl.img.width}px;height:${pl.img.height}px"></div>
</div>
<div class="subject" data-subject style="left:${subject.x}px;top:${subject.y}px;width:${subject.w}px;height:${subject.h}px"></div>
</div>`,
  };
}

const VARIANTS = {
  a: { name: "photo left-bleed + title on paper", build: variantA, asset: "hero" },
  b: { name: "full-bleed photo + scrim + highlight chip", build: variantB, asset: "scene" },
  c: { name: "big number + photo card", build: variantC, asset: "hero" },
};

// ------------------------------------------------------------------------------ render + checks

async function launchBrowser() {
  const puppeteer = require(require.resolve("puppeteer", { paths: [PUPPETEER_FROM] }));
  return puppeteer.launch({ headless: true, args: ["--allow-file-access-from-files", "--force-device-scale-factor=1"] });
}

const FIT_JS = `(async () => {
  await document.fonts.ready;
  for (const el of document.querySelectorAll('[data-fit]')) {
    let fs = Number(el.dataset.max) || parseFloat(getComputedStyle(el).fontSize);
    const parent = el.parentElement;
    const tooBig = () => el.scrollWidth > el.clientWidth + 1 || [...el.querySelectorAll('span')].some(s => s.getBoundingClientRect().right > el.getBoundingClientRect().right + 1) || parent.scrollHeight > parent.clientHeight + 1;
    el.style.fontSize = fs + 'px';
    while (tooBig() && fs > 40) { fs -= 2; el.style.fontSize = fs + 'px'; }
  }
  return true;
})()`;

const MEASURE_JS = `(() => {
  const rects = [...document.querySelectorAll('[data-text]')].map(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    // the tightest boxes: every text line/span, for overlap and contrast sampling
    const range = document.createRange(); range.selectNodeContents(el);
    const lines = [...range.getClientRects()].filter(q => q.width > 4 && q.height > 4).map(q => ({ x: q.x, y: q.y, w: q.width, h: q.height }));
    const spans = [...el.querySelectorAll('span')].map(s => ({ color: getComputedStyle(s).color, fontSize: parseFloat(getComputedStyle(s).fontSize) }));
    return { text: el.innerText.replace(/\\s+/g, ' ').trim(), x: r.x, y: r.y, w: r.width, h: r.height, fontSize: parseFloat(cs.fontSize), color: cs.color, spans, lines };
  });
  const s = document.querySelector('[data-subject]');
  const sr = s ? s.getBoundingClientRect() : null;
  return { rects, subject: sr ? { x: sr.x, y: sr.y, w: sr.width, h: sr.height } : null };
})()`;

/** in-page: luminance percentiles of the text-hidden frame inside each text line box, + a 160x90 preview */
const SAMPLE_JS = (bgUri, fullUri, boxes) => `(async () => {
  const load = (u) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; });
  const bg = await load(${JSON.stringify(bgUri)});
  const c = document.createElement('canvas'); c.width = ${W}; c.height = ${H};
  const g = c.getContext('2d'); g.drawImage(bg, 0, 0);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const out = ${JSON.stringify(boxes)}.map(b => {
    const x = Math.max(0, Math.floor(b.x)), y = Math.max(0, Math.floor(b.y));
    const w = Math.max(1, Math.min(${W} - x, Math.ceil(b.w))), h = Math.max(1, Math.min(${H} - y, Math.ceil(b.h)));
    const d = g.getImageData(x, y, w, h).data;
    const L = [];
    for (let i = 0; i < d.length; i += 16) L.push(0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]));
    L.sort((a, b) => a - b);
    return { p10: L[Math.floor(L.length * 0.1)], p50: L[Math.floor(L.length * 0.5)], p90: L[Math.floor(L.length * 0.9)] };
  });
  const full = await load(${JSON.stringify(fullUri)});
  const s = document.createElement('canvas'); s.width = 160; s.height = 90;
  const sg = s.getContext('2d'); sg.imageSmoothingQuality = 'high'; sg.drawImage(full, 0, 0, 160, 90);
  return { lum: out, preview: s.toDataURL('image/png') };
})()`;

function rgbLum(css) {
  const m = String(css).match(/rgba?\(([^)]+)\)/);
  if (!m) return 0;
  const [r, g, b] = m[1].split(",").map((x) => Number(x.trim()));
  const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function overlap(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

/** shrink an over-size PNG with a 256-colour palette (ffmpeg); returns the new size */
function shrinkPng(file) {
  const tmp = file.replace(/\.png$/, ".q.png");
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", file, "-vf", "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a", tmp], { windowsHide: true });
  if (r.status === 0 && fs.existsSync(tmp)) {
    fs.renameSync(tmp, file);
  }
  return fs.statSync(file).size;
}

async function renderVariant(page, { html, workDir, id, file }) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces()}\n${baseCss()}</style></head><body>${html}</body></html>`;
  if (process.env.THUMB_DEBUG) fs.writeFileSync(path.join(workDir, `thumbnail-${id}.html`), doc);
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.setContent(doc, { waitUntil: "load" });
  await page.evaluate(FIT_JS);
  const m = await page.evaluate(MEASURE_JS);
  const full = Buffer.from(await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } }));
  fs.writeFileSync(file, full);
  await page.addStyleTag({ content: "[data-text],[data-text] *{color:transparent!important;text-shadow:none!important}" });
  const bg = Buffer.from(await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } }));
  const boxes = m.rects.flatMap((r, i) => r.lines.map((l) => ({ ...l, i })));
  const s = await page.evaluate(SAMPLE_JS(`data:image/png;base64,${bg.toString("base64")}`, `data:image/png;base64,${full.toString("base64")}`, boxes));
  fs.writeFileSync(path.join(workDir, `thumbnail-${id}-160x90.png`), Buffer.from(s.preview.split(",")[1], "base64"));
  // checks
  const texts = m.rects.map((r, i) => {
    const colours = [r.color, ...r.spans.map((x) => x.color)];
    const lums = s.lum.filter((_, k) => boxes[k].i === i);
    let worst = Infinity;
    for (const c of colours) {
      const tl = rgbLum(c);
      for (const l of lums) {
        // compare against the background pixels closest to the text colour (light text: brightest)
        const bgL = tl > l.p50 ? l.p90 : l.p10;
        worst = Math.min(worst, ratio(tl, bgL));
      }
    }
    // a highlight span has its own background: judge it against its median (the chip colour)
    if (r.spans.length && worst < MIN_CONTRAST) {
      worst = Math.max(worst, Math.min(...colours.map((c) => Math.max(...lums.map((l) => ratio(rgbLum(c), l.p50))))));
    }
    const minFont = Math.min(r.fontSize, ...r.spans.map((x) => x.fontSize));
    const subjOverlap = m.subject ? r.lines.reduce((a, l) => a + overlap(l, m.subject), 0) / Math.max(1, m.subject.w * m.subject.h) : 0;
    return { text: r.text, fontPx: Math.round(minFont), at160Px: Number((minFont * 160 / W).toFixed(1)), contrast: Number(worst.toFixed(2)), subjectOverlap: Number(subjOverlap.toFixed(3)) };
  });
  let bytes = fs.statSync(file).size;
  let quantized = false;
  if (bytes >= MAX_BYTES) {
    bytes = shrinkPng(file);
    quantized = true;
  }
  return { texts, subject: m.subject, bytes, quantized };
}

/**
 * Build the three thumbnails. v2 (lib/longform/thumbnailV2.js: fal photoreal background, licensed face
 * cut-out, condensed headline, vision scorer) when fal.ai is configured and a model is available (`ask`);
 * the v1 layouts from the media manifest otherwise (offline, no FAL_KEY, THUMB_V1=1, or a v2 failure).
 * @param {{finalDir, workDir, manifest, intents?, report?, outline, dossier, topic, ask?, gemini?, log?, browser?}} o
 * @returns {Promise<object>} the thumbnails.json content
 */
async function makeThumbnails(o) {
  const log = o.log || (() => {});
  if (o.ask && process.env.THUMB_V1 !== "1") {
    let fal = null;
    try {
      fal = require("../media/fal");
    } catch (_) {}
    if (fal && fal.available()) {
      try {
        return await require("./thumbnailV2").makeThumbnailsV2(o);
      } catch (err) {
        log(`thumbnail v2 failed (${String(err.message).slice(0, 200)}); using the v1 layouts`);
      }
    }
  }
  return makeThumbnailsV1(o);
}

/** v1: three layouts from the run's own media manifest (no generation). */
async function makeThumbnailsV1(o) {
  const log = o.log || (() => {});
  const ranked = rankHeroes(o);
  if (!ranked.length) throw new Error("no usable image in the media manifest for a thumbnail");
  const hero = ranked[0];
  const scene = pickScene(ranked, hero);
  const stat = pickStat(o);
  const title = await makeTitle({ ...o, stat, log });
  log(`thumbnail: hero ${hero.slot} (${hero.kind}, conf ${hero.confidence}, score ${hero.score}), scene ${scene.slot}, title "${title.text}" (${title.source}), stat ${stat ? stat.text : "none"}`);
  fs.mkdirSync(o.finalDir, { recursive: true });
  fs.mkdirSync(o.workDir, { recursive: true });
  const files = { hero: dataUri(path.join(VIDEO_ENGINE, hero.entry.file)), scene: dataUri(path.join(VIDEO_ENGINE, scene.entry.file)) };
  const ownBrowser = !o.browser;
  const browser = o.browser || (await launchBrowser());
  const variants = [];
  try {
    const page = await browser.newPage();
    for (const id of Object.keys(VARIANTS)) {
      const V = VARIANTS[id];
      const pick = V.asset === "scene" ? scene : hero;
      const { html } = V.build({ hero, heroFile: files.hero, scene, sceneFile: files.scene, title, stat });
      const file = path.join(o.finalDir, `thumbnail-${id}.png`);
      const r = await renderVariant(page, { html, workDir: o.workDir, id, file });
      const faceGuard = pick.person;
      const checks = {
        size: { ok: r.bytes < MAX_BYTES, bytes: r.bytes, quantized: r.quantized },
        textSize: { ok: r.texts.every((t) => t.fontPx >= MIN_FONT), minFontPx: Math.min(...r.texts.map((t) => t.fontPx)), min: MIN_FONT },
        contrast: { ok: r.texts.every((t) => t.contrast >= MIN_CONTRAST), min: Math.min(...r.texts.map((t) => t.contrast)), band: `>= ${MIN_CONTRAST}:1` },
        subjectClear: { ok: !faceGuard || r.texts.every((t) => t.subjectOverlap <= 0.02), maxOverlap: Math.max(0, ...r.texts.map((t) => t.subjectOverlap)), hard: faceGuard },
      };
      const ok = Object.values(checks).every((c) => c.ok);
      variants.push({
        id,
        file: `thumbnail-${id}.png`,
        layout: V.name,
        ok,
        checks,
        texts: r.texts,
        asset: { slot: pick.slot, file: pick.entry.file, depicts: pick.entry.depicts || null, credit: pick.entry.credit || null, creditFull: pick.entry.creditFull || null, licence: pick.entry.licence || null, licenceUrl: pick.entry.licenceUrl || null, pageUrl: pick.entry.pageUrl || null, source: pick.entry.source || null },
      });
      log(`thumbnail ${id}: ${ok ? "ok" : "CHECK FAIL"} ${(r.bytes / 1024).toFixed(0)} KB, min text ${checks.textSize.minFontPx}px, min contrast ${checks.contrast.min}:1, subject overlap ${checks.subjectClear.maxOverlap}`);
    }
    await page.close();
  } finally {
    if (ownBrowser) await browser.close();
  }
  return {
    version: VERSION,
    size: `${W}x${H}`,
    title,
    stat,
    hero: { slot: hero.slot, score: hero.score, kind: hero.kind, entity: hero.entity, confidence: hero.confidence },
    scene: { slot: scene.slot },
    candidates: ranked.slice(0, 5).map((x) => ({ slot: x.slot, score: x.score, kind: x.kind, real: x.real, confidence: x.confidence })),
    recommended: (variants.find((v) => v.ok) || variants[0]).file,
    ok: variants.every((v) => v.ok),
    variants,
    note: "Credit is not drawn on the thumbnail; the asset's credit/licence is recorded here and the image is credited in the description.",
    generatedAt: new Date().toISOString(),
  };
}

/** the metadata.json `thumbnails` field */
function metadataField(j) {
  return { files: j.variants.map((v) => v.file), recommended: j.recommended, title: j.title.text, ok: j.ok, assets: [...new Set(j.variants.map((v) => v.asset.slot))], details: "thumbnails.json" };
}

module.exports = {
  makeThumbnails,
  makeThumbnailsV1,
  metadataField,
  rankHeroes,
  pickScene,
  pickStat,
  formatStat,
  fallbackTitle,
  validTitle,
  makeTitle,
  place,
  mainEntities,
  launchBrowser,
  shrinkPng,
  rgbLum,
  ratio,
  overlap,
  dataUri,
  VERSION,
  W,
  H,
  MIN_FONT,
  MAX_BYTES,
};

// CLI: node orchestrator/lib/longform/thumbnail.js --out <run dir> [--offline]
if (require.main === module) {
  const args = process.argv.slice(2);
  const out = path.resolve(args[args.indexOf("--out") + 1] || ".");
  const rj = (p) => JSON.parse(fs.readFileSync(path.join(out, p), "utf-8"));
  const opt = (p) => (fs.existsSync(path.join(out, p)) ? rj(p) : undefined);
  let ask = null;
  if (!args.includes("--offline")) {
    try {
      const g = require("./gemini").loadGeminiRest({ log: () => {} });
      ask = (prompt) => g.json(prompt, { task: "longform.thumbnail", temperature: 0.7 });
    } catch (_) {
      ask = null;
    }
  }
  makeThumbnails({ finalDir: path.join(out, "final"), workDir: path.join(out, "thumbnail"), manifest: rj("media/media-manifest.json"), intents: opt("media/intents.json"), report: opt("media/media-report.json"), outline: rj("outline.json"), dossier: rj("dossier.json"), topic: (opt("script.json") || {}).topic || rj("dossier.json").topic, ask, log: (m) => console.log(m) })
    .then((j) => {
      fs.writeFileSync(path.join(out, "final", "thumbnails.json"), JSON.stringify(j, null, 1));
      const mp = path.join(out, "final", "metadata.json");
      if (fs.existsSync(mp)) {
        const md = JSON.parse(fs.readFileSync(mp, "utf-8"));
        Object.assign(md, { thumbnails: metadataField(j) });
        md.files = { ...(md.files || {}), thumbnails: j.variants.map((v) => v.file) };
        fs.writeFileSync(mp, JSON.stringify(md, null, 1));
      }
      console.log(`thumbnails ${j.ok ? "ok" : "with failing checks"}: ${j.variants.map((v) => v.file).join(", ")}`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
