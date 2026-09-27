"use strict";

/**
 * outline.js (plan §4.2): dossier -> outline.json
 *   cold open + chapters + recap, with a word budget for the target minutes at the LF narration pace
 *   (160 wpm gross, lib/video/v3/pace.js PACE.LF: 10 min ~ 1,600 words, 3 min ~ 480 words), a running
 *   callback joke, and per chapter: title, question, beats, example/analogy, comedic beat, factIds,
 *   visual wishes. Short runs scale down (3 min = cold open + 3 short chapters + recap; YouTube needs
 *   >= 3 chapters of >= 10 s each).
 * Validated deterministically; up to 3 repair rounds.
 */

const LF_WPM = 160;
const MIN_MINUTES = 2;
const MAX_MINUTES = 20;

/** Chapter count for the target length: <= 4 min -> 3, <= 6 -> 4, <= 7 -> 5, <= 9 -> 6, <= 11 -> 7, else 8. */
function chapterCount(minutes) {
  return minutes <= 4 ? 3 : minutes <= 6 ? 4 : minutes <= 7 ? 5 : minutes <= 9 ? 6 : minutes <= 11 ? 7 : 8;
}

/**
 * Word budget. Cold open ~40 s and recap ~45 s on full-length videos, scaled down on short ones
 * (about 10 % of the total each, never under ~17 s), the rest split evenly over the chapters;
 * totals always sum to round(minutes * wpm).
 */
function wordBudget(minutes, wpm = LF_WPM) {
  const m = Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Number(minutes) || 10));
  const total = Math.round(m * wpm);
  const coldOpen = Math.min(Math.round((40 / 60) * wpm), Math.max(45, Math.round(total * 0.1)));
  const recap = Math.min(Math.round((45 / 60) * wpm), Math.max(45, Math.round(total * 0.1)));
  const n = chapterCount(m);
  const rest = total - coldOpen - recap;
  const base = Math.floor(rest / n);
  const chapters = Array.from({ length: n }, (_, i) => base + (i < rest - base * n ? 1 : 0));
  return { minutes: m, wpm, total, coldOpen, recap, chapters };
}

/** short chapters (< ~60 s) get fewer beats / visuals / facts so the outline fits the words */
function isShort(budget) {
  return Math.min(...budget.chapters) < 160;
}

function factDigest(dossier) {
  return dossier.facts.map((f) => `${f.id} [${f.confidence}] ${f.claim}${f.value !== undefined ? ` (value ${f.value} ${f.unit || ""}${f.year ? `, ${f.year}` : ""})` : f.year ? ` (${f.year})` : ""}`).join("\n");
}

function outlinePrompt(dossier, budget) {
  const n = budget.chapters.length;
  return `You outline a ${budget.minutes}-minute YouTube deep-dive (16:9, no presenter on screen, narrated) for curious viewers worldwide aged 18-35 with no finance background (a global English-speaking audience).
Topic: "${dossier.topic}"
Angle: ${dossier.angle}
Summary: ${dossier.summary}

FACTS (the ONLY numbers and claims you may use; cite by id):
${factDigest(dossier)}

TIMELINE: ${dossier.timeline.map((t) => `${t.year}: ${t.event}`).join(" | ")}
ENTITIES: ${dossier.entities.map((e) => `${e.name} (${e.kind})`).join(", ")}
GLOSSARY: ${dossier.glossary.map((g) => g.term).join(", ")}
DATA ASKS: ${dossier.dataAsks.map((d) => d.metric + (d.worldBankIndicator ? ` [${d.worldBankIndicator}]` : "")).join("; ")}

Return JSON:
{"title": "<video title, <= 60 chars, curiosity-led, no clickbait lies>",
 "runningJoke": "<one simple running gag set up in the cold open, called back in 3+ chapters and the recap, that gets funnier as the story gets worse: a recurring imaginary character reacting (e.g. 'Sharma ji, who lent the money, checking his phone'), a running tally, or one image tied to the topic itself. Not a mixed metaphor, not an analogy that needs re-explaining>",
 "coldOpen": {"hook": "<the most surprising tension, in one line>", "beats": ["..."], "promise": "<what the viewer will understand by the end>", "factIds": ["F1"], "visuals": [<visual>]},
 "chapters": [{"id": "ch1", "title": "<2-5 words>", "question": "<the one question this chapter answers>",
   "beats": ["<${isShort(budget) ? "2-3" : "4-6"} causal story beats, in order>"],
   "example": "<one concrete worked example or analogy from everyday life that any viewer worldwide recognises (a coffee stand, a family budget, a phone bought on instalments, a credit-card bill, a corner shop's tab); local colour from the story's own country is welcome when it is explained that maps onto the mechanism>",
   "comedicBeat": "<one light, self-aware joke or absurd-but-true comparison; comparisons must be computable from fact values, say which>",
   "callback": "<how the running joke appears here, or empty>",
   "factIds": ["F3", "F7"],
   "visuals": [<visual>]}],
 "recap": {"takeaways": ["<3-5 plain takeaways>"], "closingLine": "<callback to the cold open; no subscribe/follow CTA>", "factIds": []}}

<visual> is one of:
 {"type": "photo", "entity": "<concrete named entity from ENTITIES>", "intent": "<what the photo shows, concrete nouns + place + era, e.g. 'Kingfisher Airlines Airbus A320 at Mumbai airport, 2008'>"}
 {"type": "chart", "metric": "...", "factIds": ["F.."], "worldBankIndicator": "<code or omit>"}
 {"type": "map", "region": "<country/region>", "highlight": ["..."], "note": "<what the map shows>"}
 {"type": "headline", "publisher": "<publication named in the sources>", "year": <year>, "gist": "<headline gist, not a quote>"}
 {"type": "number", "factId": "F..", "context": "..."}
 {"type": "illustration", "intent": "<concept/joke art, never a real person or real event>"}

Rules:
- Exactly ${n} chapters that build one causal story from the start to now; each chapter answers a different question. No filler chapters.
- Length: the whole narration is about ${budget.total} words (${budget.minutes} min): cold open ~${budget.coldOpen}, each chapter ~${budget.chapters[0]}, recap ~${budget.recap} words.${isShort(budget) ? " This is a SHORT video: keep each chapter to one idea, 2-3 beats and 2-3 key numbers." : ""}
- Every chapter uses 2+ fact ids and has ${isShort(budget) ? "2-3" : "3-5"} visuals incl. at least one photo of a named entity; the video overall needs charts/numbers too.
- Neutral and fair on countries, governments and people: explain decisions and trade-offs, give both sides of contested points, say "by one estimate" for low-confidence facts.
- Comedy is light satire of decisions and situations; never mock private individuals, tragedy, job losses, ethnicity or religion.
- No investment advice. No subscribe/like/follow calls anywhere.`;
}

const VISUAL_TYPES = ["photo", "chart", "map", "headline", "number", "illustration"];

function outlineProblems(o, dossier, budget) {
  const p = [];
  const ids = new Set(dossier.facts.map((f) => f.id));
  if (!o || typeof o !== "object") return ["outline is not an object"];
  if (!o.title) p.push("missing title");
  if (!o.runningJoke) p.push("missing runningJoke");
  if (!o.coldOpen || !o.coldOpen.hook || !(o.coldOpen.beats || []).length) p.push("coldOpen needs hook and beats");
  const ch = o.chapters || [];
  if (ch.length !== budget.chapters.length) p.push(`need exactly ${budget.chapters.length} chapters, got ${ch.length}`);
  let callbacks = 0;
  const allFactIds = new Set();
  ch.forEach((c, i) => {
    const tag = c.id || `chapter ${i + 1}`;
    ["title", "question", "example", "comedicBeat"].forEach((k) => { if (!c[k]) p.push(`${tag} missing ${k}`); });
    const minBeats = isShort(budget) ? 2 : 3;
    if ((c.beats || []).length < minBeats) p.push(`${tag} needs ${minBeats}+ beats`);
    const fids = c.factIds || [];
    if (fids.length < 2) p.push(`${tag} needs 2+ factIds`);
    fids.filter((f) => !ids.has(f)).forEach((f) => p.push(`${tag} cites unknown fact ${f}`));
    fids.forEach((f) => allFactIds.add(f));
    const vis = c.visuals || [];
    if (vis.length < 2) p.push(`${tag} needs 2+ visuals`);
    vis.forEach((v) => { if (!VISUAL_TYPES.includes(v && v.type)) p.push(`${tag} has visual of unknown type ${v && v.type}`); });
    if (!vis.some((v) => v && v.type === "photo" && v.entity)) p.push(`${tag} needs a photo visual naming a concrete entity`);
    if (c.callback) callbacks++;
  });
  const needCallbacks = ch.length >= 5 ? 3 : 2;
  if (callbacks < needCallbacks) p.push(`running joke called back in ${callbacks} chapters; need ${needCallbacks}+`);
  if (!o.recap || (o.recap.takeaways || []).length < 3) p.push("recap needs 3-5 takeaways");
  if (!ch.some((c) => (c.visuals || []).some((v) => v.type === "chart" || v.type === "number"))) p.push("no chart/number visuals in the whole video");
  if (allFactIds.size < Math.min(12, ids.size, 3 * budget.chapters.length)) p.push(`chapters cite only ${allFactIds.size} distinct facts; use more of the dossier`);
  return p;
}

/** Attach ids and word budgets deterministically. */
function finalizeOutline(o, dossier, budget) {
  o.chapters = (o.chapters || []).map((c, i) => ({ ...c, id: `ch${i + 1}`, index: i + 1, words: budget.chapters[i] }));
  o.coldOpen = { ...o.coldOpen, id: "cold", words: budget.coldOpen };
  o.recap = { ...o.recap, id: "recap", words: budget.recap };
  o.topic = dossier.topic;
  o.budget = budget;
  return o;
}

async function makeOutline(dossier, opts = {}) {
  const log = opts.log || (() => {});
  const budget = wordBudget(opts.minutes || 10);
  const g = opts.gemini;
  let raw = null, problems = [];
  for (let i = 0; i < 4; i++) {
    const prompt = raw
      ? `${outlinePrompt(dossier, budget)}\n\nYOUR PREVIOUS OUTLINE:\n${JSON.stringify(raw)}\n\nFix these problems and return the full corrected JSON:\n- ${problems.join("\n- ")}`
      : outlinePrompt(dossier, budget);
    log(`outline attempt ${i + 1}${problems.length ? ` (fixing ${problems.length})` : ""}`);
    raw = await g.json(prompt, { temperature: 0.8, task: "longform.outline" });
    problems = outlineProblems(raw, dossier, budget);
    problems.forEach((x) => log(`  - ${x}`));
    if (!problems.length) break;
  }
  const o = finalizeOutline(raw, dossier, budget);
  o.problems = problems;
  return o;
}

module.exports = { wordBudget, chapterCount, outlineProblems, finalizeOutline, makeOutline, outlinePrompt, factDigest, isShort, LF_WPM, MIN_MINUTES, MAX_MINUTES };
