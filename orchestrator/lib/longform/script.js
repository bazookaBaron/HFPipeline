"use strict";

/**
 * script.js (plan §4.3): outline + dossier -> script.json
 *   sections: cold open, chapters, recap; each {id, title, sentences: [{id, text, factIds, calc?}]}.
 * All sections are drafted in parallel (concurrency 3), then checked together (jargon first use
 * depends on script order); sections with problems are repaired and the whole script re-checked,
 * at most 3 repair rounds.
 */

const { pool } = require("./gemini");
const { sectionProblems, fkGrade, words } = require("./checks");
const { factDigest } = require("./outline");

const STYLE = `VOICE AND STYLE (this is spoken narration, read by a relaxed, warm narrator):
- Talk like a smart friend explaining over chai: "So here's the thing.", "Now, you might think...", "Okay, pause.".
  Relaxed, not hyped. Contractions are good. Vary sentence length, but keep EVERY sentence at 22 words or fewer, most 8-15.
- Very simple words. Grade 6-7 reading level. Prefer "money it owed" to "liabilities", "cheap" to "cost-effective".
  When a finance term is needed, say it and explain it in plain words in the SAME or the NEXT sentence
  ("That's called working capital. Basically, the cash a business needs to run day to day.").
- Example-led: after any abstract idea, make it concrete within two sentences with "imagine", "think of", "for example",
  using everyday Indian life (a chai stall, a family budget, an EMI on a phone, a kirana shop's khata, a Diwali sale).
  Carry the chapter's worked example through the explanation instead of piling up new ones.
- Comedy that actually lands: dry understatement ("Which, in hindsight, was a bold plan."), a deadpan narrator aside,
  rule of three with a twist, a punchline that is a short sentence on its own, and absurd-but-true comparisons whose
  numbers are COMPUTED from two fact values and declared in "calc" ("The interest bill was about nine times what the
  business earned."). About one light beat every 8-12 sentences, and at least two per chapter. Punch up at decisions
  and institutions; never mock private individuals, tragedy, job losses, ethnicity or religion.
- The running joke appears at most once per chapter and each callback must twist it a new way; never re-explain it,
  never stack two analogies in a row, and don't lean on it instead of explaining.
- Open each chapter differently (a question, a scene, a date, a blunt statement). Do not start with "So,". Do not repeat
  the chapter title as a question word for word.
- No superlatives ("biggest", "first ever", "record") unless a fact says so. Attribute allegations ("investigators
  alleged", "by one estimate"); do not state them as proven.
- Neutral and fair on countries, governments and people: describe decisions, incentives and trade-offs; include the other
  side when a point is contested; say "by one estimate" for low-confidence facts. No loaded labels.
- No investment advice (no buy/sell/should-invest). No "subscribe/like/follow/share" and no "in this video" or "welcome back".

NUMBERS (checked by a machine against the facts):
- Spell every number as words for the voice: "nine thousand crore rupees", "forty-two percent", "twenty twelve" or
  "two thousand twelve" for years, "one point two billion dollars". NEVER write digits.
- Round for the ear: at most two significant figures ("about nine thousand crore", "about fourteen thousand crore",
  "about four rupees", "around five percent"). Never say "point" followed by two digits. Indian rupee amounts use crore
  or lakh crore; every other currency (incl. Pakistani rupees, dollars, euros) uses million / billion / trillion. Keep
  one style for the same quantity across the whole script; never "seven thousand million".
- Only compare two figures directly when they measure the same kind of thing at comparable times; otherwise describe
  them separately. Do not draw conclusions the facts do not state (e.g. "the banks came out ahead").
- Fewer, bigger numbers: at most ONE figure per sentence (two only for a direct then-vs-now), and about six to eight
  figures per chapter. Pick the ones that move the story; say the rest in words ("it kept climbing", "roughly doubled").
  Right after a big figure, make it feel real with one comparison.
- Every number you say must be a FACT value (you may round it: 9,091 -> "about nine thousand") or a year from the facts/timeline,
  or the result of a calc, and the sentence must list that fact id in "factIds". Counting words one to ten are free.
- Indian scale words are welcome for rupee amounts (lakh, crore); keep the fact's currency.
- Comparisons: if you say a number you computed (e.g. "that's about twenty-five crore rupees a day"), add to that
  sentence "calc": [{"expr": "F12 / 365"}] using fact ids, + - * / ( ) and plain constants. A fact id stands for the
  fact's FULL value in base units (a fact "9000 INR crore" = 90,000,000,000 rupees; "38 %" = 38). The machine
  recomputes the expression and the number you say must match it (rounding is fine), so do the arithmetic carefully.
  Use calc also for unit conversions (F5 * F9 for dollars to rupees only if both are facts).
- Put the fact ids a sentence relies on in its "factIds".`;

function sectionBrief(outline, sec) {
  if (sec.id === "cold") {
    return `SECTION: COLD OPEN (about ${sec.words} words, 30-45 seconds). Start mid-story with the hook; no greeting.
Hook: ${sec.hook}
Beats: ${(sec.beats || []).join(" / ")}
Promise: ${sec.promise}
Set up the running joke: ${outline.runningJoke}
Fact ids to use: ${(sec.factIds || []).join(", ")}`;
  }
  if (sec.id === "recap") {
    return `SECTION: RECAP (about ${sec.words} words). Walk back through the takeaways in plain words, land the final callback to the cold open and the running joke, end on the closing line. No subscribe/follow call (a fixed ending is added later).
Takeaways: ${(sec.takeaways || []).join(" / ")}
Closing line idea: ${sec.closingLine}`;
  }
  return `SECTION: CHAPTER ${sec.index} "${sec.title}" (about ${sec.words} words, write between ${Math.round(sec.words * 0.9)} and ${Math.round(sec.words * 1.1)}).
Open with a one-line hand-off that frames the chapter question in plain words (the chapter card shows the title).
Question: ${sec.question}
Beats (in order, causal: what happened, why, what it led to): ${(sec.beats || []).join(" / ")}
Worked example to carry through: ${sec.example}
Comedic beat: ${sec.comedicBeat}
Running joke callback: ${sec.callback || "(none needed)"}
Fact ids to use (you may use others): ${(sec.factIds || []).join(", ")}`;
}

function scriptPrompt(dossier, outline, sec) {
  const map = [`Cold open: ${outline.coldOpen.hook}`, ...outline.chapters.map((c) => `Chapter ${c.index} "${c.title}": ${c.question}`), "Recap"].join("\n");
  return `You write one section of the narration for a YouTube deep-dive: "${outline.title}" (topic: ${dossier.topic}).
Angle: ${dossier.angle}
Running joke: ${outline.runningJoke}

WHOLE VIDEO MAP (for continuity; write ONLY your section):
${map}

FACTS (the only source of numbers and claims):
${factDigest(dossier)}

GLOSSARY (explain any of these in plain words, same or next sentence, the first time you use it):
${dossier.glossary.map((g) => `${g.term}: ${g.plain}`).join("\n")}

${STYLE}

${sectionBrief(outline, sec)}

Return JSON: {"sentences": [{"text": "...", "factIds": ["F3"], "calc": []}]}`;
}

function repairPrompt(dossier, outline, sec, current, problems) {
  return `${scriptPrompt(dossier, outline, sec)}

YOUR CURRENT DRAFT OF THIS SECTION:
${JSON.stringify({ sentences: current.sentences.map(({ id, text, factIds, calc }) => ({ id, text, factIds, calc })) })}

A checker found these problems. Rewrite the section so that none remain, keeping the tone, jokes and flow.
If a number cannot be matched to a fact, drop it or say it qualitatively ("a huge chunk", "most of it").
To lower the reading grade: split long sentences, swap long words for short everyday ones.
- ${problems.join("\n- ")}

Return the full corrected JSON: {"sentences": [{"text": "...", "factIds": [], "calc": []}]}`;
}

function normalizeSection(sec, raw) {
  const sentences = ((raw && raw.sentences) || []).filter((s) => s && String(s.text || "").trim()).map((s, i) => ({
    id: `${sec.id}-s${String(i + 1).padStart(2, "0")}`,
    text: String(s.text).replace(/\s+/g, " ").trim(),
    factIds: Array.isArray(s.factIds) ? s.factIds.map(String) : [],
    ...(Array.isArray(s.calc) && s.calc.length ? { calc: s.calc.filter((c) => c && c.expr) } : {}),
  }));
  return { id: sec.id, title: sec.id === "cold" ? "Cold open" : sec.id === "recap" ? "Recap" : sec.title, question: sec.question, words: sec.words, sentences };
}

function checkAll(sections, dossier) {
  const all = sections.flatMap((s) => s.sentences);
  return sections.map((s, i) => sectionProblems(s, {
    dossier, glossary: dossier.glossary, allSentences: all, wordBudget: s.words, isFirst: i === 0,
  }));
}

/**
 * @param {object} dossier
 * @param {object} outline
 * @param {{gemini, log?, maxRepairs?: number, concurrency?: number}} opts
 */
async function writeScript(dossier, outline, opts = {}) {
  const log = opts.log || (() => {});
  const g = opts.gemini;
  const secs = [outline.coldOpen, ...outline.chapters, outline.recap];
  let sections = await pool(secs, opts.concurrency || 3, async (sec) => {
    log(`script: drafting ${sec.id}`);
    return normalizeSection(sec, await g.json(scriptPrompt(dossier, outline, sec), { temperature: 0.9 }));
  });
  let problems = checkAll(sections, dossier);
  const history = [problems.map((p) => p.length)];
  // a repair can fix one thing and break two others: keep each section's best draft so far
  const best = sections.map((s, i) => ({ section: s, n: problems[i].length }));
  for (let round = 1; round <= (opts.maxRepairs ?? 3) && problems.some((p) => p.length); round++) {
    const todo = sections.map((s, i) => i).filter((i) => problems[i].length);
    log(`script: repair round ${round}: ${todo.map((i) => `${sections[i].id}(${problems[i].length})`).join(" ")}`);
    const fixed = await pool(todo, opts.concurrency || 3, async (i) => normalizeSection(secs[i], await g.json(repairPrompt(dossier, outline, secs[i], sections[i], problems[i]), { temperature: 0.6 })));
    todo.forEach((i, k) => { if (fixed[k].sentences.length) sections[i] = fixed[k]; });
    problems = checkAll(sections, dossier);
    history.push(problems.map((p) => p.length));
    sections.forEach((s, i) => { if (problems[i].length < best[i].n) best[i] = { section: s, n: problems[i].length }; });
  }
  if (sections.some((s, i) => best[i].section !== s)) {
    sections = best.map((b) => b.section);
    problems = checkAll(sections, dossier);
    history.push(problems.map((p) => p.length));
  }
  sections.forEach((s, i) => {
    s.stats = { words: s.sentences.reduce((a, x) => a + words(x.text).length, 0), fk: Number(fkGrade(s.sentences).toFixed(2)), sentences: s.sentences.length };
    s.problems = problems[i];
  });
  const totalWords = sections.reduce((a, s) => a + s.stats.words, 0);
  return {
    version: "lf-script.v1",
    topic: dossier.topic,
    title: outline.title,
    runningJoke: outline.runningJoke,
    sections,
    stats: {
      words: totalWords,
      estMinutes: Number((totalWords / outline.budget.wpm).toFixed(2)),
      wpm: outline.budget.wpm,
      fkMax: Math.max(...sections.map((s) => s.stats.fk)),
      problems: problems.reduce((a, p) => a + p.length, 0),
      repairHistory: history,
    },
  };
}

/** Readable script.md: sections, sentences, fact refs, and the source list. */
function scriptMarkdown(script, dossier) {
  const factById = Object.fromEntries(dossier.facts.map((f) => [f.id, f]));
  const L = [`# ${script.title}`, "", `Topic: ${script.topic}  `, `Words: ${script.stats.words} (~${script.stats.estMinutes} min at ${script.stats.wpm} wpm) · max FK grade ${script.stats.fkMax} · open problems ${script.stats.problems}  `, `Running joke: ${script.runningJoke}`, ""];
  script.sections.forEach((s) => {
    L.push(`## ${s.id === "cold" || s.id === "recap" ? s.title : `${s.id.replace("ch", "Chapter ")}: ${s.title}`}`);
    L.push(`*${s.stats.words} words · FK ${s.stats.fk}${s.question ? ` · ${s.question}` : ""}*`, "");
    s.sentences.forEach((x) => L.push(`${x.text}${x.factIds.length ? ` <sub>[${x.factIds.join(", ")}]</sub>` : ""}`));
    if (s.problems.length) L.push("", ...s.problems.map((p) => `> CHECK: ${p}`));
    L.push("");
  });
  const used = [...new Set(script.sections.flatMap((s) => s.sentences.flatMap((x) => x.factIds)))].filter((id) => factById[id]);
  L.push("## Facts used", "");
  used.forEach((id) => { const f = factById[id]; L.push(`- **${id}** ${f.claim} (${f.confidence}) - ${f.sources.map((s) => `[${s.title}](${s.url})`).join(", ")}`); });
  return L.join("\n") + "\n";
}

module.exports = { writeScript, scriptMarkdown, scriptPrompt, normalizeSection, checkAll, STYLE };
