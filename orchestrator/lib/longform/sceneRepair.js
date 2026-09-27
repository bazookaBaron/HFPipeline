"use strict";

/**
 * Scene-level storyboard repair (LONGFORM-V2-PLAN §9, cost). When every validation problem left after the
 * deterministic fixes (storyboardFix.js) belongs to a few scaffolds, the model gets ONLY those scaffolds, their
 * events and media, plus minimal context: the static catalog prompt (first, so Gemini's implicit cache hits), the
 * section's narration, the neighbouring scene ids, and facts / series / quotes only when the scenes show them.
 * The answer is spliced back in; every other scaffold stays byte-identical. Structural problems (narration,
 * chapter card, scene plan coverage, media share, beats/min, scene life, ...) still go to a whole-chapter repair.
 */

const clone = (x) => JSON.parse(JSON.stringify(x));

/** problems only a whole-chapter rewrite can fix */
const STRUCTURAL = [
  /^narration differs/,
  /^scaffolds\[\] missing/,
  /^the cold open starts with/,
  /^a chapter starts with/,
  /^never author lfEnd/,
  /^only the first scaffold may be/,
  /^scene plan: /,
  /is not a planned scene start/,
  /visual beats\/min/,
  /^real media visible/,
  /media scenes in a row/,
  /^no graphic-only scene/,
  /^scene life median/,
  /^a hold without a visual change/,
  /of the section's \d+ scenes/,
  /^rendered chapter/,
  /^model call failed/,
  /^media: /,
  /^renderer: /,
  /^media slot ".+" is declared but never used/,
];

function moduleIndex(sb) {
  const { fills } = require("./storyboardFix");
  const idx = {};
  fills(sb).forEach(({ sc, fill }) => fill.id && !idx[fill.id] && (idx[fill.id] = sc.id));
  return idx;
}

/**
 * The scaffold ids one problem is about, or null when it is structural / cannot be placed.
 * @returns {string[]|null}
 */
function problemScaffolds(sb, problem, cache = {}) {
  const p = String(problem || "");
  if (STRUCTURAL.some((rx) => rx.test(p))) return null;
  const scIds = new Set((sb.scaffolds || []).map((s) => s.id));
  const mods = cache.mods || (cache.mods = moduleIndex(sb));
  const clean = (x) => String(x || "").replace(/[:,.]+$/, "");
  const sc = (id) => (scIds.has(clean(id)) ? [clean(id)] : null);
  const mod = (id) => (mods[clean(id)] ? [mods[clean(id)]] : null);
  let m;
  if ((m = p.match(/^scaffolds (\S+) and (\S+) are both/))) return sc(m[2]);
  if ((m = p.match(/^scaffold (\S+?):/))) return sc(m[1]);
  if ((m = p.match(/^photo (\S+?)\/(\S+?) has no annotation/))) return sc(m[1]);
  if ((m = p.match(/^map (\S+?):/))) return mod(m[1]);
  if ((m = p.match(/^bigNumber (\S+?) \(count/))) return mod(m[1]);
  if ((m = p.match(/^zoomTo on (\S+?) /))) return mod(m[1]);
  if ((m = p.match(/^annotate .* on (\S+?)(?: \(point|: point)/))) return mod(m[1]);
  if ((m = p.match(/^event\[(\d+)\] \w+ on (\S+?):/))) return mod(m[2]);
  if ((m = p.match(/^event\[(\d+)\].*module not on screen/))) {
    const e = (sb.events || [])[Number(m[1])];
    const span = e && sentenceOwner(sb)[e.sentence];
    const owner = e && mods[String(e.target || "").split(".")[0]];
    const ids = [...new Set([span, owner].filter(Boolean))];
    return ids.length ? ids : null;
  }
  if ((m = p.match(/in scaffold (\S+?)(?::|$| )/))) return sc(m[1]);
  if ((m = p.match(/^no graphic over the photo for more than [\d.]+ s at (.+?): add/))) {
    const ids = [...new Set(m[1].split(/,\s*/).map((x) => clean(x.split(" @")[0])).filter((x) => scIds.has(x)))];
    return ids.length ? ids : null;
  }
  if ((m = p.match(/^slot "(.+?)" is used in a scaffold but not declared/))) {
    const { slotsIn } = scaffoldSlots();
    const ids = (sb.scaffolds || []).filter((s) => slotsIn(s.slots).has(m[1])).map((s) => s.id);
    return ids.length ? ids : null;
  }
  if ((m = p.match(/^media slot "(.+?)"/))) {
    const { slotsIn } = scaffoldSlots();
    const ids = (sb.scaffolds || []).filter((s) => slotsIn(s.slots).has(m[1])).map((s) => s.id);
    return ids.length ? ids : null;
  }
  if (/^layout /.test(p)) {
    const ids = [...p.matchAll(/(?:in|cards|and|diagram) ([A-Za-z][\w-]*):[a-z]/g)].map((x) => mods[x[1]]).filter(Boolean);
    return ids.length ? [...new Set(ids)] : null;
  }
  // "<scaffold>.<slot>[i]:type: ..." (composition, numbers, set-2 module schema, charts)
  if ((m = p.match(/^([A-Za-z][\w-]*)\.[A-Za-z]\w*(?:\[\d+\])?(?::\w+)?[:.\s]/))) return sc(m[1]);
  return null;
}

function scaffoldSlots() {
  const walk = (v, out = new Set()) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, out));
    else if (v && typeof v === "object") {
      if (typeof v.slot === "string") out.add(v.slot);
      Object.values(v).forEach((x) => walk(x, out));
    }
    return out;
  };
  return { slotsIn: walk };
}

function sentenceOwner(sb) {
  const { sentenceScaffold } = require("./storyboardFix");
  return sentenceScaffold(sb);
}

/**
 * Scene repair when the problems are local to at most max(2, half) of the scaffolds; else the whole chapter.
 * @returns {{mode: "scene", ids: string[], sentences: string[]} | {mode: "chapter", why: string}}
 */
function planRepair(sb, problems, opts = {}) {
  const n = (sb.scaffolds || []).length;
  if (!problems.length) return { mode: "chapter", why: "no problems" };
  if (n < 3) return { mode: "chapter", why: "too few scaffolds" };
  const cache = {};
  const ids = new Set();
  for (const p of problems) {
    const got = problemScaffolds(sb, p, cache);
    if (!got || !got.length) return { mode: "chapter", why: `structural: ${String(p).slice(0, 80)}` };
    got.forEach((x) => ids.add(x));
  }
  const max = opts.maxScenes || Math.max(2, Math.ceil(n * 0.5));
  if (ids.size > max) return { mode: "chapter", why: `${ids.size} of ${n} scenes fail` };
  const { scaffoldSentences } = require("./storyboardLF");
  const spans = scaffoldSentences(sb);
  const order = (sb.scaffolds || []).map((s) => s.id).filter((id) => ids.has(id));
  return { mode: "scene", ids: order, sentences: [...new Set(order.flatMap((id) => spans[id] || []))] };
}

const NUMERIC = new Set(["bigNumber", "barChart", "lineChart", "pictogramGrid", "compareCols", "barRace", "timeline", "eraTimeline"]);

/** the scene-repair prompt: static catalog first, then only what the failing scenes need */
function buildSceneRepairPrompt(ctx, sb, ids, sentences, problems) {
  const SL = require("./storyboardLF");
  const { fills, typeOf } = require("./storyboardFix");
  const { section, meta, topic } = ctx;
  const dossier = ctx.dossier || {};
  const set = new Set(ids);
  const sset = new Set(sentences);
  const failing = sb.scaffolds.filter((s) => set.has(s.id));
  const sub = { scaffolds: failing };
  const types = new Set(fills(sub).map(({ sc, key, fill }) => typeOf(sc, key, fill)));
  const slots = scaffoldSlots().slotsIn(failing.map((s) => s.slots));
  const probText = problems.join(" ");
  const needFacts = [...types].some((t) => NUMERIC.has(t)) || /number|figure|chart|fact|value/i.test(probText);
  const needSeries = SL.referencedSeries(sub).size > 0 || /series/i.test(probText);
  const needQuotes = types.has("quoteCard");
  const facts = (dossier.facts || []).map((f) => `${f.id}: ${f.claim}${f.value !== undefined ? ` [value ${f.value} ${f.unit || ""}${f.year ? `, ${f.year}` : ""}]` : ""}`).join("\n");
  const quotes = (dossier.quotes || []).map((q) => `${q.id || ""}: "${q.text || q.quote}" -- ${q.speaker || q.source || ""}${q.date ? `, ${q.date}` : ""}`).join("\n");
  const series = needSeries ? SL.dataSeriesLines(ctx) : "";
  const kinds = (s) => `${s.template}${SL.sceneKind(s) !== s.template ? `, ${SL.sceneKind(s)}` : ""}, from ${s.from}`;
  const all = sb.scaffolds;
  const neighbours = [];
  all.forEach((s, i) => {
    const near = set.has(s.id) || set.has((all[i - 1] || {}).id) || set.has((all[i + 1] || {}).id);
    if (near) neighbours.push(`- ${set.has(s.id) ? ">> FIX " : ""}${s.id} (${kinds(s)})`);
  });
  const otherMods = fills({ scaffolds: all.filter((s) => !set.has(s.id)) }).map(({ fill }) => fill.id).filter(Boolean);
  const otherSlots = (sb.mediaIntents || []).filter((it) => it && !slots.has(it.slot)).map((it) => `${it.slot}: ${it.kind}, ${it.intent}`);
  const plan = Array.isArray(ctx.plan) ? ctx.plan.filter((ps) => failing.some((s) => s.from === ps.from)) : [];
  const events = (sb.events || []).filter((e) => sset.has(e.sentence));
  const media = (sb.mediaIntents || []).filter((it) => it && slots.has(it.slot));
  return `${SL.staticPromptLF()}

======== SCENE REPAIR (the other scenes of this section passed validation and stay exactly as they are) ========
VIDEO TOPIC: ${topic}
SECTION: ${meta.kind === "cold" ? "COLD OPEN" : meta.kind === "recap" ? "RECAP" : `CHAPTER ${meta.index} of ${meta.count}: "${meta.title}"`}
NARRATION (FIXED; anchors copy words from it verbatim):
${section.sentences.map((s) => `${s.id}: ${s.text}`).join("\n")}
${needFacts ? `\nFACTS (the only source of on-screen numbers):\n${facts}\n` : ""}${series ? `\nDATA SERIES (reference as {"series": "<id>"}; never retype the values):\n${series}\n` : ""}${needQuotes && quotes ? `\nVERIFIED QUOTES (quoteCard text only from here, verbatim):\n${quotes}\n` : ""}
NEIGHBOURING SCENES (">> FIX" = the ones you return; the rest are context only):
${neighbours.join("\n")}
${plan.length ? `SCENE PLAN for the scenes you fix (hard: keep the planned template / hero):\n${SL.planLines(plan)}\n` : ""}Module ids used elsewhere in this section (do not reuse): ${otherMods.join(", ") || "none"}
Media slots declared elsewhere in this section (reuse a name only for the same picture): ${otherSlots.join(" | ") || "none"}

SCENES TO FIX (current JSON):
${JSON.stringify({ scaffolds: failing, events, media })}

IT FAILED VALIDATION:
${problems.map((p) => "- " + p).join("\n")}

Return ONLY {"scaffolds": [the ${ids.length} fixed scaffold(s), same "id" and "from"], "events": [ALL events on sentences ${sentences.join(", ")}; they replace the old ones], "media": [every media slot these scaffolds use]}. Keep everything that was valid; change only what the problems need.`;
}

/**
 * Splice a scene-repair answer into a copy of the storyboard: the named scaffolds are replaced (id / from kept),
 * the events on their sentences are replaced, returned media intents are upserted, unused intents pruned.
 * Throws when a scaffold is missing from the answer.
 */
function applySceneRepair(sb, raw, ids, sentences) {
  const out = clone(sb);
  const want = new Set(ids);
  const repl = new Map(((raw && raw.scaffolds) || []).filter((s) => s && typeof s === "object" && want.has(s.id)).map((s) => [s.id, s]));
  const missing = ids.filter((id) => !repl.has(id));
  if (missing.length) throw new Error(`scene repair did not return scaffold(s) ${missing.join(", ")}`);
  out.scaffolds = out.scaffolds.map((s) => (repl.has(s.id) ? { ...repl.get(s.id), id: s.id, from: s.from } : s));
  const sset = new Set(sentences);
  out.events = (out.events || []).filter((e) => !sset.has(e.sentence)).concat(((raw && raw.events) || []).filter((e) => e && typeof e === "object" && sset.has(e.sentence)));
  const media = Array.isArray(raw && raw.media) ? raw.media : Array.isArray(raw && raw.mediaIntents) ? raw.mediaIntents : [];
  const bySlot = new Map((out.mediaIntents || []).map((it, i) => [it && it.slot, i]));
  out.mediaIntents = out.mediaIntents || [];
  media.forEach((it) => {
    if (!it || typeof it.slot !== "string") return;
    if (bySlot.has(it.slot)) out.mediaIntents[bySlot.get(it.slot)] = it;
    else {
      bySlot.set(it.slot, out.mediaIntents.length);
      out.mediaIntents.push(it);
    }
  });
  const used = scaffoldSlots().slotsIn(out.scaffolds);
  out.mediaIntents = out.mediaIntents.filter((it) => it && used.has(it.slot));
  return out;
}

/** a storyboard back in the model's output shape (the base of a whole-chapter repair after local fixes) */
function rawOf(sb) {
  const pauses = {};
  (sb.sentences || []).forEach((s) => s.pauseAfter !== undefined && (pauses[s.id] = s.pauseAfter));
  return { scaffolds: sb.scaffolds, events: sb.events, media: sb.mediaIntents, ...(Object.keys(pauses).length ? { pauses } : {}) };
}

module.exports = { problemScaffolds, planRepair, buildSceneRepairPrompt, applySceneRepair, rawOf, STRUCTURAL };
