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

const EXAMPLE_PATH = path.join(__dirname, "..", "..", "..", "fixtures", "v3", "cdn-dh.json");

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
  const genericOnly = new Set(["opener", "stack", "hero"]);
  sb.scaffolds.forEach((sc) => {
    if (!genericOnly.has(sc.template)) P.push(`scaffold ${sc.id}: template must be one of opener|stack|hero`);
    const mods = []
      .concat((sc.slots && sc.slots.top) || [])
      .concat((sc.slots && sc.slots.bottom) || []);
    mods.forEach((m) => {
      if (!MODULES[m.type]) P.push(`scaffold ${sc.id}: unknown module type "${m.type}"`);
      if (!m.id) P.push(`scaffold ${sc.id}: every module in top/bottom needs an id (events target it)`);
      const p = m.props || {};
      if (m.type === "nodes") {
        (p.nodes || []).forEach((n) => {
          if (!(n.x >= 0.1 && n.x <= 0.9 && n.y >= 0.1 && n.y <= 0.86)) P.push(`${m.id}: node ${n.id} x/y out of range`);
          if (n.icon && ICONS.indexOf(n.icon) < 0) P.push(`${m.id}: node ${n.id} icon "${n.icon}" not in the icon set`);
        });
      }
      if (m.type === "panel" && (p.rows || []).length > 6) P.push(`${m.id}: panel has more than 6 rows`);
    });
  });
  if (sb.scaffolds[0].template !== "opener") P.push("the first scaffold must be an opener (hook headline)");
  // density: refs fill 20-40% of the frame with 2-5 modules; a lone small card reads as empty
  const { preferred } = require("./templates-generic");
  sb.scaffolds.forEach((sc) => {
    if (sc.template !== "stack") return;
    const w = sc.layout === "full" ? 960 : 690;
    const mods = [].concat((sc.slots && sc.slots.top) || [], (sc.slots && sc.slots.bottom) || []);
    const h = mods.reduce((a, m) => a + (m.h || preferred(m, w)), 0) + Math.max(0, mods.length - 1) * 19;
    if (mods.length && h < 380) P.push(`scaffold ${sc.id}: only ${Math.round(h)} px of content; add a second module (kpis, note, panel, stat) so the block is at least 380 px`);
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
    const ops = mod === "hud" ? Object.assign({}, HUD.ops, knownOps("hud")) : knownOps(type);
    if (!ops[e.op]) P.push(`event[${i}] op "${e.op}" is not available on ${mod} (${type}); allowed: ${Object.keys(ops).join(", ")}`);
  });
  // cadence (SPEC 7.1, DH)
  const b = beats(spec);
  const T = tl.totalSeconds;
  const bpm = (b.length / T) * 60;
  const gaps = [0].concat(b).map((x, i, a) => (i + 1 < a.length ? [a[i + 1] - x, x] : [T - x, x]));
  const worst = gaps.reduce((m, g) => (g[0] > m[0] ? g : m), [0, 0]);
  if (bpm < BANDS.bpm[0]) P.push(`only ${bpm.toFixed(0)} visual beats/min; add word-anchored events (target ${BANDS.bpm[0]}-${BANDS.bpm[1]})`);
  if (bpm > BANDS.bpm[1]) P.push(`${bpm.toFixed(0)} beats/min is too busy (max ${BANDS.bpm[1]})`);
  if (worst[0] > BANDS.maxGap) {
    const s = tl.sentenceTimes.find((st) => st.start <= worst[1] + worst[0] && st.end >= worst[1]);
    P.push(`no visual change for ${worst[0].toFixed(1)} s starting at ${worst[1].toFixed(1)} s (around sentence ${s ? s.id : "?"}); add an event or a new scaffold there (max ${BANDS.maxGap} s)`);
  }
  const lives = spec.scaffolds.map((s) => s.t1 - s.t0).sort((a, c) => a - c);
  const med = lives[Math.floor(lives.length / 2)];
  if (med > BANDS.lifeMedian[1]) P.push(`scaffolds last ${med.toFixed(1)} s (median); change scaffold every 3-6 s`);
  const evSent = new Set((sb.events || []).map((e) => e.sentence));
  sb.sentences.slice(1, -1).forEach((s) => {
    if (!evSent.has(s.id) && !sb.scaffolds.some((sc) => sc.from === s.id)) P.push(`sentence ${s.id} has no event and starts no scaffold`);
  });
  return P;
}

function catalogText() {
  const mods = Object.entries(MODULES)
    .filter(([k]) => !["browser", "console", "connector", "label"].includes(k))
    .map(([k, m]) => `- ${k}: ${m.use}\n    props ${m.props}` + (Object.keys(m.ops || {}).length ? `\n    ops ${Object.entries(m.ops).map(([o, d]) => `${o} ${d}`).join("; ")}` : "") + (m.entities ? `\n    sub-targets ${m.entities}` : ""))
    .join("\n");
  return mods;
}

function buildPrompt(topic, opts = {}) {
  const example = fs.readFileSync(EXAMPLE_PATH, "utf-8");
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
- Put hidden:true / lit:false / drawn:false on things that should appear on words, and the matching event on the word.
- A module persists across consecutive scaffolds only if it has the same id; otherwise ids are unique.

TEMPLATES
${Object.entries(TEMPLATE_DOCS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
(the section label goes in slots.label {props:{text, tone?}}, 1-3 caps words like "THE PROBLEM", "CACHE MISS")

MODULES (type -> use, props, ops)
${catalogText()}

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
      continue;
    }
    if (raw && !raw.version) raw.version = "storyboard.v3";
    if (raw && !raw.profile) raw.profile = "DH";
    problems = validate(raw, opts);
    attempts.push({ problems });
    problems.forEach((p) => log(`  - ${p}`));
    if (!problems.length) return { storyboard: raw, attempts };
  }
  const err = new Error(`storyboard still invalid after ${max} attempts: ${problems.join(" | ")}`);
  err.attempts = attempts;
  err.last = raw;
  throw err;
}

module.exports = { generateStoryboard, validate, buildPrompt, syntheticTimeline, BANDS, wordBand };
