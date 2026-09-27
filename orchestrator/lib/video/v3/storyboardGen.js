"use strict";

/**
 * storyboard.v3 generator: topic -> Gemini (JSON mode) -> validate (schema + catalog + real
 * compiler on synthetic timings + cadence bands) -> bounded repair loop.
 * The style grammar in the prompt is the measured DH profile (analysis/.../design/SPEC.md 7.x).
 */

const fs = require("fs");
const path = require("path");
const { compileStoryboard, TEMPLATES } = require("./compile");
const { MODULES, HUD, TEMPLATES: TEMPLATE_DOCS, TONES, ICONS, knownOps } = require("./catalog");
const { NARRATIVE_GUIDE, narrativeProblems } = require("./narrativeGuide");

const FIX = path.join(__dirname, "..", "..", "..", "fixtures", "v3");
const EXAMPLE_PATH = path.join(FIX, "cdn-dh.json");

// Per-profile grammar (SPEC.md 1.2/1.3, 7.1): DH = dark HUD/persistent (R1/R2), LC = light
// scene-cut (R3/R4). Bands are for the synthetic timeline, slightly tighter than the render gates.
const PROFILES = {
  DH: { example: EXAMPLE_PATH, templates: ["opener", "stack", "hero"], bpm: [62, 100], maxGap: 3.3, lifeMedian: [2.0, 6.0], nodeX: [0.1, 0.9], forbiddenOps: [] },
  DC: { example: path.join(FIX, "k8s-dc.json"), templates: ["sub"], bpm: [58, 100], maxGap: 3.0, lifeMedian: [1.8, 4.6], nodeX: [0.14, 0.86], forbiddenOps: ["count", "slam"] },
  LC: { example: path.join(FIX, "oauth-lc.json"), templates: ["scene"], bpm: [48, 95], maxGap: 4.2, lifeMedian: [3.0, 7.0], nodeX: [0.2, 0.8], forbiddenOps: ["strike", "rowStrike", "count", "slam"] },
  // BR light brutalist (R7): 62.8 beats/min, scene median 3.53 s, longest hold 3.43 s, 204 wpm
  BR: { example: path.join(FIX, "decisions-br.json"), templates: ["brStack", "brGrid", "brMedia", "brSummary", "brBand"], bpm: [56, 80], maxGap: 3.3, lifeMedian: [2.5, 5.0], nodeX: [0.15, 0.85], forbiddenOps: ["count", "retype"] },
  // BP light blueprint (R6): 52 beats/min (45-65), scene median 3.67 s, longest hold 3.73 s, 196 wpm
  BP: { example: path.join(FIX, "chat-bp.json"), templates: ["bpScene", "bpHost"], bpm: [48, 67], maxGap: 3.5, lifeMedian: [2.5, 5.0], nodeX: [0.15, 0.85], forbiddenOps: ["retype"] },
  // LF 16:9 long-form chapters (plan §6, provisional): a visual change every <= 5 s, scene life 6-10 s, 18-35 beats/min.
  // LF storyboards are written per chapter by lib/longform (P6), not by this 9:16 generator.
  LF: { example: path.join(FIX, "lf-pilot.json"), templates: ["lfCold", "lfStage", "lfSplit", "lfFull", "lfChart", "lfNumber", "lfCompare", "lfTimeline", "lfMap", "lfHeadline", "lfChapter", "lfJoke", "lfRecap", "lfEnd", "lfQuote", "lfFeature", "lfDuo", "lfFlash", "free"], bpm: [18, 40], maxGap: 5.0, lifeMedian: [5.0, 10.0], nodeX: [0.1, 0.9], forbiddenOps: ["retype", "slam"], syn: { word: 0.36, gap: 0.35 } },
};

// synthetic pacing that approximates the delivered pace (215 wpm incl. 0.2 s sentence gaps)
const SYN = { word: 0.255, gap: 0.2 };
// cadence bands on the synthetic timeline (a little tighter than the render gates)
const BANDS = { bpm: [62, 100], maxGap: 3.3, lifeMedian: [2.0, 6.0], words: [120, 200], sentences: [9, 16] };

function tokens(t) {
  return String(t).split(/\s+/).filter(Boolean);
}

// Real-DOM layout audit (tools/layout_audit.js) on synthetic timings: overlapping cards, text off
// the frame / out of its card / under the presenter, and renderer build errors, fed back to the model.
async function layoutProblems(sb, opts, log) {
  if (opts.layoutAudit === false) return [];
  try {
    const { auditLayout, describe } = require("../../../tools/layout_audit");
    const tl = syntheticTimeline(sb);
    const spec = compileStoryboard(sb, tl, { mascot: true });
    const r = await auditLayout({ spec, duration: tl.totalSeconds, log });
    return r.problems.map((p) => "layout " + describe(p)).concat(r.buildProblems.map((p) => "renderer: " + p));
  } catch (err) {
    log(`  (layout audit skipped: ${err.message})`);
    return [];
  }
}

function syntheticTimeline(sb, syn = SYN) {
  let t = 0.12;
  const words = [];
  const sentenceTimes = sb.sentences.map((s) => {
    const start = t;
    tokens(s.text).forEach((w, wi) => {
      words.push({ i: words.length, sentenceId: s.id, wi, text: w, start: +t.toFixed(3), end: +(t + syn.word - 0.03).toFixed(3) });
      t += syn.word;
    });
    const st = { id: s.id, start: +(start - 0.06).toFixed(3), end: +t.toFixed(3) };
    t += s.pauseAfter !== undefined ? Number(s.pauseAfter) : syn.gap;
    return st;
  });
  return { words, sentenceTimes, totalSeconds: +(t + 0.4).toFixed(3) };
}

function beats(spec) {
  const t = [];
  spec.scaffolds.forEach((s) => {
    t.push(s.t0);
    s.modules.forEach((m) => {
      if (m.at) t.push(s.t0 + m.at);
      ((m.props && m.props.lineAt) || []).forEach((la) => la > 0 && t.push(s.t0 + (m.at || 0) + la));
    });
  });
  spec.events.forEach((e) => t.push(e.t));
  return [...new Set(t.map((x) => Math.round(x * 100) / 100))].sort((a, b) => a - b);
}

function wordBand(lengthSeconds) {
  // 215 wpm delivered (refs 176-221) incl. sentence gaps; +-15 %
  const n = ((lengthSeconds || 45) * 205) / 60;
  return [Math.round(n * 0.85), Math.round(n * 1.15)];
}

/** @returns {string[]} problems (empty = valid) */
function validate(sb, opts = {}) {
  const WORDS = wordBand(opts.lengthSeconds);
  const P = [];
  if (!sb || typeof sb !== "object") return ["output is not a JSON object"];
  if (sb.version !== "storyboard.v3") P.push('version must be "storyboard.v3"');
  if (!Array.isArray(sb.sentences) || !sb.sentences.length) return P.concat(["sentences[] missing"]);
  if (sb.profile === "LF") return P.concat(validateLF(sb));
  const ids = new Set();
  let nWords = 0;
  sb.sentences.forEach((s, i) => {
    if (!s.id || ids.has(s.id)) P.push(`sentence[${i}] needs a unique id`);
    ids.add(s.id);
    const n = tokens(s.text).length;
    nWords += n;
    if (n > 24) P.push(`sentence ${s.id} has ${n} words (max 24)`);
    // IDs / keys / hashes read aloud ("H three M two", "IDEMP seventy seven") -- refs never do this
    if (/\b[A-Z]{2,}[a-z]*\s+(zero|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b|\b[A-Z]\s+(zero|one|two|three|four|five|six|seven|eight|nine)\s+[A-Z]\b/.test(s.text)) P.push(`sentence ${s.id} reads an ID/key/code aloud; say what it is instead ("a unique key"), the visual shows the actual value`);
    if (/\d/.test(s.text)) P.push(`sentence ${s.id} contains digits; spell numbers out as spoken words (the visuals carry the digits)`);
  });
  if (nWords < WORDS[0] || nWords > WORDS[1]) P.push(`total narration is ${nWords} words; target ${WORDS[0]}-${WORDS[1]} (${opts.lengthSeconds || 45} s at ~215 wpm)`);
  if (sb.sentences.length < BANDS.sentences[0] || sb.sentences.length > BANDS.sentences[1]) P.push(`${sb.sentences.length} sentences; use ${BANDS.sentences[0]}-${BANDS.sentences[1]}`);
  P.push(...narrativeProblems(sb.sentences));
  if (!Array.isArray(sb.scaffolds) || !sb.scaffolds.length) return P.concat(["scaffolds[] missing"]);
  const PR = PROFILES[sb.profile] || PROFILES.DH;
  const genericOnly = new Set(PR.templates);
  sb.scaffolds.forEach((sc) => {
    if (!genericOnly.has(sc.template)) P.push(`scaffold ${sc.id}: template must be one of ${PR.templates.join("|")} for profile ${sb.profile}`);
    if (sb.profile === "LC" && !(sc.slots && sc.slots.title)) P.push(`scene ${sc.id}: every LC scene needs slots.title (and a subtitle)`);
    if (sb.profile === "DC") {
      if (!sc.chapter) P.push(`sub-state ${sc.id}: needs a chapter name`);
      const st = (sc.slots && sc.slots.stage) || [];
      if (st.length) {
        const sh = st.reduce((a, m) => a + (m.h || require("./templates-generic").preferred(m, 912)), 0) + (st.length - 1) * 19;
        if (sh < 300) P.push(`sub-state ${sc.id}: stage content is only ${Math.round(sh)} px; R5 stages are filled -- use a module of 300-494 px (diagram h 380-460, table with 4+ rows, layers, code with 5-6 lines) or a hero`);
      }
      if (!(sc.slots && (sc.slots.hero || (sc.slots.stage || []).length))) P.push(`sub-state ${sc.id}: needs slots.hero or one module in slots.stage`);
      if (!(sc.slots && sc.slots.panel)) P.push(`sub-state ${sc.id}: needs slots.panel (the info panel beside the mascot)`);
    }
    const mods = []
      .concat((sc.slots && sc.slots.top) || [])
      .concat((sc.slots && sc.slots.bottom) || [])
      .concat((sc.slots && sc.slots.stage) || []);
    mods.forEach((m) => {
      if (!MODULES[m.type]) P.push(`scaffold ${sc.id}: unknown module type "${m.type}"`);
      else if (MODULES[m.type].chrome) P.push(`scaffold ${sc.id}: "${m.type}" is chrome added by the compiler; do not place it in slots`);
      else if (MODULES[m.type].only && MODULES[m.type].only !== sb.profile) P.push(`scaffold ${sc.id}: module "${m.type}" exists only in the ${MODULES[m.type].only} style`);
      if (!m.id) P.push(`scaffold ${sc.id}: every module in top/bottom needs an id (events target it)`);
      const p = m.props || {};
      if (m.type === "nodes") {
        (p.nodes || []).forEach((n) => {
          if (!(n.x >= PR.nodeX[0] && n.x <= PR.nodeX[1] && n.y >= 0.1 && n.y <= 0.86)) P.push(`${m.id}: node ${n.id} x/y out of range (x ${PR.nodeX.join("-")}, y 0.1-0.86)`);
          if (n.icon && ICONS.indexOf(n.icon) < 0) P.push(`${m.id}: node ${n.id} icon "${n.icon}" not in the icon set`);
        });
      }
      if (m.type === "panel" && (p.rows || []).length > 6) P.push(`${m.id}: panel has more than 6 rows`);
    });
  });
  if (sb.profile === "DH" && sb.scaffolds[0].template !== "opener") P.push("the first scaffold must be an opener (hook headline)");
  const s0 = sb.scaffolds[0].slots || {};
  if (!((s0.top || []).length || (s0.stage || []).length || s0.hero || s0.blueprint)) P.push("the first scene needs a visual module in slots.top (R3: the full answer is on screen by 1.5 s) so frame 0 is not just text");
  // every opener (hook and summary) and every hero scene carries a visual under its text (R2 T6
  // title cards / outro cards, R1 display slams over live panels)
  sb.scaffolds.forEach((sc, i) => {
    const top = (sc.slots && sc.slots.top) || [];
    if (sc.template === "opener" && !top.length) P.push(`opener ${sc.id}: needs a visual module in slots.top under the headline (kpis, compare, nodes, chips)`);
    if (sc.template === "hero") {
      const w = sc.layout === "full" ? 960 : 690;
      const h = top.reduce((a, m) => a + (m.h || require("./templates-generic").preferred(m, w)), 0) + Math.max(0, top.length - 1) * 19;
      if (h < 250) P.push(`hero ${sc.id}: only ${Math.round(h)} px under the hero; add a module (kpis, panel, compare, bars with 3-4 items) of at least 250 px`);
    }
  });
  // density: refs fill 20-40% of the frame with 2-5 modules; a lone small card reads as empty
  const { preferred } = require("./templates-generic");
  sb.scaffolds.forEach((sc) => {
    if (sc.template !== "stack" && sc.template !== "scene") return;
    const w = sc.layout === "full" ? 960 : 690;
    const mods = [].concat((sc.slots && sc.slots.top) || [], (sc.slots && sc.slots.bottom) || []);
    const h = mods.reduce((a, m) => a + (m.h || preferred(m, w)), 0) + Math.max(0, mods.length - 1) * 19;
    // DH: R2 carrier+slot fills ~960 px; LC: R4 content 549-1265 at 20-24% of the frame
    const need = sc.template === "scene" ? 360 : sc.layout === "full" ? 560 : 600;
    if (mods.length && h < need) P.push(`scaffold ${sc.id}: only ${Math.round(h)} px of content; the frame reads empty. Add modules (nodes 420+, table, panel with 3-5 rows, kpis, note) to reach at least ${need} px`);
    mods.forEach((m) => {
      if (m.type === "panel" && (m.props && m.props.rows || []).length < 3) P.push(`scaffold ${sc.id}: panel ${m.id} has fewer than 3 rows; use 3-5 rows or a different module`);
    });
  });
  if (sb.profile === "BP") P.push(...validateBP(sb));
  // BR (R7): window cards fill the column (content 34-45% of the frame); a lone small card reads empty
  if (sb.profile === "BR") {
    sb.scaffolds.forEach((sc) => {
      if (sc.template !== "brStack" && sc.template !== "brGrid") return;
      const w = sc.layout === "full" || (sc.template === "brGrid" && !sc.layout) ? 978 : 700;
      const mods = (sc.slots && sc.slots.top) || [];
      if (!mods.length) P.push(`scaffold ${sc.id}: ${sc.template} needs 1-2 cards in slots.top`);
      const h = mods.reduce((a, m) => a + (m.h || preferred(m, w)), 0) + Math.max(0, mods.length - 1) * 40.5;
      if (mods.length && h < 300) P.push(`scaffold ${sc.id}: only ${Math.round(h)} px of cards; R7 windows fill the column -- add a second card (targetForm, terminal, raceBars, modelTile) or more questions/rows to reach at least 300 px`);
    });
  }
  if (P.length) return P;

  // real compile on synthetic timings: anchors, targets on screen, layout overflow
  let spec;
  const tl = syntheticTimeline(sb);
  try {
    spec = compileStoryboard(sb, tl, { mascot: false });
  } catch (err) {
    return [err.message];
  }
  // ops must exist for the target module type
  const typeOf = {};
  spec.scaffolds.forEach((s) => s.modules.forEach((m) => (typeOf[m.id] = m.type)));
  (sb.events || []).forEach((e, i) => {
    const mod = String(e.target || "").split(".")[0];
    const type = typeOf[mod];
    const ops = mod === "hud" ? Object.assign({}, HUD.ops, knownOps("hud")) : mod === "mascot" ? { glance: 1, punch: 1 } : knownOps(type);
    if (!ops[e.op]) P.push(`event[${i}] op "${e.op}" is not available on ${mod} (${type}); allowed: ${Object.keys(ops).join(", ")}`);
    if (PR.forbiddenOps.indexOf(e.op) >= 0) P.push(`event[${i}] op "${e.op}" is not part of the ${sb.profile} style (refs never use it); use an append/reveal/tone instead`);
  });
  // cadence (SPEC 7.1, DH)
  const b = beats(spec);
  const T = tl.totalSeconds;
  const bpm = (b.length / T) * 60;
  const gaps = [0].concat(b).map((x, i, a) => (i + 1 < a.length ? [a[i + 1] - x, x] : [T - x, x]));
  const worst = gaps.reduce((m, g) => (g[0] > m[0] ? g : m), [0, 0]);
  if (bpm < PR.bpm[0]) P.push(`only ${bpm.toFixed(0)} visual beats/min; add word-anchored events (target ${PR.bpm[0]}-${PR.bpm[1]})`);
  if (bpm > PR.bpm[1]) P.push(`${bpm.toFixed(0)} beats/min is too busy (max ${PR.bpm[1]})`);
  if (worst[0] > PR.maxGap) {
    const s = tl.sentenceTimes.find((st) => st.start <= worst[1] + worst[0] && st.end >= worst[1]);
    P.push(`no visual change for ${worst[0].toFixed(1)} s starting at ${worst[1].toFixed(1)} s (around sentence ${s ? s.id : "?"}); add an event or a new scaffold there (max ${PR.maxGap} s)`);
  }
  const lives = spec.scaffolds.map((s) => s.t1 - s.t0).sort((a, c) => a - c);
  const med = lives[Math.floor(lives.length / 2)];
  if (med > PR.lifeMedian[1]) P.push(`scaffolds last ${med.toFixed(1)} s (median); change scaffold every ${PR.lifeMedian[0]}-${PR.lifeMedian[1]} s`);
  const evSent = new Set((sb.events || []).map((e) => e.sentence));
  sb.sentences.slice(1, -1).forEach((s) => {
    if (!evSent.has(s.id) && !sb.scaffolds.some((sc) => sc.from === s.id)) P.push(`sentence ${s.id} has no event and starts no scaffold`);
  });
  return P;
}

// module heights (px) used by the layout -- lets the model plan a scene that fits
const HEIGHTS = "MODULE HEIGHTS (px): panel = 74 + 58 x rows (with title); table = 46 + 60 x rows; kpis = 124 (150 with a bar); code = 70 + 42 x lines; compare = 78 + 50 x rows; bars = 64 x items - 10; steps 84; note 80; stat 110; banner 117; chart 280; stamp 150; timeline 100 (150 with captions); layers = 84 x layers - 12; letters 260; nodes / chips / tree = their h (defaults 420 / 186 / 380, shrinkable by 30%); modules are separated by 19 px gaps (30 px in LC). Column band: 890 px (with label) / 964 px (without); full band: 960 px; LC scene: 716 px; DC stage: 494 px.";

/**
 * Deterministic repair for the one near-miss the model keeps oscillating on: a hold slightly longer
 * than the band. Adds a short highlight (R2's emphasis device) on the word in the middle of each
 * over-long hold, on the first content module on screen. Returns the number of beats added.
 */
function autoFillGaps(sb) {
  const PR = PROFILES[sb.profile] || PROFILES.DH;
  const tl = syntheticTimeline(sb);
  let spec;
  try {
    spec = compileStoryboard(sb, tl, { mascot: false });
  } catch (_) {
    return 0;
  }
  const b = beats(spec);
  const T = tl.totalSeconds;
  let added = 0;
  const pts = [0].concat(b, [T]);
  for (let i = 0; i + 1 < pts.length; i++) {
    if (pts[i + 1] - pts[i] <= PR.maxGap) continue;
    const mid = (pts[i] + pts[i + 1]) / 2;
    const w = tl.words.reduce((best, x) => (Math.abs(x.start - mid) < Math.abs(best.start - mid) ? x : best), tl.words[0]);
    const sc = spec.scaffolds.find((s) => w.start >= s.t0 && w.start < s.t1);
    const chrome = /^(hud|lchead|dcchrome|dcstage|brhead|brtabs|bphead|tracker|bpnote)$|_title$|_label$|_eyebrow$|_footer$|_headline$|_display$|_band$/;
    const mod = sc && sc.modules.find((m) => !chrome.test(m.id) && m.type !== "micro" && m.type !== "label");
    if (!mod) continue;
    const toks = sb.sentences.find((s) => s.id === w.sentenceId).text.split(/\s+/).filter(Boolean);
    const norm = (x) => String(x).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    const occurrence = toks.slice(0, w.wi + 1).filter((t) => norm(t) === norm(toks[w.wi])).length;
    sb.events = sb.events || [];
    sb.events.push({ sentence: w.sentenceId, anchor: { text: toks[w.wi], occurrence }, op: "highlight", target: mod.id, value: { hold: 0.6 } });
    added++;
  }
  return added;
}

function catalogText(profile) {
  const mods = Object.entries(MODULES)
    .filter(([k]) => !["browser", "console", "connector", "label", "media"].includes(k)) // media: only via the promo scene until the media library lands in the generator
    .filter(([, m]) => !m.chrome && (!m.only || m.only === profile)) // profile-only cards (e.g. BR) stay out of other styles' prompts
    .map(([k, m]) => `- ${k}: ${m.use}\n    props ${m.props}` + (Object.keys(m.ops || {}).length ? `\n    ops ${Object.entries(m.ops).map(([o, d]) => `${o} ${d}`).join("; ")}` : "") + (m.entities ? `\n    sub-targets ${m.entities}` : ""))
    .join("\n");
  return mods;
}

const LC_GRAMMAR = `VISUAL GRAMMAR (measured, light scene-cut style: warm off-white paper, ivory window cards)
- profile "LC". Every scaffold uses template "scene"; a new scene every 4-5 s (1-2 sentences); each scene is rebuilt from empty after a hard cut, with a title + subtitle.
- entities.kicker: a mono caps breadcrumb for the header, e.g. "SECURITY / OAUTH 2.0" (<= 32 chars).
- Build order inside a scene: title -> modules (+50 ms) -> word-anchored reveals -> connector draws -> packets -> the footnote takeaway last.
- APPEND-ONLY state: reveal / rowIn / nodeIn / light / draw / packet / activate / fill / tone / type. NEVER strike, never count numbers up (show the final number; use a scene display for the key number).
- Diagrams: nodes are window cards (x 0.2-0.8), connectors "elbow" or "straight", drawn on the flow word, then a packet travels them.
- Lists/tables reveal one row per spoken item; a footnote on most scenes states the takeaway in <= 44 chars.
- Colour = role: blue = data/the main path, purple = metadata/secondary, green = success/control, red = cost/failure, amber = warning. Max 3 hues per scene.
- Scenes carry 1-3 modules, 360-700 px of content in total (the column is 690 px wide, 716 px tall under the title).
- Every sentence gets 1-4 events; visual beats ~55-85 per minute; never more than 4 s without a visual change.`;

const DC_GRAMMAR = `VISUAL GRAMMAR (measured, dark chaptered style: near-black, a framed stage, serif hero words)
- profile "DC". Every scaffold uses template "sub" (a sub-state). A new sub-state on (almost) every sentence, ~2-3 s each, grouped into 3-5 chapters by the "chapter" field (the header shows the chapter + a progress bar).
- Each sub-state: slots.sub (caps breadcrumb), ONE stage visual (slots.hero serif word with a mono kicker, OR one module in slots.stage), and slots.panel (2-3 key/value facts beside the presenter).
- Use a hero sub-state for the named concepts and big numbers (every ~15-20 s); diagrams/tables/layers for mechanisms.
- Word-anchored lighting: nodes start lit:false and 'light' on each spoken noun; tables reveal/tint rows on their words; layers dropIn per item; strikes allowed for "not this".
- NEVER count numbers up. Colour = domain: cyan/teal = the platform/connected, amber = question/AI/attention, pink = entities/failure. Mostly monochrome; one lit accent at a time.
- On hero beats add {"op":"glance","target":"mascot"} on the hero word (the presenter glances).
- Every sentence gets 1-4 events; ~70-90 visual beats per minute; never more than 3 s without a change.`;

// BR (R7 AUDIT §3, §4 F30, §6): light brutalist product / decision explainer
const BR_GRAMMAR = `VISUAL GRAMMAR (measured, light brutalist style: warm grey dotted plate, square black-bar window cards with hard offset shadows, magenta = the decider, blue = the generator/LLM, red = cost)
- profile "BR". Templates: brStack (most scenes), brGrid (tool/app/doc grids), brSummary (the recap pair near the end), brBand (one proof moment at most), brMedia (never; no footage is available to you).
- A new scaffold every ~2.5-4.5 s (1-2 sentences, hard cut + 25 px rise), BUT the host card persists: when consecutive scaffolds keep the SAME card id (e.g. "sheet" and "app"), the card stays and mutates in place while the eyebrow / headline / second card change.
- Every scaffold has "chapter" (1-3 caps words, shown in the header; 4-7 chapters, e.g. WHAT IT IS / THE PROBLEM / ONE EXAMPLE / USE CASES / WHY IT MATTERS / REMEMBER THIS) and may have "tabs": {"items": [3-4 short words], "active": n} during an enumeration chapter (active advances per scaffold).
- entities: {"brand": "<the product/idea, 1 word, <= 10 chars>", "counter": {"label": "DECISIONS", "value": 0}} -- the header counter is a running tally: add {"op":"tick","target":"brhead","value":{"by":N}} each time decisions land (scan / pick / fly), and ONE {"op":"countUp","target":"brhead","value":{"to":1000000}} on the last topic sentence.
- Sentence -> treatment: question -> decisionSheet focus on that row; enumerated options -> pulse per option word; "returns / answers / decides" -> scan (+ counter tick); a number -> prob slam; "writes / generates" -> writerWindow streaming; "parse / extract" -> mark phrases + targetForm fill with tone "uncertain"; "answer / structured / your app" -> targetForm fly from the sheet options + status ok; tools / apps / documents enumerated -> toolTiles/appGrid/docGrid light per noun; "fast / latency" -> raceBars; "cost / cheaper" -> costBar shrink or modelTile tag; a shell command -> terminal type; negation ("isn't", "not", "obsolete") -> slamStamp + strike; a keyword -> keywordHeadline recolour on the word.
- Headlines are caption-sized (56 px) sentence case; hierarchy comes from the keyword recolour (grey -> magenta/blue), not size. The hook headline may use size 88.
- Layout: 'column' (presenter at the left, cards 700 px wide) for most scenes; 'full' (presenter hidden, 978 px) for the hook, grids and the recap.
- Every sentence gets 1-4 events; ~58-75 visual beats per minute (chrome ticks count); never more than 3.3 s without a visual change. Motion is front-loaded: card pops, then per-word state changes.`;

function buildPromptBR(topic, opts, example) {
  return `You write storyboards for 45-55 second vertical tech-explainer shorts in ONE precise house style
(light brutalist product explainer, measured from a reference reel). Output ONLY a JSON object of shape storyboard.v3 with "profile": "BR".

TOPIC: ${topic}
${opts.audience ? `AUDIENCE: ${opts.audience}\n` : ""}
NARRATION RULES
- ${BANDS.sentences[0]}-${BANDS.sentences[1]} sentences, ${wordBand(opts.lengthSeconds).join("-")} words total, max 24 words per sentence, conversational, concrete.
- Structure: hook question -> what it is / isn't -> the problem -> ONE worked example carried through several scaffolds (same host card) -> 2-4 use cases -> why it matters (speed / cost) -> a caveat -> the two-part recap ("X does this. Y does that.").
- Spell every number as spoken words; the visuals carry digits. Never read IDs, keys, code or paths aloud.
- Realistic, consistent specifics (one customer, one message, the same field names) reused across scenes.

${NARRATIVE_GUIDE}

${BR_GRAMMAR}

TEMPLATES
${["brStack", "brGrid", "brSummary", "brBand"].map((k) => `- ${k}: ${TEMPLATE_DOCS[k]}`).join("\n")}

MODULES (type -> use, props, ops)
${catalogText("BR")}
BR HEIGHTS (px): decisionSheet = 48 + 104 x questions (+86 with a situation; 92/question when compact); targetForm = 60 + 78 x fields (+69 status); writerWindow = 52 + 39 x text lines (~43 chars/line at 700 px; +46 with vendors); toolTiles = 168 x rows - 10; appGrid = 188 x rows - 10; docGrid = 138 x rows + 2; raceBars = 94 + 84 x rows; terminal = 155 (+40 intro, +40 comment); costBar 80; modelTile 250; slamStamp 170; keywordHeadline = 63 x lines + 4. Cards are stacked with 40.5 px gaps; the column holds ~916 px under nothing, ~865 px under an eyebrow, ~790 px under a one-line headline + eyebrow.
Generic ops on any sub-target: reveal, remove, text{text}, tone{tone}, highlight{hold?}, strike{tone?}, slam, dim, undim.

EVENTS
{ "sentence": "<sentence id>", "anchor": {"text": "<ONE word copied from that sentence>", "occurrence"?: n}, "op": "<op>", "target": "<module id>[.<sub-target>]", "value"?: {...} }
- The target must be on screen at that sentence (its scaffold spans it); "brhead" (header counter) is always on screen; "mascot" accepts glance.
- Cards may enter on a word with "anchor" on the module fill (add "sentence" when the word is in a later sentence of the same scaffold).

TONES magenta, blue, red, green, grey, ${TONES.join(", ")}.  ICONS ${ICONS.join(", ")}, search, calculator, code, mail, message, dollar, file-text, play, home, grid, gamepad, sparkles, bot, list, tag, route.

WORKED EXAMPLE (different topic; follow its density and structure, not its content):
${example}

Return the storyboard.v3 JSON for the TOPIC now.`;
}

// BP (R6 AUDIT §3, §4 E/F/G): light blueprint system-design story
const BP_TRANS = { out: ["pushLeft", "dropOut", "exitRight", "driftLeft", "tumble"], in: ["riseIn", "slideInRight", "cover", "popRise", "afterPush"] };
const BP_NOTE_KINDS = ["rule", "problem", "fix", "goal", "cost"];

function validateBP(sb) {
  const P = [];
  const { preferred } = require("./templates-generic");
  const ent = sb.entities || {};
  const bp = ent.blueprint;
  if (!bp || !Array.isArray(bp.nodes) || !bp.nodes.length) P.push("BP needs entities.blueprint {title, nodes, edges} (the whole final graph; hidden:true on nodes added later)");
  else {
    if (bp.nodes.length > 20) P.push(`entities.blueprint has ${bp.nodes.length} nodes; max 20`);
    const ids = new Set(bp.nodes.map((n) => n.id));
    const perRow = {};
    bp.nodes.forEach((n) => {
      if (typeof n.row !== "number") P.push(`blueprint node ${n.id} needs a numeric "row" (0 = top tier)`);
      perRow[n.row] = (perRow[n.row] || 0) + 1;
      if (String(n.label || "").length > 16) P.push(`blueprint node ${n.id}: label "${n.label}" is longer than 16 chars`);
    });
    Object.entries(perRow).forEach(([r, k]) => k > 4 && P.push(`blueprint row ${r} has ${k} nodes; max 4 per row (split into another row)`));
    (bp.edges || []).forEach((e) => (!ids.has(e.from) || !ids.has(e.to)) && P.push(`blueprint edge ${e.from}->${e.to} names an unknown node`));
    (sb.events || []).forEach((e, i) => {
      if (e.target !== "bp" || !e.value) return;
      [].concat(e.value.node || [], e.value.nodes || [], e.value.at || []).forEach((id) => !ids.has(id) && P.push(`event[${i}] ${e.op} names blueprint node "${id}" that is not in entities.blueprint.nodes`));
    });
  }
  if (!Array.isArray(ent.tracker) || ent.tracker.length < 3 || ent.tracker.length > 9) P.push("entities.tracker: list the 3-9 components the story adds (short caps words, e.g. LB, CACHE, QUEUE)");
  const hosts = sb.scaffolds.filter((s) => s.template === "bpHost").length;
  if (hosts < 3) P.push(`only ${hosts} bpHost visit(s); revisit the blueprint at least 3 times (R6 recalls it after every explainer)`);
  sb.scaffolds.forEach((sc) => {
    const note = sc.note || (sc.slots && sc.slots.note);
    if (!note || BP_NOTE_KINDS.indexOf(String(note.kind || "").toLowerCase()) < 0 || !note.text) P.push(`scaffold ${sc.id}: needs note {kind: ${BP_NOTE_KINDS.join("|")}, text (<= 34 chars)}`);
    else if (String(note.text).length > 40) P.push(`scaffold ${sc.id}: note text is ${String(note.text).length} chars; max 34`);
    if (sc.transition) {
      if (sc.transition.out && BP_TRANS.out.indexOf(sc.transition.out) < 0) P.push(`scaffold ${sc.id}: transition.out must be one of ${BP_TRANS.out.join("|")}`);
      if (sc.transition.in && BP_TRANS.in.indexOf(sc.transition.in) < 0) P.push(`scaffold ${sc.id}: transition.in must be one of ${BP_TRANS.in.join("|")}`);
    }
    if (sc.template === "bpScene") {
      const mods = (sc.slots && sc.slots.top) || [];
      if (!mods.length) P.push(`scaffold ${sc.id}: bpScene needs 1-3 modules in slots.top`);
      let h = 0;
      for (let i = 0; i < mods.length; i++) {
        const m = mods[i];
        if (m.half && mods[i + 1] && mods[i + 1].half) {
          h += Math.max(m.h || preferred(m, 348), mods[i + 1].h || preferred(mods[i + 1], 348)) + 21;
          i++;
        } else h += (m.h || preferred(m, 717)) + 21;
      }
      if (mods.length && h - 21 < 520) P.push(`scaffold ${sc.id}: only ${Math.round(h - 21)} px of content; the BP column (y 402-1330) is filled like R6 -- add a module or items to reach at least 520 px`);
    }
  });
  return P;
}

const BP_GRAMMAR = `VISUAL GRAMMAR (measured, light blueprint style: cool grey line-grid plate, white cards, purple = an added component / the fix, blue = numbers, red = problems)
- profile "BP". Two templates: bpHost (the persistent architecture blueprint, module id "bp") and bpScene (a short explainer stack). The story builds ONE architecture that only grows: alternate explainer scenes with bpHost visits (>= 3 visits; R6 revisits it ~10 times). Each visit adds 1-2 components with "add" (nodes pop in, edges draw, the graph auto zooms to fit), then alerts / annotations / packets on the words.
- entities.blueprint = the WHOLE final graph (<= 16 nodes, <= 4 per row): nodes that appear later have hidden:true; rows are tiers top -> bottom (users row 0, load balancer row 1, servers row 2, cache/db row 3, replicas/storage below). The first bpHost shows only the first 1-2 components (users + one machine/server). Use "version" {n} on each visit.
- The hook (first scaffold) is a bpScene with a displayHeadline (2 lines, the promise) + a blueprint module {id:"bpHook", type:"blueprint", h: 560, props:{final:true}} (the finished architecture up front, answer first). End the topic with a callback: a last bpHost visit where everything is added.
- CHROME (always on screen, targets): header "bphead" -- a live users counter: {"op":"users","target":"bphead","value":{"to":1000}} on each growth number (0 -> 1K -> 100K -> 1M -> 10M ...; never goes down); component tracker "tracker" (entities.tracker lists the components, <= 9, e.g. ["LB","CACHE","REPLICAS","QUEUE","CDN"]) -- {"op":"light","target":"tracker","value":{"chip":"CACHE"}} on the component noun, coupled with the blueprint add; note card "bpnote" -- EVERY scaffold has "note": {"kind": rule|problem|fix|goal|cost, "text": "<= 34 chars thesis"}; add 0-1 extra {"op":"note","target":"bpnote","value":{kind,text}} mid-scene on the key clause (a problem, then its fix).
- entities.brand: 2-3 caps words for the header brand block (e.g. "SCALING 101"); every scaffold has "chapter" (2-3 caps words, 5-8 chapters: ONE SERVER / SCALE OUT / THE DATABASE / SLOW WORK / FAILURE ...).
- TRANSITIONS (about half of the scene changes; the rest hard cuts = no transition): "transition": {"out": <how the previous scene leaves>, "in": <how this one enters>}. Into a bpHost after an explainer: {"out":"dropOut","in":"riseIn"} or {"out":"exitRight","in":"slideInRight"}. Out of a bpHost into an explainer: {"out":"driftLeft","in":"cover"}. After a verdict / enumeration that is done: {"out":"pushLeft","in":"afterPush"}. After a negation ("that's not it"): {"out":"tumble","in":"popRise"}. Never two motion transitions in a row shorter than 2 s apart.
- Sentence -> treatment: component introduced -> bp add + tracker light + note FIX; problem -> bp alert (red) + note PROBLEM; growth number -> header users count; enumeration -> featureRows / costCards / techCards pre-built as ghosts, "lit" one per spoken item; "X isn't Y, it's Z" -> strikeStrips strike then lit; a thesis -> displayHeadline (dim) lit on its key word; negative verdict -> techCards tumble then a verdictStamp scene; a request or upload -> phone (half) + reqList (half) with rowLit per verb; cache/hits -> hitCounter + dotGrid + vsCards; latency -> latencyBars; "too much infrastructure" -> logoGrid flood.
- Keep one persona and one app through the whole story (e.g. "maya" on a photo app); the blueprint labels, tracker chips and cards use the same component names.
- Every sentence gets 1-3 events; ~48-62 visual beats per minute (chrome events count); never more than 3.4 s without a visual change; scenes change every 2.5-5 s (a bpHost visit may hold longer while it mutates).`;

function buildPromptBP(topic, opts, example) {
  return `You write storyboards for 45-55 second vertical tech-explainer shorts in ONE precise house style
(light blueprint system-design story, measured from a reference reel). Output ONLY a JSON object of shape storyboard.v3 with "profile": "BP".

TOPIC: ${topic}
${opts.audience ? `AUDIENCE: ${opts.audience}\n` : ""}
NARRATION RULES
- ${BANDS.sentences[0]}-${BANDS.sentences[1]} sentences, ${wordBand(opts.lengthSeconds).join("-")} words total, max 24 words per sentence, conversational, concrete, short punchy sentences allowed ("No.").
- Structure: hook (the finished system, answer first) -> start with one simple machine -> growth breaks it -> one component per problem (problem -> fix) -> a failure / trade-off -> the method takeaway + callback to the hook.
- Spell every number as spoken words; the visuals carry digits. Never read IDs, keys, code or paths aloud.

${NARRATIVE_GUIDE}

${BP_GRAMMAR}

TEMPLATES
${["bpScene", "bpHost"].map((k) => `- ${k}: ${TEMPLATE_DOCS[k]}`).join("\n")}

MODULES (type -> use, props, ops)
${catalogText("BP")}
- also usable in bpScene: panel, table, kpis, code, compare, bars, chips, note, banner (shared cards, themed light)
BP HEIGHTS (px): featureRows = 150 x items + 21 gaps; costCards = 230 x items; techCards 340 per row of 2; displayHeadline = 115 x lines; strikeStrips 333; verdictStamp 240 (320 with sub); phone 675; reqList = 58 + 78 x rows + 106 with total; dotGrid 255; hitCounter 200; vsCards 400; latencyBars = 116 + 110 x bars (+58 footer); logoGrid = 58 + 120 x rows; blueprint = its h. Modules stack with 21 px gaps in a 928 px column (717 wide; halves 348).
Generic ops on any sub-target: reveal, remove, text{text}, tone{tone}, highlight{hold?}, strike{tone?}, count{to}, slam, dim, undim.

EVENTS
{ "sentence": "<sentence id>", "anchor": {"text": "<ONE word copied from that sentence>", "occurrence"?: n}, "op": "<op>", "target": "<module id>[.<sub-target>]", "value"?: {...} }
- The target must be on screen at that sentence (its scaffold spans it); "bphead", "tracker", "bpnote" are always on screen; "mascot" accepts glance.

TONES ${TONES.join(", ")}.  ICONS ${ICONS.join(", ")}.

WORKED EXAMPLE (different topic; follow its density and structure, not its content):
${example}

Return the storyboard.v3 JSON for the TOPIC now.`;
}

/**
 * LF (16:9 long-form) storyboards are written per chapter by lib/longform (research -> outline -> chapter
 * script -> storyboardLF, plan §7 / P6); this generator only knows the 9:16 styles.
 */
function buildPromptLF() {
  throw new Error("LF storyboards are generated per chapter by lib/longform (storyboardLF), not by the 9:16 storyboard generator");
}

const LF_TRANS = { out: ["zoomThrough", "pushLeft"], in: ["zoomIn", "afterPush"] };

/** LF: structural checks + the real compiler on a relaxed synthetic timeline + LF cadence bands */
function validateLF(sb) {
  const PR = PROFILES.LF;
  const P = [];
  if (!(sb.frame && Number(sb.frame.w) > Number(sb.frame.h))) P.push('LF storyboards need a landscape frame ({"w": 1920, "h": 1080})');
  if (!Array.isArray(sb.scaffolds) || !sb.scaffolds.length) return P.concat(["scaffolds[] missing"]);
  sb.scaffolds.forEach((sc) => {
    if (PR.templates.indexOf(sc.template) < 0) P.push(`scaffold ${sc.id}: template must be one of ${PR.templates.join("|")} for profile LF`);
    // LF scene transitions push through / settle from the frame centre (core TRANS_OUT/IN)
    if (sc.transition) {
      if (sc.transition.out && LF_TRANS.out.indexOf(sc.transition.out) < 0) P.push(`scaffold ${sc.id}: transition.out must be one of ${LF_TRANS.out.join("|")} for profile LF`);
      if (sc.transition.in && LF_TRANS.in.indexOf(sc.transition.in) < 0) P.push(`scaffold ${sc.id}: transition.in must be one of ${LF_TRANS.in.join("|")} for profile LF`);
    }
  });
  sb.sentences.forEach((s) => {
    if (/\d/.test(s.text)) P.push(`sentence ${s.id} contains digits; spell numbers out (the visuals carry the digits)`);
  });
  if (P.length) return P;
  const tl = syntheticTimeline(sb, PR.syn);
  let spec;
  try {
    spec = compileStoryboard(sb, tl, { mascot: false });
  } catch (err) {
    return [err.message];
  }
  const typeOf = {};
  spec.scaffolds.forEach((s) => s.modules.forEach((m) => (typeOf[m.id] = m.type)));
  (sb.events || []).forEach((e, i) => {
    const mod = String(e.target || "").split(".")[0];
    const ops = knownOps(typeOf[mod]);
    if (!ops[e.op]) P.push(`event[${i}] op "${e.op}" is not available on ${mod} (${typeOf[mod]}); allowed: ${Object.keys(ops).join(", ")}`);
    if (PR.forbiddenOps.indexOf(e.op) >= 0) P.push(`event[${i}] op "${e.op}" is not part of the LF style`);
  });
  const b = beats(spec);
  const T = tl.totalSeconds;
  const bpm = (b.length / T) * 60;
  const pts = [0].concat(b, [T]);
  let worst = 0;
  for (let i = 1; i < pts.length; i++) worst = Math.max(worst, pts[i] - pts[i - 1]);
  if (bpm < PR.bpm[0] || bpm > PR.bpm[1]) P.push(`${bpm.toFixed(0)} visual beats/min on the synthetic LF timeline (target ${PR.bpm.join("-")})`);
  if (worst > PR.maxGap) P.push(`a hold of ${worst.toFixed(1)} s without a visual change (max ${PR.maxGap} s)`);
  return P;
}

function buildPrompt(topic, opts = {}) {
  if (opts.profile === "LF") return buildPromptLF(topic, opts);
  if (opts.profile === "BP") return buildPromptBP(topic, opts, fs.readFileSync(PROFILES.BP.example, "utf-8"));
  if (opts.profile === "BR") return buildPromptBR(topic, opts, fs.readFileSync(PROFILES.BR.example, "utf-8"));
  const profile = opts.profile === "LC" ? "LC" : opts.profile === "DC" ? "DC" : "DH";
  const example = fs.readFileSync(PROFILES[profile].example, "utf-8");
  if (profile === "LC") return buildPromptLC(topic, opts, example);
  if (profile === "DC") return buildPromptLC(topic, opts, example, "DC");
  return `You write storyboards for 45-55 second vertical tech-explainer shorts in ONE precise house style
(dark UI-on-black, measured from reference reels). Output ONLY a JSON object of shape storyboard.v3.

TOPIC: ${topic}
${opts.audience ? `AUDIENCE: ${opts.audience}\n` : ""}
NARRATION RULES
- ${BANDS.sentences[0]}-${BANDS.sentences[1]} sentences, ${wordBand(opts.lengthSeconds).join("-")} words total, max 24 words per sentence, conversational, concrete.
- Structure: a named hook -> one concrete scenario -> causal mechanism -> one earned complication or consequence -> a callback takeaway. Use a failure/redesign arc only when this topic genuinely has one; the payoff need not be a number.
- Spell every number as spoken words in the narration ("two hundred forty milliseconds"); the visuals carry digits ("240 ms").
- Never read IDs, keys, hashes, codes or file paths aloud; describe them ("a unique request key") and let the visual show the value.
- Reuse internally consistent technical entities across sentences; avoid made-up exact latencies, counts, dates or financial claims.

${NARRATIVE_GUIDE}

VISUAL GRAMMAR (measured)
- A new scaffold every 3-6 s (usually every 1-2 sentences); the first scaffold is an "opener" hook headline, the last an "opener" summary headline.
- Every sentence after the first gets 1-4 word-anchored events; visual beats ~65-90 per minute; never more than 3 s without a visual change.
- Enumerations: one reveal per spoken item (hidden rows/nodes + rowIn/nodeIn/light on each item word).
- Numbers: kpis count on the number word, or a hero scaffold slam for the one key number.
- Negation / "instead of" / rejected option: strike. Cause -> effect / flow: connector draw then packet. State change: tone / text / activate.
- Colour = role, never list position: red = failure/attack, green = success/healthy, amber = warning/in-progress, blue/cyan = the system/user, purple = infrastructure/secondary. Max 3 hues on screen.
- Use 'full' layout for climaxes, wide diagrams and compare; otherwise 'column'.
- Fill the frame like the references: every stack scaffold carries 2-4 modules totalling 600-900 px (column) / 560-900 px (full); panels have 3-5 rows; diagrams are 420-560 px tall. A lone small card is never enough.
- Every opener (the hook AND the closing summary) puts a visual module under the headline (slots.top), entering on a word; hero scenes carry >= 250 px of supporting modules under the number.
- Put hidden:true / lit:false / drawn:false on things that should appear on words, and the matching event on the word.
- A module persists across consecutive scaffolds only if it has the same id; otherwise ids are unique.

TEMPLATES
${Object.entries(TEMPLATE_DOCS).filter(([k]) => !/^lf[A-Z]/.test(k)).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
(the section label goes in slots.label {props:{text, tone?}}, 1-3 caps words like "THE PROBLEM", "CACHE MISS")

MODULES (type -> use, props, ops)
${catalogText()}
${HEIGHTS}

HUD (optional, in entities.hud, persists across stack/hero scaffolds): ${HUD.props}; ops ${Object.entries(HUD.ops).map(([o, d]) => `${o} ${d}`).join("; ")}
Generic ops on any sub-target: reveal, remove, text{text}, tone{tone}, retype{text}, count{to,from?,dur?}, strike{tone?}, slam, highlight{hold?}, dim, undim.

EVENTS
{ "sentence": "<sentence id>", "anchor": {"text": "<ONE word copied from that sentence>", "occurrence"?: n}, "op": "<op>", "target": "<module id>[.<sub-target>]", "value"?: {...} }
- The target module must be on screen at that sentence (its scaffold spans it); openers have no HUD. Module-level ops target the module id (e.g. "target":"lat","op":"count","value":{"item":1}).
- Modules may enter on a word with "anchor" on the module fill.

TONES ${TONES.join(", ")}.  ICONS ${ICONS.join(", ")}.

WORKED EXAMPLE (different topic; follow its density and structure, not its content):
${example}

Return the storyboard.v3 JSON for the TOPIC now.`;
}

function buildPromptLC(topic, opts, example, prof) {
  const P = prof || "LC";
  const mods = catalogText();
  return `You write storyboards for 45-55 second vertical tech-explainer shorts in ONE precise house style
(${P === "DC" ? "dark, chaptered, cinematic" : "light, editorial"}, measured from reference reels). Output ONLY a JSON object of shape storyboard.v3 with "profile": "${P}".

TOPIC: ${topic}
${opts.audience ? `AUDIENCE: ${opts.audience}
` : ""}
NARRATION RULES
- ${BANDS.sentences[0]}-${BANDS.sentences[1]} sentences, ${wordBand(opts.lengthSeconds).join("-")} words total, max 24 words per sentence, conversational, concrete.
- Structure: named hook -> one concrete situation -> causal mechanism -> one earned complication or consequence -> callback takeaway. Choose a failure/redesign, concept-explanation or company/platform arc that fits the topic.
- Spell every number as spoken words in the narration; the visuals carry digits.
- Never read IDs, keys, hashes, codes or file paths aloud; describe them ("a unique request key") and let the visual show the value.
- Reuse internally consistent entities across sentences; avoid made-up exact benchmarks, dates and financial claims.

${NARRATIVE_GUIDE}

${P === "DC" ? DC_GRAMMAR : LC_GRAMMAR}

TEMPLATE
- ${P === "DC" ? "sub: " + TEMPLATE_DOCS.sub : "scene: " + TEMPLATE_DOCS.scene}

MODULES (type -> use, props, ops)
${mods}
${HEIGHTS}
Generic ops on any sub-target: reveal, remove, text{text}, tone{tone}, retype{text}, highlight{hold?}.

EVENTS
{ "sentence": "<sentence id>", "anchor": {"text": "<ONE word copied from that sentence>", "occurrence"?: n}, "op": "<op>", "target": "<module id>[.<sub-target>]", "value"?: {...} }
- The target module must be on screen at that sentence (its scene/sub-state spans it); "mascot" is always a valid target for glance. Modules/footnotes may enter on a word with "anchor" (add "sentence" when the word is in a later sentence of the same scene).

TONES ${TONES.join(", ")}.  ICONS ${ICONS.join(", ")}.

WORKED EXAMPLE (different topic; follow its density and structure, not its content):
${example}

Return the storyboard.v3 JSON for the TOPIC now.`;
}

/** pick the reference style that fits the topic (SPEC 1.2): DH systems/incidents, LC workflows/building */
async function chooseProfile(topic, generate) {
  const r = await generate(`Five house styles exist for a 50-second tech explainer.
DH: dark dashboard world -- systems under load, incidents, traffic, deployments, infrastructure, attacks, performance, "how X works at scale".
LC: light editorial paper -- building a feature step by step, developer tools and workflows, protocols explained as a sequence of steps, data formats, "how to design X".
DC: dark chaptered documentary -- what a company / platform / product actually is and does, big concepts in named chapters, "what does X actually do".
BR: light brutalist product explainer -- AI / LLM products and features, agents and tooling, decisions / classification / routing, "X vs an LLM", "why apps need X".
BP: light blueprint system-design story -- scaling a product from one server to millions of users, "system design 101", how an architecture grows component by component (load balancer, cache, replicas, queue, CDN).
TOPIC: ${topic}
Answer as JSON {"profile": "DH" | "LC" | "DC" | "BR" | "BP", "reason": "<one short clause>"}.`);
  return r && ["LC", "DH", "DC", "BR", "BP"].indexOf(r.profile) >= 0 ? r.profile : "DH";
}

function cadenceSummary(sb) {
  try {
    const tl = syntheticTimeline(sb);
    const spec = compileStoryboard(sb, tl, { mascot: false });
    const b = beats(spec);
    return `Measured on your storyboard: ${b.length} beats in ${tl.totalSeconds.toFixed(1)} s = ${((b.length / tl.totalSeconds) * 60).toFixed(0)} beats/min (target ${(PROFILES[sb.profile] || PROFILES.DH).bpm.join("-")}), ${spec.scaffolds.length} scaffolds, ${(sb.events || []).length} events. Make the smallest change that lands in the band.`;
  } catch (_) {
    return "";
  }
}

function buildRepairPrompt(topic, raw, problems, opts) {
  return `${buildPrompt(topic, opts)}

YOUR PREVIOUS OUTPUT:
${JSON.stringify(raw)}

IT FAILED VALIDATION:
${problems.map((p) => "- " + p).join("\n")}

${cadenceSummary(raw)}

Return the corrected full storyboard.v3 JSON. Keep everything that was valid; fix exactly these problems.`;
}

function loadGemini(task = "storyboard") {
  const envPath = path.join(__dirname, "..", "..", "..", "..", "scripting-pipeline", ".env");
  const env = {};
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, "utf-8").split(/\r?\n/).forEach((l) => {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    });
  }
  const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set (process env or scripting-pipeline/.env)");
  const { GoogleGenerativeAI } = require(path.join(__dirname, "..", "..", "..", "..", "scripting-pipeline", "node_modules", "@google", "generative-ai"));
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: require("../../ai/models").modelFor(task),
    generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
  });
  return async (prompt) => {
    const r = await model.generateContent(prompt);
    require("../../ai/models").recordUsage({ task, model: model.model, usage: r.response.usageMetadata });
    return JSON.parse(r.response.text());
  };
}

/**
 * @param {string} topic
 * @param {{generate?: (prompt:string)=>Promise<object>, maxAttempts?: number, log?: Function, audience?: string, extraProblems?: string[], previous?: object}} opts
 * @returns {Promise<{storyboard, attempts: {problems: string[]}[]}>}
 */
async function generateStoryboard(topic, opts = {}) {
  const generate = opts.generate || loadGemini();
  const log = opts.log || (() => {});
  if (!opts.profile || opts.profile === "auto") {
    try {
      opts = { ...opts, profile: await chooseProfile(topic, opts.generate || loadGemini("style.choose")) };
    } catch (err) {
      if (/\b(401|402|403)\b|credits are depleted|API key not valid|PERMISSION_DENIED/i.test(err.message)) throw new Error(`model unavailable (not retried): ${err.message}`);
      opts = { ...opts, profile: "DH" };
    }
    log(`profile: ${opts.profile}`);
  }
  const max = opts.maxAttempts || 4;
  const attempts = [];
  let raw = opts.previous || null;
  let problems = opts.extraProblems || [];
  for (let i = 0; i < max; i++) {
    const prompt = raw ? buildRepairPrompt(topic, raw, problems, opts) : buildPrompt(topic, opts);
    log(`storyboard attempt ${i + 1}/${max}${raw ? ` (repairing ${problems.length} problem(s))` : ""}`);
    try {
      raw = await generate(prompt);
    } catch (err) {
      problems = [`model call failed: ${err.message}`];
      attempts.push({ problems });
      // billing / auth / permission errors never fix themselves on retry: stop now, say why
      if (/\b(401|402|403)\b|credits are depleted|API key not valid|PERMISSION_DENIED/i.test(err.message)) {
        const fatal = new Error(`model unavailable (not retried): ${err.message}`);
        fatal.attempts = attempts;
        fatal.last = raw;
        throw fatal;
      }
      continue;
    }
    if (raw && !raw.version) raw.version = "storyboard.v3";
    if (raw) raw.profile = opts.profile; // the chosen style is authoritative
    problems = validate(raw, opts);
    if (!problems.length) problems = await layoutProblems(raw, opts, log);
    attempts.push({ problems });
    problems.forEach((p) => log(`  - ${p}`));
    if (!problems.length) return { storyboard: raw, attempts };
  }
  // last resort for pure cadence near-misses (long holds only): deterministic emphasis beats
  if (raw && problems.length && problems.every((p) => /^no visual change for/.test(p))) {
    const n = autoFillGaps(raw);
    let again = n ? validate(raw, opts) : problems;
    if (n && !again.length) again = await layoutProblems(raw, opts, log);
    log(`auto-filled ${n} long hold(s) with emphasis beats; ${again.length} problem(s) left`);
    if (!again.length) return { storyboard: raw, attempts };
    problems = again;
  }
  const err = new Error(`storyboard still invalid after ${max} attempts: ${problems.join(" | ")}`);
  err.attempts = attempts;
  err.last = raw;
  throw err;
}

module.exports = { PROFILES, validateLF, generateStoryboard, validate, buildPrompt, syntheticTimeline, BANDS, wordBand, autoFillGaps, chooseProfile, loadGemini, catalogText };
