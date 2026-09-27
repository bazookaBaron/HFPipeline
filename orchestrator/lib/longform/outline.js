"use strict";

/**
 * outline.js (plan §4.2): dossier -> outline.json
 *   cold open + chapters + recap, with a word budget for the target minutes at the LF narration pace
 *   (160 wpm gross, lib/video/v3/pace.js PACE.LF: 10 min ~ 1,600 words, 3 min ~ 480 words), a running
 *   callback joke, and per chapter: title, question, beats, example/analogy, comedic beat, factIds,
 *   visual wishes, plus (LF v2) a required hook skeleton `hook` {chorus, anchorQuote, myth, stakesTour[3],
 *   ironyPivot, statDefinitionMetaphor, caseStudy, questionStack[3-4]} and per chapter metaphor / caseStudy /
 *   butTurn / cliffhanger (hookProblems + outlineProblems validate them). Short runs scale down (3 min = cold open + 3 short chapters + recap; YouTube needs
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
 * Word budget. The cold open carries the full hook skeleton (chorus -> anchor quote -> myth/reveal ->
 * 3-stop stakes tour -> irony pivot by ~0:45-1:00 -> stat/definition/metaphor -> case -> question stack):
 * about 22 % of the total, 180-250 words (~68-94 s). Recap ~45 s on full-length videos (10 %, never
 * under ~17 s), the rest split evenly over the chapters; totals always sum to round(minutes * wpm).
 */
const HOOK_MIN_WORDS = 180;
const HOOK_MAX_WORDS = 250;
function wordBudget(minutes, wpm = LF_WPM) {
  const m = Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Number(minutes) || 10));
  const total = Math.round(m * wpm);
  const coldOpen = Math.min(HOOK_MAX_WORDS, Math.max(HOOK_MIN_WORDS, Math.round(total * 0.22)));
  const recap = Math.min(Math.round((45 / 60) * wpm), Math.max(45, Math.round(total * 0.1)));
  const n = chapterCount(m);
  const rest = total - coldOpen - recap;
  const base = Math.floor(rest / n);
  const chapters = Array.from({ length: n }, (_, i) => base + (i < rest - base * n ? 1 : 0));
  return { minutes: m, wpm, total, coldOpen, recap, chapters };
}

/** short chapters (< ~60 s) get fewer beats / visuals / facts so the outline fits the words */
function isShort(budget) {
  return Math.min(...budget.chapters) < 130;
}

function factDigest(dossier) {
  return dossier.facts.map((f) => `${f.id} [${f.confidence}] ${f.claim}${f.value !== undefined ? ` (value ${f.value} ${f.unit || ""}${f.year ? `, ${f.year}` : ""})` : f.year ? ` (${f.year})` : ""}`).join("\n");
}

/** Hook facts and verbatim quotes from research (research.js finalizeHook / finalizeQuotes). */
function hookMaterial(dossier) {
  const h = dossier.hook || {};
  const L = [];
  if (h.belief) L.push(`COMMON BELIEF: ${h.belief.text} [${h.belief.factIds.join(", ")}]`);
  if (h.irony) L.push(`COUNTER-INTUITIVE FACT (the irony): ${h.irony.text} [${h.irony.factIds.join(", ")}]`);
  if ((h.stakes || []).length) L.push(`STAKES BY PLACE: ${h.stakes.map((s) => `${s.place} -> ${s.factId}`).join("; ")}`);
  if ((h.counterView || []).length) L.push(`COUNTER-VIEW FACTS (use them so conclusions stay balanced): ${h.counterView.join(", ")}`);
  const q = dossier.quotes || [];
  L.push(q.length
    ? `QUOTES (verbatim, sourced; the ONLY quotes the video may use):\n${q.map((x) => `${x.id}: "${x.text}" - ${x.speaker}${x.role ? `, ${x.role}` : ""}${x.year ? ` (${x.year})` : ""}`).join("\n")}`
    : "QUOTES: none (anchorQuote.quoteId must be null; do not invent quotes)");
  return `\nHOOK MATERIAL:\n${L.join("\n")}`;
}

const VIEWER = /\b(?:you|your|yours|yourself)\b/i;

/** Hook skeleton checks (LF v2 §1): every element present, facts real, 3 distinct places, last question about the viewer. */
function hookProblems(hook, dossier) {
  const p = [];
  if (!hook || typeof hook !== "object") return ["missing hook skeleton"];
  const facts = Object.fromEntries(((dossier && dossier.facts) || []).map((f) => [f.id, f]));
  const numeric = (id) => facts[id] && facts[id].value !== undefined && facts[id].value !== null;
  const known = (ids, tag) => (ids || []).filter((f) => !facts[f]).forEach((f) => p.push(`hook.${tag} cites unknown fact ${f}`));
  if (!hook.chorus || String(hook.chorus).split(/\s+/).length > 8) p.push("hook.chorus must be a short buzzword/belief fragment (1-8 words)");
  const quotes = (dossier && dossier.quotes) || [];
  const qid = hook.anchorQuote && hook.anchorQuote.quoteId;
  if (quotes.length && !quotes.some((q) => q.id === qid)) p.push(`hook.anchorQuote.quoteId must be one of ${quotes.map((q) => q.id).join(", ")}`);
  if (!quotes.length && qid) p.push("hook.anchorQuote.quoteId must be null: the dossier has no verified quotes");
  const m = hook.myth || {};
  if (!m.belief || !m.reveal) p.push("hook.myth needs belief and reveal");
  known(m.factIds, "myth");
  const st = hook.stakesTour || [];
  if (st.length !== 3) p.push(`hook.stakesTour needs exactly 3 stops, got ${st.length}`);
  const places = new Set(st.map((s) => String((s && s.place) || "").toLowerCase().trim()).filter(Boolean));
  if (places.size < Math.min(3, st.length)) p.push("hook.stakesTour stops must be 3 DIFFERENT places");
  st.forEach((s, i) => { if (!s || !numeric(s.factId)) p.push(`hook.stakesTour[${i}] needs a numeric factId (place + number + year)`); });
  const ip = hook.ironyPivot || {};
  if (!ip.thesis) p.push("hook.ironyPivot needs a thesis");
  if (!(ip.factIds || []).length) p.push("hook.ironyPivot needs 1+ factIds");
  known(ip.factIds, "ironyPivot");
  const sdm = hook.statDefinitionMetaphor || {};
  if (!numeric(sdm.factId) || !sdm.definition || !sdm.metaphor) p.push("hook.statDefinitionMetaphor needs a numeric factId, a definition and a metaphor");
  const cs = hook.caseStudy || {};
  if (!cs.name || !(cs.factIds || []).length) p.push("hook.caseStudy needs a name and 1+ factIds");
  known(cs.factIds, "caseStudy");
  const qs = hook.questionStack || [];
  if (qs.length < 3 || qs.length > 4) p.push(`hook.questionStack needs 3-4 questions, got ${qs.length}`);
  if (qs.some((q) => !/\?\s*$/.test(String(q)))) p.push("hook.questionStack entries must be questions ending in '?'");
  if (qs.length && !VIEWER.test(String(qs[qs.length - 1]))) p.push("hook.questionStack: the LAST question must be about the viewer (you / your)");
  return p;
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
${hookMaterial(dossier)}

Return JSON:
{"title": "<video title, <= 60 chars, curiosity-led, no clickbait lies>",
 "hook": <hook skeleton, see HOOK SKELETON below>,
 "runningJoke": "<one simple running gag set up in the cold open, called back in 3+ chapters and the recap, that gets funnier as the story gets worse: a recurring imaginary character reacting (e.g. 'Sharma ji, who lent the money, checking his phone'), a running tally, or one image tied to the topic itself. Not a mixed metaphor, not an analogy that needs re-explaining>",
 "coldOpen": {"hook": "<the most surprising tension, in one line>", "beats": ["..."], "promise": "<what the viewer will understand by the end>", "factIds": ["F1"], "visuals": [<visual>]},
 "chapters": [{"id": "ch1", "title": "<2-5 words>", "question": "<the one question this chapter answers>",
   "beats": ["<${isShort(budget) ? "2-3" : "4-6"} causal story beats, in order>"],
   "example": "<one concrete worked example or analogy from everyday life that any viewer worldwide recognises (a coffee stand, a family budget, a phone bought on instalments, a credit-card bill, a corner shop's tab); local colour from the story's own country is welcome when it is explained that maps onto the mechanism>",
   "comedicBeat": "<one light, self-aware joke or absurd-but-true comparison; comparisons must be computable from fact values, say which>",
   "callback": "<how the running joke appears here, or empty>",
   "metaphor": "<one physical, everyday metaphor for this chapter's key mechanism (like 'a nail driven into frozen wood'), that can be extended>",
   "caseStudy": "<one real, named case (a company, city, family type, deal) with its fact ids that proves the abstraction>",
   "butTurn": "<the 'but' twist in the middle of the chapter: what complicates or reverses the obvious reading>",
   "cliffhanger": "<an open question ending the chapter that the NEXT chapter's question answers; the last chapter's cliffhanger leads into the recap>",
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

HOOK SKELETON (the cold open follows it in this order; it is the most important part of the video):
{"chorus": "<the buzzword or the common belief as a 1-4 word fragment that everyone repeats, e.g. 'Lost decades.'>",
 "anchorQuote": {"quoteId": "<Q id from QUOTES, or null when there are no quotes>"},
 "myth": {"belief": "<what most people think>", "reveal": "<what they don't realise, carried by a number>", "factIds": ["F.."]},
 "stakesTour": [{"place": "<country/region>", "factId": "F..", "line": "<one plain line: place + number + year>"}] (exactly 3, three DIFFERENT places, escalating; use a spread of world regions),
 "ironyPivot": {"thesis": "<'But the irony is...' the counter-intuitive thesis of the whole video, in one line>", "factIds": ["F.."]},
 "statDefinitionMetaphor": {"factId": "F..", "definition": "<the key term or stat in plain words>", "metaphor": "<everyday physical picture>"},
 "caseStudy": {"name": "<a real, named example>", "place": "<where>", "factIds": ["F.."]},
 "questionStack": ["<3-4 open questions the video will answer; the LAST one is about the viewer: what this means for you, your money, your job or your prices, anywhere in the world>"]}
The irony pivot must land within the first 45-60 seconds of narration. CHAPTERS then follow a mini version: open question ->
story/example -> numbers + metaphor -> "but" turn -> cliffhanger question answered in the next chapter.

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
  hookProblems(o.hook, dossier).forEach((x) => p.push(x));
  if (!o.runningJoke) p.push("missing runningJoke");
  if (!o.coldOpen || !o.coldOpen.hook || !(o.coldOpen.beats || []).length) p.push("coldOpen needs hook and beats");
  const ch = o.chapters || [];
  if (ch.length !== budget.chapters.length) p.push(`need exactly ${budget.chapters.length} chapters, got ${ch.length}`);
  let callbacks = 0;
  const allFactIds = new Set();
  ch.forEach((c, i) => {
    const tag = c.id || `chapter ${i + 1}`;
    ["title", "question", "example", "comedicBeat", "metaphor", "caseStudy", "butTurn"].forEach((k) => { if (!c[k]) p.push(`${tag} missing ${k}`); });
    if (i < ch.length - 1 && !/\?\s*$/.test(String(c.cliffhanger || ""))) p.push(`${tag} needs a cliffhanger question (ending in '?') that the next chapter answers`);
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
  const h = o.hook || {};
  const hookFacts = [...((h.myth || {}).factIds || []), ...(h.stakesTour || []).map((s) => s && s.factId), ...((h.ironyPivot || {}).factIds || []),
    (h.statDefinitionMetaphor || {}).factId, ...((h.caseStudy || {}).factIds || [])].filter(Boolean);
  o.coldOpen = { ...o.coldOpen, id: "cold", words: budget.coldOpen, factIds: [...new Set([...((o.coldOpen || {}).factIds || []), ...hookFacts])] };
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

module.exports = { wordBudget, chapterCount, outlineProblems, hookProblems, hookMaterial, finalizeOutline, makeOutline, outlinePrompt, factDigest, isShort, LF_WPM, MIN_MINUTES, MAX_MINUTES, HOOK_MIN_WORDS, HOOK_MAX_WORDS };
