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

const FIX = path.join(__dirname, "..", "..", "..", "fixtures", "v3");
const EXAMPLE_PATH = path.join(FIX, "cdn-dh.json");

// Per-profile grammar (SPEC.md 1.2/1.3, 7.1): DH = dark HUD/persistent (R1/R2), LC = light
// scene-cut (R3/R4). Bands are for the synthetic timeline, slightly tighter than the render gates.
const PROFILES = {
  DH: { example: EXAMPLE_PATH, templates: ["opener", "stack", "hero"], bpm: [62, 100], maxGap: 3.3, lifeMedian: [2.0, 6.0], nodeX: [0.1, 0.9], forbiddenOps: [] },
  DC: { example: path.join(FIX, "k8s-dc.json"), templates: ["sub"], bpm: [58, 100], maxGap: 3.0, lifeMedian: [1.8, 4.6], nodeX: [0.14, 0.86], forbiddenOps: ["count", "slam"] },
  LC: { example: path.join(FIX, "oauth-lc.json"), templates: ["scene"], bpm: [48, 95], maxGap: 4.2, lifeMedian: [3.0, 7.0], nodeX: [0.2, 0.8], forbiddenOps: ["strike", "rowStrike", "count", "slam"] },
};

// synthetic pacing that approximates the delivered pace (215 wpm incl. 0.2 s sentence gaps)
const SYN = { word: 0.255, gap: 0.2 };
// cadence bands on the synthetic timeline (a little tighter than the render gates)
const BANDS = { bpm: [62, 100], maxGap: 3.3, lifeMedian: [2.0, 6.0], words: [120, 200], sentences: [9, 16] };

function tokens(t) {
  return String(t).split(/\s+/).filter(Boolean);
}

function syntheticTimeline(sb) {
  let t = 0.12;
  const words = [];
  const sentenceTimes = sb.sentences.map((s) => {
    const start = t;
    tokens(s.text).forEach((w, wi) => {
      words.push({ i: words.length, sentenceId: s.id, wi, text: w, start: +t.toFixed(3), end: +(t + SYN.word - 0.03).toFixed(3) });
      t += SYN.word;
    });
    const st = { id: s.id, start: +(start - 0.06).toFixed(3), end: +t.toFixed(3) };
    t += SYN.gap;
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
  const ids = new Set();
  let nWords = 0;
  sb.sentences.forEach((s, i) => {
    if (!s.id || ids.has(s.id)) P.push(`sentence[${i}] needs a unique id`);
    ids.add(s.id);
    const n = tokens(s.text).length;
    nWords += n;
    if (n > 24) P.push(`sentence ${s.id} has ${n} words (max 24)`);
    if (/\d/.test(s.text)) P.push(`sentence ${s.id} contains digits; spell numbers out as spoken words (the visuals carry the digits)`);
  });
  if (nWords < WORDS[0] || nWords > WORDS[1]) P.push(`total narration is ${nWords} words; target ${WORDS[0]}-${WORDS[1]} (${opts.lengthSeconds || 45} s at ~215 wpm)`);
  if (sb.sentences.length < BANDS.sentences[0] || sb.sentences.length > BANDS.sentences[1]) P.push(`${sb.sentences.length} sentences; use ${BANDS.sentences[0]}-${BANDS.sentences[1]}`);
  if (!Array.isArray(sb.scaffolds) || !sb.scaffolds.length) return P.concat(["scaffolds[] missing"]);
  const PR = PROFILES[sb.profile] || PROFILES.DH;
  const genericOnly = new Set(PR.templates);
  sb.scaffolds.forEach((sc) => {
    if (!genericOnly.has(sc.template)) P.push(`scaffold ${sc.id}: template must be one of ${PR.templates.join("|")} for profile ${sb.profile}`);
    if (sb.profile === "LC" && !(sc.slots && sc.slots.title)) P.push(`scene ${sc.id}: every LC scene needs slots.title (and a subtitle)`);
    if (sb.profile === "DC") {
      if (!sc.chapter) P.push(`sub-state ${sc.id}: needs a chapter name`);
      if (!(sc.slots && (sc.slots.hero || (sc.slots.stage || []).length))) P.push(`sub-state ${sc.id}: needs slots.hero or one module in slots.stage`);
      if (!(sc.slots && sc.slots.panel)) P.push(`sub-state ${sc.id}: needs slots.panel (the info panel beside the mascot)`);
    }
    const mods = []
      .concat((sc.slots && sc.slots.top) || [])
      .concat((sc.slots && sc.slots.bottom) || [])
      .concat((sc.slots && sc.slots.stage) || []);
    mods.forEach((m) => {
      if (!MODULES[m.type]) P.push(`scaffold ${sc.id}: unknown module type "${m.type}"`);
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
  if (!((s0.top || []).length || (s0.stage || []).length || s0.hero)) P.push("the first scene needs a visual module in slots.top (R3: the full answer is on screen by 1.5 s) so frame 0 is not just text");
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
    const chrome = /^(hud|lchead|dcchrome|dcstage)$|_title$|_label$|_eyebrow$|_footer$/;
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

function catalogText() {
  const mods = Object.entries(MODULES)
    .filter(([k]) => !["browser", "console", "connector", "label"].includes(k))
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

function buildPrompt(topic, opts = {}) {
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
- Structure: hook (what/why in 1 sentence) -> the problem with a concrete scenario -> the mechanism step by step -> a failure/edge case or trade-off -> the payoff with a number -> a 1-sentence summary.
- Spell every number as spoken words in the narration ("two hundred forty milliseconds"); the visuals carry digits ("240 ms").
- Use realistic, internally consistent specifics (hostnames, IDs, versions, latencies, counts) and reuse them across scenes.

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
${Object.entries(TEMPLATE_DOCS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
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
- Structure: hook -> the concrete situation -> the mechanism step by step -> an edge case or trade-off -> the payoff -> a 1-sentence summary.
- Spell every number as spoken words in the narration; the visuals carry digits.
- Realistic, consistent specifics (hosts, IDs, paths, versions) reused across scenes.

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
  const r = await generate(`Three house styles exist for a 50-second tech explainer.
DH: dark dashboard world -- systems under load, incidents, traffic, deployments, infrastructure, attacks, performance, "how X works at scale".
LC: light editorial paper -- building a feature step by step, developer tools and workflows, protocols explained as a sequence of steps, data formats, "how to design X".
DC: dark chaptered documentary -- what a company / platform / product actually is and does, big concepts in named chapters, "what does X actually do".
TOPIC: ${topic}
Answer as JSON {"profile": "DH" | "LC" | "DC", "reason": "<one short clause>"}.`);
  return r && ["LC", "DH", "DC"].indexOf(r.profile) >= 0 ? r.profile : "DH";
}

function cadenceSummary(sb) {
  try {
    const tl = syntheticTimeline(sb);
    const spec = compileStoryboard(sb, tl, { mascot: false });
    const b = beats(spec);
    return `Measured on your storyboard: ${b.length} beats in ${tl.totalSeconds.toFixed(1)} s = ${((b.length / tl.totalSeconds) * 60).toFixed(0)} beats/min (target 70-90), ${spec.scaffolds.length} scaffolds, ${(sb.events || []).length} events. Make the smallest change that lands in the band.`;
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

function loadGemini() {
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
    model: process.env.GEMINI_MODEL || env.GEMINI_MODEL || "gemini-3.6-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
  });
  return async (prompt) => {
    const r = await model.generateContent(prompt);
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
      opts = { ...opts, profile: await chooseProfile(topic, generate) };
    } catch (err) {
      if (/(401|402|403)|credits are depleted|API key not valid|PERMISSION_DENIED/i.test(err.message)) throw new Error(`model unavailable (not retried): ${err.message}`);
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
    attempts.push({ problems });
    problems.forEach((p) => log(`  - ${p}`));
    if (!problems.length) return { storyboard: raw, attempts };
  }
  // last resort for pure cadence near-misses (long holds only): deterministic emphasis beats
  if (raw && problems.length && problems.every((p) => /^no visual change for/.test(p))) {
    const n = autoFillGaps(raw);
    const again = n ? validate(raw, opts) : problems;
    log(`auto-filled ${n} long hold(s) with emphasis beats; ${again.length} problem(s) left`);
    if (!again.length) return { storyboard: raw, attempts };
    problems = again;
  }
  const err = new Error(`storyboard still invalid after ${max} attempts: ${problems.join(" | ")}`);
  err.attempts = attempts;
  err.last = raw;
  throw err;
}

module.exports = { generateStoryboard, validate, buildPrompt, syntheticTimeline, BANDS, wordBand, autoFillGaps };
