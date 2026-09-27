"use strict";

/**
 * Long-form thumbnails v2 (long-form v2 plan §8), 1280x720, three variants a/b/c.
 *
 * Reference pattern: a cinematic, darker, high-contrast photo scene; one huge face cut out right or
 * centre with rim light and shadow; a 1-3 word headline in a heavy condensed font with one power word
 * in yellow or red; a small subtitle strip; a story prop.
 *
 *   concepts   one lite call: 3 x {headline 2-4 words, power word, subtitle, background scene} + a prop
 *   background fal photoreal scene per variant (generic, no faces/text; lite-vetted, 1 retry)
 *   face       a LICENSED photo of the main person (thumbFace.js: Commons PD/CC0/CC BY, single face,
 *              BiRefNet cut-out), graded with rim light + shadow. Never an AI face of a real person.
 *              No person (or none licensed) -> the prop is the hero.
 *   prop       fal photoreal object on a plain backdrop, BiRefNet cut-out
 *   QA         headline >= 56 px (>= 7 px at 168x94), subtitle >= 30 px, text contrast >= 4.5:1 (fill vs
 *              the pixels behind it, or vs its own >= 4 px outline), text never over the face box,
 *              file < 2 MB; a lite vision scorer ranks the three (full size + 168x94) -> recommended.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const TH = require("./thumbnail");
const fal = require("../media/fal");
const { thumbJpeg, sniffImage } = require("../media/image");

const { W, H, MAX_BYTES } = TH;
const VERSION = "lf-thumb.3";
const MIN_HEAD = 56;
const MIN_SECONDARY = 30;
const MIN_CONTRAST = 4.5;
const SMALL = { w: 168, h: 94 };
const REPO = path.resolve(__dirname, "..", "..", "..");

const C = { yellow: "#ffd21f", red: "#e0202e", ink: "#0b0d10", white: "#ffffff" };
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const bare = (w) => String(w || "").toUpperCase().replace(/[^A-Z0-9$€₹%'-]/g, "");

// ------------------------------------------------------------------------------ concepts

const FALLBACK_SCENES = [
  "an empty dimly lit bank hall at night with scattered paper banknotes on a marble floor",
  "a dark government office desk at night with stacks of loan documents and a single desk lamp",
  "a stormy sky over a deserted city square at dusk, wet pavement reflecting street lights",
];

function mainPerson(o) {
  if (o.facePerson !== undefined) return o.facePerson || null;
  // a person named in the title/angle first, else the first person in the dossier (its order is importance)
  const ents = TH.mainEntities(o.dossier, o.outline, o.topic);
  const p = ents.find((e) => e.kind === "person" && e.inText) || ents.find((e) => e.kind === "person");
  return p ? p.name : null;
}

// ------------------------------------------------------------------------------ place cue

// flag colours for the outline fill / light (public flag colours; fallback: channel yellow)
const FLAG = {
  ARG: ["#74acdf", "#ffffff", "#f6b40e"], IND: ["#ff9933", "#ffffff", "#138808"], PAK: ["#01411c", "#ffffff", "#01411c"],
  LKA: ["#ffbe29", "#8d153a", "#00534e"], BGD: ["#006a4e", "#f42a41", "#006a4e"], CHN: ["#de2910", "#ffde00", "#de2910"],
  USA: ["#b22234", "#ffffff", "#3c3b6e"], GBR: ["#012169", "#ffffff", "#c8102e"], RUS: ["#ffffff", "#0039a6", "#d52b1e"],
  JPN: ["#ffffff", "#bc002d", "#ffffff"], BRA: ["#009c3b", "#ffdf00", "#002776"], TUR: ["#e30a17", "#ffffff", "#e30a17"],
  GRC: ["#0d5eaf", "#ffffff", "#0d5eaf"], VEN: ["#ffcc00", "#00247d", "#cf142b"], EGY: ["#ce1126", "#ffffff", "#000000"],
  ZWE: ["#006400", "#ffd200", "#d40000"], LBN: ["#ed1c24", "#ffffff", "#00a651"], NGA: ["#008751", "#ffffff", "#008751"],
  MEX: ["#006847", "#ffffff", "#ce1126"], ZAF: ["#007a4d", "#ffb612", "#de3831"], KOR: ["#ffffff", "#cd2e3a", "#0047a0"],
  DEU: ["#000000", "#dd0000", "#ffce00"], FRA: ["#0055a4", "#ffffff", "#ef4135"], ITA: ["#009246", "#ffffff", "#ce2b37"],
  ESP: ["#aa151b", "#f1bf00", "#aa151b"], IRN: ["#239f40", "#ffffff", "#da0000"], SAU: ["#006c35", "#ffffff", "#006c35"],
  UKR: ["#0057b7", "#ffd700", "#0057b7"], IDN: ["#ff0000", "#ffffff", "#ff0000"], NPL: ["#dc143c", "#003893", "#dc143c"],
};

let GEO = null;
function geo() {
  if (!GEO) GEO = JSON.parse(fs.readFileSync(path.join(REPO, "video-engine", "assets", "geo", "world-50m.json"), "utf-8"));
  return GEO;
}

/**
 * The country the story is about: a country named in the title/topic/angle (longest name wins), else the
 * dossier's first place entity that is a country. -> {iso, name, colors} | null
 */
function placeOf(o) {
  if (o.place !== undefined) return o.place;
  let g;
  try {
    g = geo();
  } catch (_) {
    return null;
  }
  const byName = Object.entries(g.countries).map(([iso, c]) => [iso, String(c.n || "")]).filter(([, n]) => n.length > 3);
  const find = (text) => {
    const t = ` ${String(text || "").toLowerCase()} `;
    const hits = byName.filter(([, n]) => new RegExp(`[^a-z]${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z]`).test(t));
    return hits.sort((a, b) => b[1].length - a[1].length)[0] || null;
  };
  let hit = find(`${(o.outline && o.outline.title) || ""} ${o.topic || ""} ${(o.dossier && o.dossier.angle) || ""}`);
  if (!hit) for (const e of (o.dossier && o.dossier.entities) || []) if (/place|country/i.test(e.kind || "") && (hit = find(e.name))) break;
  if (!hit) return null;
  return { iso: hit[0], name: hit[1], colors: FLAG[hit[0]] || ["#ffd21f", "#ffffff", "#ffd21f"] };
}

/** glowing country outline (India-POV Natural Earth shapes, video-engine/assets/geo): opaque box height h, centred at (cx, cy) */
function outlineSvg(place, { h, cx, cy, mode = "halo" }) {
  const c = geo().countries[place.iso];
  if (!c || !c.d) return null;
  const [x0, y0, x1, y1] = c.b;
  const bw = x1 - x0;
  const bh = y1 - y0;
  const scale = h / bh;
  const w = bw * scale;
  const u = 1 / scale; // map units per px
  const [c1, c2, c3] = place.colors;
  const glow = c1 === "#ffffff" ? c2 : c1;
  const op = mode === "hero" ? 0.36 : mode === "badge" ? 0.45 : 0.25;
  const id = `o${Math.round(cx)}${Math.round(cy)}`;
  const r = (n) => Math.round(n);
  const box = { x: r(cx - w / 2), y: r(cy - h / 2), w: r(w), h: r(h) };
  const svg = `<svg class="cut" style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;overflow:visible${mode === "halo" ? ";opacity:.85" : ""}" viewBox="${x0} ${y0} ${bw} ${bh}">
<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".5" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient>
<filter id="${id}f" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(14 * u).toFixed(1)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<path d="${c.d}" fill="url(#${id}g)" fill-opacity="${op}" stroke="${glow}" stroke-width="${((mode === "hero" ? 5 : 3.5) * u).toFixed(1)}" stroke-linejoin="round" filter="url(#${id}f)"/>
</svg>`;
  return { svg, box };
}

function conceptPrompt({ outline, dossier, topic, stat, person, place }) {
  return [
    "You design 3 alternative YouTube thumbnails for a documentary-style finance/economics explainer.",
    `Video title: "${clean(outline && outline.title)}". Topic: ${clean(topic)}. Angle: ${clean(dossier && dossier.angle)}.`,
    person ? `A real photo of ${person} is cut out on the right of the thumbnail.` : "There is no person on the thumbnail; a story prop is the hero.",
    stat ? `The only number you may use is ${stat.text}${stat.label ? ` (${stat.label})` : ""}.` : "Use no numbers.",
    place ? `The story is about ${place.name}: EVERY background scene must read as ${place.name} at a glance through a recognisable landmark, skyline or street of ${place.name} (a different one per concept, e.g. its capital's skyline at dusk, a famous government building, a famous monument), dramatic but not pitch dark.` : "",
    "For each concept:",
    ' "headline": 2-4 words (max 22 characters), huge on the thumbnail; stakes or curiosity; complements the title, never repeats it; no emojis, no hashtags, no lies, and never accuse a real person or institution of a crime (no "stolen", "fraud", "scam" unless the title says so).',
    ' "power": exactly ONE word of the headline, the emotional word, shown in colour.',
    ' "subtitle": 2-5 words for a small strip under the headline (context or the number).',
    ' "scene": the background photo: a cinematic, moody, high-contrast but well-exposed scene that fits the story; NO faces, NO people in focus, NO text, signs, flags, logos or banknote close-ups; not a specific real event (e.g. "an empty trading floor at night with dead monitors").',
    'Also one "prop": a single compact physical object alone (no surface, nothing under it) that tells the story (e.g. "a cracked piggy bank", "a rusty padlock on a chain"), no text on it.',
    'Return JSON {"concepts": [{"headline", "power", "subtitle", "scene"} x3], "prop": string}.',
  ].join("\n");
}

function validSubtitle(s, stat) {
  const t = clean(s).toUpperCase();
  const n = t.split(" ").filter(Boolean).length;
  if (!t || n > 5 || t.length > 30) return null;
  const digits = t.replace(/[^0-9]/g, "");
  if (digits && (!stat || !String(stat.text).replace(/[^0-9]/g, "").includes(digits))) return null;
  if (/\b(TONIGHT|TODAY|TOMORROW|THIS (WEEK|MONTH|YEAR)|NOW|BREAKING|LIVE)\b/.test(t)) return null; // invented urgency
  return t;
}

/** 3 validated concepts (deterministic fallbacks fill the gaps) + a prop */
/** one compact object, nothing under or around it (a cut-out of "X resting on Y" swallows the frame) */
function propText(p) {
  const t = clean(p).replace(/\s*,.*$/, "").replace(/\s+(resting|lying|sitting|placed|standing|hanging|set|on top of|on a|on an|on the|against|over|under|beside|next to|in front of)\b.*$/i, "");
  return t.length >= 4 ? t : "a cracked empty piggy bank";
}

async function makeConcepts(o, stat, person, place = null) {
  const fb = TH.fallbackTitle(o);
  const fbSub = stat ? validSubtitle(`${stat.text}${stat.label ? " " + stat.label : ""}`, stat) : null;
  let raw = null;
  if (o.ask) {
    try {
      raw = await o.ask(conceptPrompt({ ...o, stat, person, place }));
    } catch (err) {
      (o.log || (() => {}))(`thumbnail: concepts unavailable (${String(err.message).slice(0, 120)})`);
    }
  }
  const list = (raw && Array.isArray(raw.concepts) ? raw.concepts : []).slice(0, 3);
  const out = [];
  for (let i = 0; i < 3; i++) {
    const c = list[i] || {};
    const text = TH.validTitle(c.headline);
    const words = text ? text.split(" ") : null;
    const pw = words && words.find((w) => bare(w) === bare(c.power));
    out.push({
      text: text || fb.text,
      highlight: text ? pw || words[words.length - 1] : fb.highlight,
      subtitle: validSubtitle(c.subtitle, stat) || fbSub,
      scene: clean(c.scene) || FALLBACK_SCENES[i],
      source: text ? "gemini" : "deterministic",
    });
  }
  const prop = propText(raw && raw.prop);
  return { concepts: out, prop };
}

// ------------------------------------------------------------------------------ assets

const BG_FRAMING = "no people, wide cinematic 16:9 frame, main subject on the right half, slightly darker left third with calm negative space, dramatic dusk or golden-hour light, rich contrast but well exposed (not pitch dark), teal and amber colour grade";

async function background(scene, id, ctx) {
  const run = (s) => fal.generateVetted({ prompt: s, mood: "dramatic", framing: BG_FRAMING, slotId: `thumb-bg-${id}`, outDir: ctx.workDir, task: "longform.thumbnail.bg" }, { gemini: ctx.gemini, retries: 1, log: ctx.log, tolerate: ["off-intent", "low confidence", "subject incidental"], keepLast: true });
  let r = null;
  try {
    r = await run(scene);
  } catch (err) {
    ctx.log(`thumbnail ${id}: background "${scene.slice(0, 60)}" failed (${String(err.message).slice(0, 100)})`);
  }
  if (!r) r = await run(ctx.place ? `the skyline of the capital of ${ctx.place.name} at dusk, seen from across the water` : FALLBACK_SCENES["abc".indexOf(id)] || FALLBACK_SCENES[0]);
  if (!r) throw new Error(`no usable background for variant ${id}`);
  if (ctx.add) ctx.add(r.totalCost || r.cost || 0);
  else ctx.cost += r.totalCost || r.cost || 0;
  return r;
}

async function propCutout(prop, ctx) {
  const scene = `${prop}, a single object alone on a plain dark charcoal studio backdrop, product photography, soft key light from the left, the whole object in frame and centred`;
  const r = await fal.generateVetted({ prompt: scene, mood: "dramatic", slotId: "thumb-prop", outDir: ctx.workDir, task: "longform.thumbnail.prop" }, { gemini: ctx.gemini, retries: 1, log: ctx.log, tolerate: ["low confidence"] });
  if (!r) return null;
  ctx.cost += r.totalCost || 0;
  const cut = await fal.removeBackground({ file: r.file, outDir: ctx.workDir, name: "thumb-prop.cutout", variant: "General Use (Heavy)" });
  ctx.cost += cut.cost;
  const bb = alphaBox(cut.file);
  if (!bb) return null;
  return { file: cut.file, ...bb, prompt: r.prompt, model: r.model };
}

/** bounding box of the opaque pixels of a PNG (px) + its size, via ffmpeg's alpha plane at 1/4 scale */
function alphaBox(file) {
  const info = sniffImage(fs.readFileSync(file));
  if (!info || !info.width) return null;
  const sw = Math.max(8, Math.round(info.width / 4));
  const sh = Math.max(8, Math.round(info.height / 4));
  const r = spawnSync(process.env.FFMPEG || "ffmpeg", ["-v", "error", "-i", file, "-vf", `format=rgba,alphaextract,scale=${sw}:${sh}`, "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout || r.stdout.length < sw * sh) return null;
  let x0 = sw, y0 = sh, x1 = -1, y1 = -1;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (r.stdout[y * sw + x] > 96) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const k = info.width / sw;
  return { width: info.width, height: info.height, box: [x0 * k, y0 * k, (x1 - x0 + 1) * k, (y1 - y0 + 1) * k].map((n) => Math.round(n)) };
}

// ------------------------------------------------------------------------------ layout

function fontFaces() {
  const dir = path.join(REPO, ".agents", "skills", "embedded-captions", "modes", "standard", "fonts", "files");
  const css = [];
  const anton = path.join(dir, "anton-latin-400-normal.woff2"); // Anton, SIL OFL 1.1 (Google Fonts)
  if (fs.existsSync(anton)) css.push(`@font-face{font-family:'AntonThumb';src:url(data:font/woff2;base64,${fs.readFileSync(anton).toString("base64")}) format('woff2');}`);
  const inter = path.join(dir, "inter-latin-900-normal.woff2");
  css.push(`@font-face{font-family:'InterThumb';font-weight:900;src:local('Inter Black'),local('Inter-Black')${fs.existsSync(inter) ? `,url(data:font/woff2;base64,${fs.readFileSync(inter).toString("base64")}) format('woff2')` : ""};}`);
  return css.join("\n");
}

const CSS = `*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#07090c}
body{-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
.stage{position:absolute;inset:0;overflow:hidden;background:#07090c}
.bg{position:absolute;left:-2%;top:-2%;width:104%;height:104%;object-fit:cover}
.shade{position:absolute;inset:0;pointer-events:none}
.cut{position:absolute;display:block}
.subject{position:absolute;pointer-events:none}
.head{font-family:'AntonThumb','Anton','Impact',sans-serif;font-weight:400;text-transform:uppercase;line-height:.94;letter-spacing:.01em;color:#fff;-webkit-text-stroke:9px ${C.ink};paint-order:stroke fill;filter:drop-shadow(0 8px 14px rgba(0,0,0,.65))}
.head .y{color:${C.yellow}}
.head .chip{display:inline-block;background:${C.red};color:#fff;-webkit-text-stroke:0;padding:.02em .1em 0;margin:.04em 0;transform:rotate(-2deg);box-shadow:0 7px 0 rgba(0,0,0,.55)}
.strip{display:inline-block;font-family:'InterThumb','Inter','Arial Black',sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:.03em;line-height:1;padding:10px 18px 9px;white-space:nowrap}`;

const RIM = (warm) =>
  `contrast(1.12) saturate(1.05) brightness(1.03) drop-shadow(-2px -2px 2px ${warm ? "rgba(255,214,160,.8)" : "rgba(190,225,255,.8)"}) drop-shadow(0 0 14px ${warm ? "rgba(255,165,80,.6)" : "rgba(120,190,255,.55)"}) drop-shadow(26px 30px 38px rgba(0,0,0,.9))`;

/** face cut-out placement: face box height `fh` px, face centre at cx, face top at top */
function placeFace(face, { fh, cx, top }) {
  const [fx, fy, fw, fhh] = face.faceBox;
  const s = Math.min(fh / fhh, 4.5);
  const left = cx - (fx + fw / 2) * s;
  const t = top - fy * s;
  const r = (n) => Math.round(n);
  return { img: { left: r(left), top: r(t), width: r(face.width * s), height: r(face.height * s) }, face: { x: r(left + fx * s), y: r(t + fy * s), w: r(fw * s), h: r(fhh * s) }, scale: s };
}

/** prop cut-out placement: opaque box height `h` px, centred at (cx, cy) */
function placeProp(prop, { h, cx, cy, maxW = 520 }) {
  const [bx, by, bw, bh] = prop.box;
  const s = Math.min(h / bh, maxW / bw); // wide objects are limited by width so they never swallow the frame
  const r = (n) => Math.round(n);
  const left = cx - (bx + bw / 2) * s;
  const top = cy - (by + bh / 2) * s;
  return { img: { left: r(left), top: r(top), width: r(prop.width * s), height: r(prop.height * s) }, box: { x: r(left + bx * s), y: r(top + by * s), w: r(bw * s), h: r(bh * s) } };
}

function headlineHtml(c, style) {
  const words = c.text.split(" ");
  const cut = words.length <= 2 ? 1 : words.length === 3 ? (words[2].length >= words[0].length + words[1].length ? 2 : 1) : 2;
  return words
    .map((w, i) => {
      const inner = w === c.highlight ? (style === "chip" ? `<span class="chip">${esc(w)}</span>` : `<span class="y">${esc(w)}</span>`) : esc(w);
      return (i === cut ? "<br>" : i ? " " : "") + inner;
    })
    .join("");
}

const STRIP = {
  red: `background:${C.red};color:#fff`,
  ink: `background:${C.ink};color:#fff;border-left:8px solid ${C.yellow}`,
  yellow: `background:${C.yellow};color:${C.ink}`,
};

/**
 * One variant's HTML.
 * spec: {bg, concept, hero: "face"|"prop", face?, prop?, faceAt?, propAt?, headStyle: "yellow"|"chip", strip, warm, smallProp?}
 */
function buildVariant(spec) {
  const parts = [];
  let faceBox = null;
  let heroLeft = W;
  // exposure lifted so the thumbnail still reads on the dark YouTube feed; the left side stays darker for the headline
  parts.push(`<img class="bg" src="${spec.bgUri}" style="filter:brightness(.8) contrast(1.16) saturate(1.14)">`);
  parts.push(`<div class="shade" style="background:linear-gradient(90deg,rgba(3,5,8,.84) 0%,rgba(3,5,8,.6) 34%,rgba(3,5,8,.1) 62%,rgba(3,5,8,0) 78%)"></div>`);
  parts.push(`<div class="shade" style="background:radial-gradient(ellipse 80% 90% at 62% 45%,rgba(0,0,0,0) 60%,rgba(0,0,0,.42) 100%)"></div>`);
  if (spec.place) {
    // place cue 1: a soft light in the flag colours from the top right
    const [c1, c2, c3] = spec.place.colors;
    const a = (hex, al) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${al})`;
    parts.push(`<div class="shade" style="background:radial-gradient(ellipse 55% 60% at 88% 8%,${a(c1 === "#ffffff" ? c2 : c1, 0.3)},rgba(0,0,0,0) 100%),radial-gradient(ellipse 45% 50% at 96% 96%,${a(c3 === "#ffffff" ? c2 : c3, 0.2)},rgba(0,0,0,0) 100%);mix-blend-mode:screen"></div>`);
  }
  let outlineBox = null;
  if (spec.place && spec.outlineAt) {
    // place cue 2: the glowing country outline (behind the hero, or as the hero)
    const o = outlineSvg(spec.place, spec.outlineAt);
    if (o) {
      parts.push(o.svg);
      outlineBox = o.box;
    }
  }
  if (spec.hero === "face" && spec.face) {
    const p = placeFace(spec.face, spec.faceAt);
    faceBox = p.face;
    heroLeft = p.face.x;
    const gx = p.face.x + p.face.w / 2;
    const gy = p.face.y + p.face.h / 2;
    const gr = p.face.h * 1.6;
    parts.push(`<div class="shade" style="background:radial-gradient(circle ${Math.round(gr)}px at ${Math.round(gx)}px ${Math.round(gy)}px,${spec.warm ? "rgba(255,140,50,.42)" : "rgba(70,150,255,.38)"},rgba(0,0,0,0) 100%)"></div>`);
    parts.push(`<img class="cut" src="${spec.faceUri}" style="left:${p.img.left}px;top:${p.img.top}px;width:${p.img.width}px;height:${p.img.height}px;filter:${RIM(spec.warm)};-webkit-mask-image:linear-gradient(180deg,#000 80%,rgba(0,0,0,0) 99%)">`);
  }
  if (spec.hero === "outline" && outlineBox) heroLeft = outlineBox.x;
  if (spec.prop && (spec.hero === "prop" || spec.smallProp)) {
    const at = spec.hero === "prop" ? spec.propAt : spec.smallProp;
    const p = placeProp(spec.prop, at);
    if (spec.hero === "prop") heroLeft = p.box.x;
    parts.push(`<img class="cut" src="${spec.propUri}" style="left:${p.img.left}px;top:${p.img.top}px;width:${p.img.width}px;height:${p.img.height}px;transform:rotate(${at.rot || 0}deg);filter:${RIM(spec.warm)}">`);
  }
  parts.push(`<div class="shade" style="background:linear-gradient(0deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,0) 22%)"></div>`);
  if (faceBox) parts.push(`<div class="subject" data-subject style="left:${faceBox.x}px;top:${faceBox.y}px;width:${faceBox.w}px;height:${faceBox.h}px"></div>`);
  const textW = Math.max(420, Math.min(760, heroLeft - 56 - 36));
  const c = spec.concept;
  parts.push(`<div style="position:absolute;left:56px;top:0;bottom:0;width:${textW}px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:40px 0">
  <div data-text data-fit data-max="190" class="head" style="width:100%;font-size:190px">${headlineHtml(c, spec.headStyle)}</div>
  ${c.subtitle ? `<div data-text data-secondary data-fit data-max="42" class="strip" style="margin-top:24px;font-size:42px;max-width:100%;${STRIP[spec.strip] || STRIP.red}">${esc(c.subtitle)}</div>` : ""}
</div>`);
  return { html: `<div class="stage">${parts.join("\n")}</div>`, faceBox };
}

// ------------------------------------------------------------------------------ render + checks

const FIT_JS = `(async () => {
  await document.fonts.ready;
  for (const el of document.querySelectorAll('[data-fit]')) {
    let fs = Number(el.dataset.max) || parseFloat(getComputedStyle(el).fontSize);
    const parent = el.parentElement;
    const tooBig = () => el.scrollWidth > el.clientWidth + 1 || [...el.querySelectorAll('span')].some(s => s.getBoundingClientRect().right > el.getBoundingClientRect().right + 1) || parent.scrollHeight > parent.clientHeight + 1;
    el.style.fontSize = fs + 'px';
    while (tooBig() && fs > 30) { fs -= 2; el.style.fontSize = fs + 'px'; }
  }
  return true;
})()`;

const MEASURE_JS = `(() => {
  const rects = [...document.querySelectorAll('[data-text]')].map(el => {
    const cs = getComputedStyle(el);
    const range = document.createRange(); range.selectNodeContents(el);
    const lines = [...range.getClientRects()].filter(q => q.width > 4 && q.height > 4).map(q => ({ x: q.x, y: q.y, w: q.width, h: q.height }));
    const spans = [...el.querySelectorAll('span')].map(s => { const c = getComputedStyle(s); return { color: c.color, fontSize: parseFloat(c.fontSize), stroke: parseFloat(c.webkitTextStrokeWidth) || 0, strokeColor: c.webkitTextStrokeColor, bg: c.backgroundColor }; });
    return { text: el.innerText.replace(/\\s+/g, ' ').trim(), secondary: el.hasAttribute('data-secondary'), fontSize: parseFloat(cs.fontSize), color: cs.color, stroke: parseFloat(cs.webkitTextStrokeWidth) || 0, strokeColor: cs.webkitTextStrokeColor, bg: cs.backgroundColor, spans, lines };
  });
  const s = document.querySelector('[data-subject]');
  const sr = s ? s.getBoundingClientRect() : null;
  return { rects, subject: sr ? { x: sr.x, y: sr.y, w: sr.width, h: sr.height } : null };
})()`;

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
  const s = document.createElement('canvas'); s.width = ${SMALL.w}; s.height = ${SMALL.h};
  const sg = s.getContext('2d'); sg.imageSmoothingQuality = 'high'; sg.drawImage(full, 0, 0, ${SMALL.w}, ${SMALL.h});
  return { lum: out, preview: s.toDataURL('image/png') };
})()`;

/** worst-case contrast of one text element: fill vs the pixels behind it, or vs its own outline / chip */
function textContrast(r, lums) {
  const { rgbLum, ratio } = TH;
  const parts = [{ color: r.color, stroke: r.stroke, strokeColor: r.strokeColor, bg: r.bg }, ...r.spans];
  let worst = Infinity;
  for (const p of parts) {
    const tl = rgbLum(p.color);
    // against the background pixels closest to the text colour (light text: the brightest 10%)
    const best = lums.length ? Math.min(...lums.map((l) => ratio(tl, tl > l.p50 ? l.p90 : l.p10))) : 0;
    const own = /rgba?\(/.test(p.bg || "") && !/,\s*0\)$/.test(p.bg) ? ratio(tl, rgbLum(p.bg)) : 0; // chip / strip background
    const outline = p.stroke >= 4 ? ratio(tl, rgbLum(p.strokeColor)) : 0;
    worst = Math.min(worst, Math.max(best, own, outline));
  }
  return worst;
}

async function renderVariant(page, { html, workDir, id, file }) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces()}\n${CSS}</style></head><body>${html}</body></html>`;
  if (process.env.THUMB_DEBUG) fs.writeFileSync(path.join(workDir, `thumbnail-${id}.html`), doc);
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.setContent(doc, { waitUntil: "load" });
  await page.evaluate(FIT_JS);
  const m = await page.evaluate(MEASURE_JS);
  const full = Buffer.from(await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } }));
  fs.writeFileSync(file, full);
  await page.addStyleTag({ content: "[data-text],[data-text] *{color:transparent!important;-webkit-text-stroke-color:transparent!important;text-shadow:none!important}.head{filter:none!important}" });
  const bg = Buffer.from(await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } }));
  const boxes = m.rects.flatMap((r, i) => r.lines.map((l) => ({ ...l, i })));
  const s = await page.evaluate(SAMPLE_JS(`data:image/png;base64,${bg.toString("base64")}`, `data:image/png;base64,${full.toString("base64")}`, boxes));
  const small = Buffer.from(s.preview.split(",")[1], "base64");
  const smallFile = path.join(workDir, `thumbnail-${id}-${SMALL.w}x${SMALL.h}.png`);
  fs.writeFileSync(smallFile, small);
  const texts = m.rects.map((r, i) => {
    const lums = s.lum.filter((_, k) => boxes[k].i === i);
    const minFont = Math.min(r.fontSize, ...r.spans.map((x) => x.fontSize));
    const subjOverlap = m.subject ? r.lines.reduce((a, l) => a + TH.overlap(l, m.subject), 0) / Math.max(1, m.subject.w * m.subject.h) : 0;
    return { text: r.text, secondary: r.secondary, fontPx: Math.round(minFont), atSmallPx: Number(((minFont * SMALL.w) / W).toFixed(1)), contrast: Number(textContrast(r, lums).toFixed(2)), subjectOverlap: Number(subjOverlap.toFixed(3)) };
  });
  let bytes = fs.statSync(file).size;
  let quantized = false;
  if (bytes >= MAX_BYTES) {
    bytes = TH.shrinkPng(file);
    quantized = true;
  }
  return { texts, subject: m.subject, bytes, quantized, small, smallFile };
}

function checksFor(r, hasFace) {
  const heads = r.texts.filter((t) => !t.secondary);
  const secs = r.texts.filter((t) => t.secondary);
  return {
    size: { ok: r.bytes < MAX_BYTES, bytes: r.bytes, quantized: r.quantized },
    legibleSmall: { ok: heads.every((t) => t.fontPx >= MIN_HEAD) && secs.every((t) => t.fontPx >= MIN_SECONDARY), headlinePx: Math.min(...heads.map((t) => t.fontPx)), headlineAtSmallPx: Math.min(...heads.map((t) => t.atSmallPx)), at: `${SMALL.w}x${SMALL.h}` },
    contrast: { ok: r.texts.every((t) => t.contrast >= MIN_CONTRAST), min: Math.min(...r.texts.map((t) => t.contrast)), band: `>= ${MIN_CONTRAST}:1` },
    faceClear: { ok: !hasFace || r.texts.every((t) => t.subjectOverlap <= 0.02), maxOverlap: Math.max(0, ...r.texts.map((t) => t.subjectOverlap)), hard: hasFace },
  };
}

// ------------------------------------------------------------------------------ vision scorer

async function scoreVariants(gemini, variants, o) {
  const images = [];
  for (const v of variants) {
    images.push({ label: `Thumbnail #${images.length / 2 + 1} (full size)`, mime: "image/jpeg", data: await thumbJpeg(fs.readFileSync(v.abs), 640) });
    images.push({ label: `Thumbnail #${(images.length - 1) / 2 + 1} as seen in the feed (${SMALL.w}x${SMALL.h})`, mime: "image/png", data: v.small });
  }
  const prompt = `You judge ${variants.length} YouTube thumbnails for the same finance explainer ("${clean(o.outline && o.outline.title)}"). Each comes at full size and at feed size (${SMALL.w}x${SMALL.h}).
Score each 0-10 for click-through potential: the headline is readable at feed size, one clear focal point, emotional punch, the story is clear, and it looks like a professional documentary thumbnail. Penalise: text over a face, unreadable or cramped text, a distorted or cut-off face, visible AI artefacts, garbled lettering in the background, clutter.
Return JSON {"results": [{"i": thumbnail number, "score": 0-10, "readableSmall": true|false, "issues": "max 15 words"}]}.`;
  const raw = await gemini.json(prompt, { images, task: "longform.thumbnail", temperature: 0 });
  const res = (raw && raw.results) || [];
  return variants.map((_, k) => {
    const r = res.find((x) => Number(x.i) === k + 1) || {};
    return { score: Number.isFinite(Number(r.score)) ? Number(r.score) : null, readableSmall: r.readableSmall !== false, issues: clean(r.issues).slice(0, 120) };
  });
}

// ------------------------------------------------------------------------------ main

/**
 * @param {{finalDir, workDir, outline, dossier, topic, ask, gemini?, log?, browser?, facePerson?: string|null}} o
 */
async function makeThumbnailsV2(o) {
  const log = o.log || (() => {});
  const gemini = o.gemini || require("../media/gemini").createGemini({ log });
  const ctx = { workDir: o.workDir, gemini, log, cost: 0 };
  fs.mkdirSync(o.finalDir, { recursive: true });
  fs.mkdirSync(o.workDir, { recursive: true });

  const stat = TH.pickStat(o);
  const person = mainPerson(o);
  const place = placeOf(o);
  // concepts are cached per input so a re-render reuses them (and so hits the fal image cache)
  const conceptKey = require("crypto").createHash("sha256").update(JSON.stringify([VERSION, o.outline && o.outline.title, o.dossier && o.dossier.angle, o.topic, stat && stat.text, person, place && place.iso])).digest("hex").slice(0, 16);
  const conceptFile = path.join(o.workDir, "concepts.json");
  let cached = null;
  try {
    cached = JSON.parse(fs.readFileSync(conceptFile, "utf-8"));
  } catch (_) {}
  const { concepts, prop: rawProp } = cached && cached.key === conceptKey && !process.env.THUMB_NEW_CONCEPTS ? cached : await makeConcepts(o, stat, person, place);
  const propName = propText(rawProp);
  for (const c of concepts) if (c.subtitle && !validSubtitle(c.subtitle, stat)) c.subtitle = validSubtitle(stat ? `${stat.text}${stat.label ? " " + stat.label : ""}` : "", stat);
  fs.writeFileSync(conceptFile, JSON.stringify({ key: conceptKey, concepts, prop: propName }, null, 1));
  log(`thumbnail v2: person ${person || "none"}; place ${place ? place.name : "none"}; headlines ${concepts.map((c) => `"${c.text}"`).join(", ")}; prop "${propName}"`);

  let face = null;
  if (person) {
    try {
      face = await require("./thumbFace").findFace({ name: person, workDir: path.join(o.workDir, "face"), gemini, log });
      if (face) ctx.cost += face.cost || 0;
    } catch (err) {
      log(`thumbnail v2: face search failed (${String(err.message).slice(0, 120)}); prop hero`);
    }
  }
  const bgs = [];
  for (const [k, id] of ["a", "b", "c"].entries()) bgs.push(await background(concepts[k].scene, id, { ...ctx, place, add: (c) => (ctx.cost += c) }));
  let prop = null;
  try {
    prop = await propCutout(propName, ctx);
  } catch (err) {
    log(`thumbnail v2: prop failed (${String(err.message).slice(0, 120)})`);
  }
  if (!face && !prop && !place) throw new Error("no hero: neither a licensed face, a prop cut-out nor a country outline");

  const uri = (f) => TH.dataUri(f);
  const faceUri = face ? uri(face.file) : null;
  const propUri = prop ? uri(prop.file) : null;
  // hero per variant: the face when a good licensed one exists; otherwise the prop (a, c) and the glowing
  // country outline (b). Every variant carries a place cue when the story has a country: the outline
  // (halo behind the hero, the hero itself, or a corner badge), the flag-colour light and the landmark background.
  const heroA = face ? "face" : prop ? "prop" : "outline";
  const heroB = face ? "face" : place ? "outline" : "prop";
  const heroC = prop ? "prop" : face ? "face" : "outline";
  const specs = {
    a: { concept: concepts[0], hero: heroA, faceAt: { fh: 320, cx: W * 0.75, top: 92 }, propAt: { h: 450, cx: W * 0.75, cy: H * 0.54, rot: -6 }, outlineAt: { h: 640, cx: W * 0.75, cy: H * 0.5, mode: heroA === "outline" ? "hero" : "halo" }, headStyle: "yellow", strip: "red", warm: true },
    b: { concept: concepts[1], hero: heroB, faceAt: { fh: 380, cx: W * 0.72, top: 70 }, propAt: { h: 540, cx: W * 0.7, cy: H * 0.55, rot: 8 }, outlineAt: heroB === "outline" ? { h: 660, cx: W * 0.74, cy: H * 0.5, mode: "hero" } : { h: 300, cx: W * 0.9, cy: H * 0.26, mode: "badge" }, smallProp: prop && heroB !== "prop" ? { h: 230, maxW: 330, cx: W * 0.86, cy: H * 0.8, rot: -12 } : null, headStyle: "chip", strip: "ink", warm: false },
    c: { concept: concepts[2], hero: heroC, faceAt: { fh: 300, cx: W * 0.76, top: 110 }, propAt: { h: 470, cx: W * 0.74, cy: H * 0.56, rot: -4 }, outlineAt: { h: 250, cx: W * 0.93, cy: H * 0.22, mode: "badge" }, headStyle: "yellow", strip: "yellow", warm: true },
  };
  if (!place) for (const sp of Object.values(specs)) delete sp.outlineAt;
  const ownBrowser = !o.browser;
  const browser = o.browser || (await TH.launchBrowser());
  const variants = [];
  try {
    const page = await browser.newPage();
    for (const [k, id] of ["a", "b", "c"].entries()) {
      const sp = { ...specs[id], face, prop, place, faceUri, propUri, bgUri: uri(bgs[k].file) };
      const { html, faceBox } = buildVariant(sp);
      const file = path.join(o.finalDir, `thumbnail-${id}.png`);
      const r = await renderVariant(page, { html, workDir: o.workDir, id, file });
      const checks = checksFor(r, !!faceBox);
      const ok = Object.values(checks).every((c) => c.ok);
      variants.push({
        id,
        file: `thumbnail-${id}.png`,
        abs: file,
        small: r.small,
        layout: `v2 ${sp.hero} hero, ${sp.headStyle} power word, ${sp.strip} strip`,
        ok,
        checks,
        texts: r.texts,
        concept: sp.concept,
        asset: {
          slot: `thumb-bg-${id}`,
          background: { file: path.relative(o.finalDir, bgs[k].file).split(path.sep).join("/"), model: bgs[k].model, prompt: bgs[k].prompt, credit: "AI-generated image" },
          face: sp.hero === "face" && face ? { credit: face.credit, creditFull: face.creditFull, licence: face.licence, licenceUrl: face.licenceUrl, pageUrl: face.pageUrl, edits: face.edits } : null,
          prop: (sp.hero === "prop" || sp.smallProp) && prop ? { credit: "AI-generated image", model: prop.model } : null,
        },
      });
      log(`thumbnail ${id}: ${ok ? "ok" : "CHECK FAIL"} ${(r.bytes / 1024).toFixed(0)} KB, headline ${checks.legibleSmall.headlinePx}px (${checks.legibleSmall.headlineAtSmallPx}px at ${SMALL.w}), min contrast ${checks.contrast.min}:1, face overlap ${checks.faceClear.maxOverlap}`);
    }
    await page.close();
  } finally {
    if (ownBrowser) await browser.close();
  }

  let scores = null;
  try {
    scores = await scoreVariants(gemini, variants, o);
    scores.forEach((s, k) => Object.assign(variants[k], { vision: s }));
    log(`thumbnail v2: vision scores ${scores.map((s, k) => `${variants[k].id}=${s.score}`).join(", ")}`);
  } catch (err) {
    log(`thumbnail v2: vision scorer unavailable (${String(err.message).slice(0, 120)})`);
  }
  const order = variants.slice().sort((a, b) => (b.ok - a.ok) || ((b.vision && b.vision.score) || 0) - ((a.vision && a.vision.score) || 0));
  const best = order[0];
  const credits = [];
  if (face && variants.some((v) => v.asset.face)) credits.push(`Thumbnail photo: ${face.creditFull} (${face.edits})`);
  credits.push("Thumbnail backgrounds and props: AI-generated images (fal.ai) of generic scenes.");
  return {
    version: VERSION,
    size: `${W}x${H}`,
    title: { text: best.concept.text, highlight: best.concept.highlight, source: best.concept.source },
    stat,
    concepts,
    person: person || null,
    face: face ? { credit: face.credit, licence: face.licence, pageUrl: face.pageUrl, facePx: face.facePx } : null,
    prop: prop ? { text: propName, model: prop.model } : null,
    recommended: best.file,
    ok: variants.every((v) => v.ok),
    variants: variants.map(({ abs, small, ...v }) => v),
    credits,
    aiGenerated: true,
    cost: Math.round(ctx.cost * 10000) / 10000,
    note: "Backgrounds/props are AI-generated generic scenes; any face is a licensed real photo (credit above, also for the description).",
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { makeThumbnailsV2, placeOf, outlineSvg, FLAG, makeConcepts, validSubtitle, mainPerson, placeFace, placeProp, headlineHtml, buildVariant, checksFor, textContrast, alphaBox, conceptPrompt, VERSION };
