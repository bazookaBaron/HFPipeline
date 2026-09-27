"use strict";

/**
 * script.js (plan §4.3, LF v2 §1): outline + dossier -> script.json
 * All sections are drafted in parallel (concurrency 3, pro tier), then deterministically fixed (style.js:
 * long-sentence splitter, tag defaults) and checked together (jargon first use depends on script order);
 * only sections with problems are re-sent for repair (standard tier), at most 3 rounds.
 *
 * script.json schema (version "lf-script.v2"); tags come from the SAME pro call as the text:
 *   {version, topic, title, runningJoke,
 *    hook:        outline.hook skeleton {chorus, anchorQuote:{quoteId}, myth, stakesTour[3], ironyPivot,
 *                 statDefinitionMetaphor, caseStudy, questionStack[3-4]},
 *    montageLines: [{text, factIds}]  5-7 punchy hook lines, each <= 10 words        -> montage stage (WS-E)
 *    anchorLine:   {text, quoteId|null} the line the montage ends on (verbatim if it quotes)
 *    sections: [{id: "cold"|"chN"|"recap", title, question, words,
 *                mood: tension|investigative|dread|hopeful|playful|calm|triumphant  -> music plan (WS-D)
 *                energy: 1-5                                                         -> music / sfx (WS-D)
 *                sentences: [{id, text, factIds, calc?,
 *                             visual: geo|number|trend|compare|quote|person|event|concept|joke  -> variety planner (WS-C)
 *                             devices: [chorus|quote|myth|reveal|stakes|irony|stat|definition|metaphor|case|
 *                                       question|pivot|cliffhanger|joke|callback],  (style gates)
 *                             quoteId?: "Q1" (dossier.quotes, verbatim + non-UGC source)}],
 *                stats: {words, fk, sentences, medianWords}, problems: [], autoFix: {splits, tagNotes}}],
 *    stats: {words, estMinutes, wpm, fkMax, problems, repairHistory}}
 * Missing/invalid mood, energy or visual are filled deterministically (style.fillTags), never repaired.
 */

const { pool } = require("./gemini");
const { sectionProblems, fkGrade, words } = require("./checks");
const { factDigest } = require("./outline");
const { checkSentenceNumbers, parseSpokenNumbers } = require("./numbers");
const { MOODS, DEVICES, splitLongSentences, mergeDanglingLeads, fillTags, styleProblems, montageProblems, lengthStats, quotedSpans } = require("./style");

const SCRIPT_VERSION = "lf-script.v2";

const STYLE = `VOICE (spoken narration for a relaxed, warm narrator; a smart friend explaining the world over coffee):
- SHORT sentences. Most are 6-12 words; fragments are welcome for punch ("Lost decades." "Zero growth."). One idea per
  sentence. NEVER more than 20 words in a sentence. Contractions are good. Relaxed, not hyped.
- Short, but never telegraphic: keep articles and little linking words ("so", "and", "because", "which is why") so it
  flows like someone talking. Never a bare noun phrase a viewer can't picture ("Indirect bank borrowing drove funding."
  is wrong; "Companies didn't sell shares. They borrowed from their bank." is right).
- Talk TO the viewer, at least once every five or six sentences: "you", "look at this", "imagine", "here's the thing",
  "think about that", "so the question is", "people," / "guys," (sparingly). Conversation, not a lecture.
- Pivots drive the story. A turn every 30-40 seconds (every six or seven sentences): "But...", "And while most people
  think X, what they don't realise is...", "The irony is...", "Here's the catch.", "So the question is...".
- Big claims are anchored by a number, a place and a time (few numbers, well chosen: see NUMBERS FOR THE EAR) ("by twenty fifty", "in the summer of twenty twenty-two", "since
  two thousand"). No vague adjectives where a figure exists.
- Every hard concept gets three steps: (1) a one-line plain definition; (2) a physical, everyday metaphor, then extend it
  once ("like a nail in frozen wood. Now the wood turns to mud."); (3) a real, named example that proves it.
- Rhythm: once per section you may use a short rhythmic list with a repeated word ("every shop, every salary, every
  savings account") and land it with a short punch line.
- Very simple words. Grade 5-7 reading level. Prefer "money it owed" to "liabilities", "cheap" to "cost-effective".
  When a finance term is needed, say it and explain it in plain words in the SAME or the NEXT sentence.
- Example-led, global: after any abstract idea, make it concrete within two sentences with something any viewer anywhere
  knows (a coffee, a phone on instalments, rent, a salary, a supermarket bill, a credit-card statement). Explain any local
  term or institution in plain words. Carry one example through instead of piling up new ones.
- Comedy, a little and dry: deadpan asides, understatement ("Which, in hindsight, was a bold plan."), rule of three with a
  twist, a punchline as its own short sentence, absurd-but-true comparisons whose numbers are COMPUTED from fact values and
  declared in "calc". At least one light beat in the cold open and two per chapter, each tagged "joke". Punch up at decisions and institutions; never mock private
  individuals, tragedy, job losses, ethnicity or religion.
- The running joke appears at most once per chapter and each callback twists it a new way; never re-explain it.
- Quotes: ONLY the verbatim QUOTES listed below, word for word inside double quotes, introduced by who said it and when
  ("In twenty nineteen, the IMF's chief put it bluntly: "..."). Never invent, polish or paraphrase inside quotation marks.
- Do not start with "So,". No superlatives ("biggest", "first ever", "record") unless a fact says so. Attribute allegations
  ("by one estimate", "critics say"); do not state them as proven.
- Neutral and fair on countries, governments and people: describe decisions, incentives and trade-offs; give the other
  side when a point is contested (use the counter-view facts). No loaded labels.
- No investment advice. No "subscribe/like/follow/share", no "in this video", no "welcome back".

NUMBERS FOR THE EAR (the screen shows the exact digits; the voice speaks like a person):
- Say numbers the way a person would: "about one percent a year", "three out of five", "almost a quarter", "roughly
  doubled", "barely shrank". Never "zero point three percent"; no decimals in the cold open, at most one per chapter.
- At most one number every two or three sentences. Between numbers, give a picture: who, where, what it looks like.
  A hook that reads like a list of numbers fails.

NUMBERS (checked by a machine against the facts):
- Spell every number as words for the voice: "ninety billion rupees", "forty-two percent", "twenty twelve" or
  "two thousand twelve" for years, "one point two billion dollars". NEVER write digits.
- Round for the ear: at most two significant figures ("about ninety billion rupees", "about one point four billion dollars",
  "about four rupees", "around five percent"). Never say "point" followed by two digits. The audience is global: EVERY
  currency (rupees, dollars, euros, yuan...) uses million / billion / trillion, never lakh or crore. Keep
  one style for the same quantity across the whole script; never "seven thousand million".
- Only compare two figures directly when they measure the same kind of thing at comparable times; otherwise describe
  them separately. Do not draw conclusions the facts do not state (e.g. "the banks came out ahead").
- Fewer, bigger numbers: at most ONE figure per sentence (two only for a direct then-vs-now), and about six to eight
  figures per chapter. Pick the ones that move the story; say the rest in words ("it kept climbing", "roughly doubled").
  Right after a big figure, make it feel real with one comparison.
- Every number you say must be a FACT value (you may round it: 9,091 -> "about nine thousand") or a year from the facts/timeline,
  or the result of a calc, and the sentence must list that fact id in "factIds". Counting words one to ten are free.
- Keep the fact's currency; for a big non-dollar amount a dollar comparison helps only when it is a fact or a calc.
- Comparisons: if you say a number you computed (e.g. "that's about twenty-five crore rupees a day"), add to that
  sentence "calc": [{"expr": "F12 / 365"}] using fact ids, + - * / ( ) and plain constants. A fact id stands for the
  fact's FULL value in base units (a fact "9000 INR crore" = 90,000,000,000 rupees; "38 %" = 38). The machine
  recomputes the expression and the number you say must match it (rounding is fine), so do the arithmetic carefully.
  Use calc also for unit conversions (F5 * F9 for dollars to rupees only if both are facts).
- Put the fact ids a sentence relies on in its "factIds".`;

const TAGS = `TAGS (return them with the text; they drive music, visuals and the montage):
- section "mood": one of ${MOODS.join(" | ")}; section "energy": 1 (quiet) to 5 (peak).
- every sentence "visual": geo (a place or map matters) | number (one big figure) | trend (change over time) |
  compare (two things side by side) | quote (a quoted line) | person (a named person) | event (a dated scene or event) |
  concept (an idea or mechanism) | joke (a punchline or aside).
- every sentence "devices": the craft moves it performs, from ${DEVICES.join(", ")} (often empty; a sentence can have two).
  Tag honestly: "metaphor" = an everyday physical picture; "case" = a real, named example with a place/number;
  "question" = an open question; "pivot" = a "but / the irony / so the question is" turn.
- a sentence that reads a quote also has "quoteId" (e.g. "Q1").`;

function quoteList(dossier) {
  const q = dossier.quotes || [];
  return q.length ? q.map((x) => `${x.id}: "${x.text}" - ${x.speaker}${x.role ? `, ${x.role}` : ""}${x.year ? ` (${x.year})` : ""}`).join("\n") : "(none: do not quote anyone)";
}

function hookBrief(outline, dossier) {
  const h = outline.hook || {};
  // per-step word allowance so the whole skeleton fits the cold-open budget
  const alloc = (share) => Math.max(6, Math.round((outline.coldOpen.words || 180) * share));
  const q = ((dossier.quotes || []).find((x) => x.id === (h.anchorQuote || {}).quoteId)) || null;
  const st = (h.stakesTour || []).map((s, i) => `   ${i + 1}. ${s.place} [${s.factId}]: scene: ${s.scene || "(a plain everyday picture of people there)"} | link to our story: ${s.why || ""} | number: ${s.line || ""}`).join("\n");
  return `HOOK SKELETON, in this order (tag each sentence's device):
 1. chorus [chorus]: open cold on the buzzword / common belief as a fragment: "${h.chorus || ""}". Then one line on how
    everyone repeats it, talking to the viewer ("You've heard it everywhere." headlines, politicians, your uncle at
    dinner). 2-3 very short sentences, ~${alloc(0.08)} words.
 2. anchor quote [quote]: ${q ? `${q.speaker}${q.role ? ` (${q.role})` : ""}${q.year ? `, ${q.year}` : ""}: "${q.text}" - read it word for word in double quotes, quoteId "${q.id}".` : "(no verified quote: skip this step)"}
 3. myth, then reveal [myth], [reveal]: "And while most people think ${(h.myth || {}).belief || "..."}, what they don't realise is ${(h.myth || {}).reveal || "..."}" [${((h.myth || {}).factIds || []).join(", ")}]
 4. stakes tour [stakes], ~${alloc(0.24)} words, three stops. Each stop weaves a tiny human scene (who, where, what they
    see, as a FULL sentence with a verb) into ONE number said like a person, plus the link to our story, so the viewer
    feels why it matters to THEM ("In Shenzhen, a young couple still pays a mortgage on a tower nobody finished, and the
    builders owe more than most countries earn in a year."). Keep each figure's scope and year exactly as in its fact.
${st}
 5. irony pivot [irony, pivot]: a real REVERSAL of the belief from step 3, as one full sentence: "But the irony is,
    ..." ${(h.ironyPivot || {}).thesis || ""} [${((h.ironyPivot || {}).factIds || []).join(", ")}]
    Then explain it in the next one or two plain sentences (no question yet): ${(h.ironyPivot || {}).explain || ""}
    It MUST start within the first ~140 words (about 50 seconds). Keep steps 1-4 tight (steps 2 and 3: ~${alloc(0.12)} words each).
    Never a label fragment like "Here's the catch: <jargon>." Say the plain meaning first; the name (if any) after.
 6. stat, definition, metaphor [stat], [definition], [metaphor]: [${(h.statDefinitionMetaphor || {}).factId || ""}] ${(h.statDefinitionMetaphor || {}).definition || ""} / metaphor: ${(h.statDefinitionMetaphor || {}).metaphor || ""} (extend the metaphor once).
    ~${alloc(0.14)} words. The definition is a real plain-words definition ("Deflation just means prices keep falling."), not a label.
 7. case study [case], ~${alloc(0.1)} words, then one dry joke line [joke] (idea: ${h.joke || "a wry aside"}): ${(h.caseStudy || {}).name || ""}${(h.caseStudy || {}).place ? `, ${h.caseStudy.place}` : ""} [${((h.caseStudy || {}).factIds || []).join(", ")}]
 8. question stack [question], ~${alloc(0.12)} words: the first sentence is "So the question is, <first question>?" (never a
    bare "So the question is."), then the others, one short question per sentence, the last about the viewer:
${(h.questionStack || []).map((x) => `    - ${x}`).join("\n")}
Then stop: chapter one starts right after.

ALSO return for the cold open:
 "montageLines": 5-7 punchy hook lines for a fast cold-open montage (each <= 10 words, no digits, numbers spelled as words
   and only from facts; the chorus and the stakes numbers work well), as [{"text": "...", "factIds": ["F.."]}];
 "anchorLine": {"text": "<the one line the montage ends on: the anchor quote verbatim (then quoteId) or the irony line>", "quoteId": "<Q id or null>"}`;
}

function sectionBrief(outline, sec, dossier = {}) {
  if (sec.id === "cold") {
    return `SECTION: COLD OPEN (about ${sec.words} words, ~${Math.round((sec.words / 160) * 60)} seconds). No greeting, no title, start on the chorus.
${hookBrief(outline, dossier)}
Promise (say it through the question stack, not as "in this video"): ${sec.promise || ""}
Set up the running joke lightly (one line): ${outline.runningJoke}
Fact ids to use: ${(sec.factIds || []).join(", ")}`;
  }
  if (sec.id === "recap") {
    return `SECTION: RECAP (about ${sec.words} words). Walk back through the takeaways in plain words, answer the viewer question from the cold open's question stack, land the final callback to the cold open and the running joke, end on the closing line. No subscribe/follow call (a fixed ending is added later).
Takeaways: ${(sec.takeaways || []).join(" / ")}
Closing line idea: ${sec.closingLine}`;
  }
  const next = (outline.chapters || [])[sec.index];
  return `SECTION: CHAPTER ${sec.index} "${sec.title}" (about ${sec.words} words, write between ${Math.round(sec.words * 0.9)} and ${Math.round(sec.words * 1.1)}).
Shape: open question -> story/example -> numbers + metaphor -> "but" turn -> cliffhanger question.
1. Open with the chapter's question as a real question, in plain words, in the first or second sentence [question]: ${sec.question}
2. Story / example (causal beats, in order): ${(sec.beats || []).join(" / ")}
   Worked example to carry through: ${sec.example}
3. Numbers + metaphor [metaphor]: ${sec.metaphor || "(pick one everyday physical picture)"}; concrete case [case]: ${sec.caseStudy || "(one real named example)"}
4. The "but" turn [pivot]: ${sec.butTurn || "(what complicates the obvious reading)"}
5. ${next ? `End on a cliffhanger question [cliffhanger, question] in the last or second-last sentence, which chapter ${next.index} answers ("${next.question}"): ${sec.cliffhanger || ""}` : `End on a short line that hands over to the recap: ${sec.cliffhanger || ""}`}
Comedic beat: ${sec.comedicBeat}
Running joke callback: ${sec.callback || "(none needed)"}
Fact ids to use (you may use others): ${(sec.factIds || []).join(", ")}`;
}

const SCHEMA = (cold) => `{"mood": "<mood>", "energy": <1-5>, "sentences": [{"text": "...", "factIds": ["F3"], "calc": [], "visual": "<visual>", "devices": [], "quoteId": null}]${cold ? `, "montageLines": [{"text": "...", "factIds": []}], "anchorLine": {"text": "...", "quoteId": null}` : ""}}`;

/**
 * Two ORIGINAL cold opens in the channel voice, on unrelated topics, for the hook few-shot. Their facts are
 * illustrative only (the model is told never to reuse them). Static text: it sits in the static prompt prefix.
 */
const COLD_EXAMPLES = `EXAMPLE COLD OPENS (other topics; copy the flow and voice, never their facts or wording):

Example A - "Why Switzerland is so rich":
Rich. That's the one word everyone uses for Switzerland. Bankers, chocolate, and watches that cost more than your car.
Most people think the Swiss got rich by hiding other people's money. What they don't realise is that banks make only
about a tenth of the economy. On a grey morning in Basel, a lab technician checks a batch of cancer medicine bound for
hospitals worldwide. That one tray is worth more than a house. But the irony
is, Switzerland has almost nothing to dig out of the ground. No oil, no gold mines, not even a coastline. So it learned to
sell brains instead. Economists call that high value added, which just means you charge a lot for what you make. Think
of a baker who stops selling bread and starts selling wedding cakes. Same flour. Much bigger bill. So the question is,
how did a small, landlocked country pull this off? Could anyone copy it? And what does it mean for the prices you pay?

Example B - "How Netflix almost died":
Streaming wars. You've heard the phrase on every tech podcast. And Netflix is always the giant everyone is chasing.
Most people think Netflix won because it saw the future first. What they don't realise is that in twenty eleven, it
nearly killed itself. That summer, families across America opened an email saying their plan now cost about sixty
percent more. Plenty of them simply clicked cancel. Then it moved its DVDs into a new brand called Qwikster. Which,
to be fair, sounds like a cough syrup. By December, the stock had lost about three quarters of its value. But the
irony is, that near-death moment is what saved it. Customers kept leaving every month, what the industry calls churn.
So Netflix started making shows you could not watch anywhere else. Think of a restaurant that loses its regulars and
finally learns to cook. So the question is, how does a company come back from the
edge? Why did the fix work? And what does it tell you about the apps you pay for every month?`;

function scriptPrompt(dossier, outline, sec) {
  const map = [`Cold open: ${(outline.hook && outline.hook.ironyPivot && outline.hook.ironyPivot.thesis) || outline.coldOpen.hook}`, ...outline.chapters.map((c) => `Chapter ${c.index} "${c.title}": ${c.question}`), "Recap"].join("\n");
  // static part first (identical across sections and videos) so Gemini implicit caching can reuse the prefix
  return `You write narration for a YouTube explainer channel (global finance, business and geopolitics).

${STYLE}

${TAGS}
${sec.id === "cold" ? `\n${COLD_EXAMPLES}\n` : ""}
NOW YOUR TASK: one section of the narration for the deep-dive "${outline.title}" (topic: ${dossier.topic}).
Angle: ${dossier.angle}
Running joke: ${outline.runningJoke}
Audience: curious people worldwide, 18-35, no finance background. "What's in it for you" means anyone, anywhere.

WHOLE VIDEO MAP (for continuity; write ONLY your section):
${map}

FACTS (the only source of numbers and claims):
${factDigest(dossier)}
${(dossier.hook && dossier.hook.counterView && dossier.hook.counterView.length) ? `COUNTER-VIEW FACTS (use where a conclusion needs balance): ${dossier.hook.counterView.join(", ")}\n` : ""}
QUOTES (verbatim, sourced; the ONLY quotes allowed):
${quoteList(dossier)}

GLOSSARY (explain any of these in plain words, same or next sentence, the first time you use it):
${dossier.glossary.map((g) => `${g.term}: ${g.plain}`).join("\n")}

${sectionBrief(outline, sec, dossier)}

Return JSON: ${SCHEMA(sec.id === "cold")}`;
}

function repairPrompt(dossier, outline, sec, current, problems) {
  const draft = {
    mood: current.mood, energy: current.energy,
    sentences: current.sentences.map(({ id, text, factIds, calc, visual, devices, quoteId }) => ({ id, text, factIds, calc, visual, devices, ...(quoteId ? { quoteId } : {}) })),
    ...(sec.id === "cold" ? { montageLines: current.montageLines, anchorLine: current.anchorLine } : {}),
  };
  return `${scriptPrompt(dossier, outline, sec)}

YOUR CURRENT DRAFT OF THIS SECTION:
${JSON.stringify(draft)}

A checker found these problems. Rewrite the section so that none remain, keeping the tone, jokes, tags and flow.
Change only what the problems need; keep the sentences that are fine.${sec.id === "cold" ? `
In the cold open, never cut a stakes stop's scene or its link to our story; to save words, trim elsewhere (chorus, case, questions).` : ""}
If a number cannot be matched to a fact, drop it or say it qualitatively ("a huge chunk", "most of it").
To lower the reading grade: split long sentences, swap long words for short everyday ones.
- ${problems.join("\n- ")}

Return the full corrected JSON: ${SCHEMA(sec.id === "cold")}`;
}

/** The sentence list wherever the model put it ({sentences}, {section: {sentences}}, {chapter: [...]}, a bare array...). */
function findSentences(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.some((x) => x && x.text) ? raw : [];
  if (Array.isArray(raw.sentences)) return raw.sentences;
  for (const [k, v] of Object.entries(raw)) {
    if (k === "montageLines") continue;
    if (Array.isArray(v) && v.some((x) => x && typeof x === "object" && x.text)) return v;
    if (v && typeof v === "object" && !Array.isArray(v) && Array.isArray(v.sentences)) return v.sentences;
  }
  return [];
}

function normalizeSection(sec, raw) {
  const sentences = findSentences(raw).filter((s) => s && String(s.text || "").trim()).map((s, i) => ({
    id: `${sec.id}-s${String(i + 1).padStart(2, "0")}`,
    text: String(s.text).replace(/\s+/g, " ").trim(),
    factIds: Array.isArray(s.factIds) ? s.factIds.map(String) : [],
    ...(Array.isArray(s.calc) && s.calc.length ? { calc: s.calc.filter((c) => c && c.expr) } : {}),
    visual: s.visual ? String(s.visual).toLowerCase() : undefined,
    devices: Array.isArray(s.devices) ? s.devices.map(String) : [],
    ...(s.quoteId ? { quoteId: String(s.quoteId) } : {}),
  }));
  const out = { id: sec.id, title: sec.id === "cold" ? "Cold open" : sec.id === "recap" ? "Recap" : sec.title, question: sec.question, words: sec.words, mood: raw && raw.mood, energy: raw && raw.energy, sentences };
  if (sec.id === "cold") {
    out.montageLines = ((raw && raw.montageLines) || []).map((l) => (typeof l === "string" ? { text: l, factIds: [] } : l)).filter((l) => l && l.text)
      .map((l) => ({ text: String(l.text).replace(/\s+/g, " ").trim(), factIds: Array.isArray(l.factIds) ? l.factIds.map(String) : [] }));
    const a = raw && raw.anchorLine;
    out.anchorLine = a && (a.text || typeof a === "string") ? { text: String(a.text || a).trim(), quoteId: a.quoteId || null } : null;
  }
  return out;
}

// ---------- editor pass (cold open) ----------
const normTok = (t) => String(t || "").toLowerCase().replace(/[’]/g, "'").replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim();

/** Tokens the editor must not change: spoken numbers, quoted text, capitalised names (not sentence-initial); original case. */
function lockedTokens(section) {
  const out = new Map();
  const add = (t, name = false) => { const k = normTok(t); if (k && !out.has(k)) out.set(k, { text: String(t).trim(), name }); };
  for (const s of section.sentences) {
    parseSpokenNumbers(s.text).forEach((n) => add(n.text));
    quotedSpans(s.text).forEach((q) => add(q.inner));
    (String(s.text).match(/(?<=\S\s+)[A-Z][A-Za-z'’.-]+/g) || []).forEach((w) => add(w.replace(/['’]s$/, "").replace(/[.]$/, ""), true));
  }
  return [...out.values()];
}
/** Locked tokens missing from an edit (numbers and quotes case-insensitive; names must keep their capitals). */
const missingTokens = (locked, section) => {
  const raw = section.sentences.map((s) => s.text).join(" ");
  const t = normTok(raw);
  return locked.filter((x) => (x.name ? !raw.includes(x.text) : !t.includes(normTok(x.text)))).map((x) => x.text);
};

function editorPrompt(section) {
  const locked = lockedTokens(section);
  return `You are the final editor of a spoken YouTube cold open (a relaxed, warm narrator; a smart friend over coffee).
${COLD_EXAMPLES}

Rewrite the draft below so it flows and has rhythm like the examples: vary sentence length, join choppy fragments into
full sentences with verbs, add small linking words, keep it simple (grade 5-7) and keep its jokes, direct address
("you"), pivots ("But the irony is...", "So the question is...") and its structure and order.
HARD RULES:
- Keep EVERY locked token (listed after these rules) exactly as written, same capitals (numbers, names, quotes).
- Keep the order of the beats: chorus, quote, belief and reveal, the three stakes stops, THEN the irony line, then the rest.
- No new facts, numbers, names or quotes. Keep each number's scope words and year. Total length within 10% of the draft.
- Every sentence has a verb and at most 20 words (a quoted line may stand in its own sentence). Keep the irony line
  within the first 150 words.
- Each sentence keeps its "factIds", "devices", "visual" (and "quoteId"); when you merge sentences, merge their lists.
Return JSON: {"sentences": [{"text": "...", "factIds": [], "devices": [], "visual": "...", "quoteId": null, "calc": []}]}

LOCKED TOKENS: ${locked.map((x) => `"${x.text}"`).join(", ")}
DRAFT:
${JSON.stringify({ sentences: section.sentences.map(({ text, factIds, devices, visual, quoteId, calc }) => ({ text, factIds, devices, visual, ...(quoteId ? { quoteId } : {}), ...(calc ? { calc } : {}) })) })}`;
}

/**
 * One cheap editor call (standard tier, low thinking) over the cold open; the edit is kept only when every locked token
 * survives and the gates find no more problems than before. Returns {sections, problems, note}.
 */
async function editColdOpen(sections, problems, dossier, secs, g, opts = {}) {
  const i = sections.findIndex((s) => s.id === "cold");
  if (i < 0 || !sections[i].sentences.length) return { sections, problems, note: "no cold open" };
  const before = sections[i];
  const raw = await g.json(editorPrompt(before), { temperature: 0.5, task: "longform.edit", thinking: opts.editThinking || "low" });
  const edited = autoFix(normalizeSection(secs[i], { ...raw, mood: before.mood, energy: before.energy, montageLines: before.montageLines, anchorLine: before.anchorLine }));
  edited.montageLines = before.montageLines;
  edited.anchorLine = before.anchorLine;
  const missing = missingTokens(lockedTokens(before), edited);
  if (!edited.sentences.length || missing.length) return { sections, problems, note: `editor dropped ${missing.length ? missing.join(", ") : "everything"}; kept pre-edit` };
  const trial = sections.map((s, k) => (k === i ? edited : s));
  const p2 = checkAll(trial, dossier, opts);
  if (p2[i].length > problems[i].length) return { sections, problems, note: `editor made ${p2[i].length} problems (pre-edit ${problems[i].length}); kept pre-edit: ${p2[i].join(" | ").slice(0, 300)}` };
  return { sections: trial, problems: p2, note: `editor accepted (${problems[i].length} -> ${p2[i].length} problems)` };
}

/** Deterministic fixes before any check / LLM repair: split long sentences, fill tags. */
function autoFix(section) {
  const merges = mergeDanglingLeads(section);
  const splits = splitLongSentences(section);
  const notes = fillTags(section);
  section.autoFix = { splits, merges, tagNotes: notes };
  return section;
}

function checkAll(sections, dossier, opts = {}) {
  const all = sections.flatMap((s) => s.sentences);
  const lastCh = sections.map((s) => s.id).filter((id) => /^ch\d+$/.test(id)).pop();
  return sections.map((s, i) => {
    // the cold open gets +30 % slack: flowing, full-sentence hooks run a little longer than the budget
    const p = sectionProblems(s, { dossier, glossary: dossier.glossary, allSentences: all, wordBudget: s.words, isFirst: i === 0, ...(s.id === "cold" ? { wordSlack: [0.8, 1.3] } : {}) });
    styleProblems(s, { dossier, wpm: opts.wpm, isLastChapter: s.id === lastCh }).forEach((x) => p.push(x));
    if (s.id === "cold") {
      montageProblems(s.montageLines, s.anchorLine, dossier).forEach((x) => p.push(x));
      (s.montageLines || []).forEach((l, k) => checkSentenceNumbers({ text: l.text, factIds: l.factIds }, dossier).problems.forEach((x) => p.push(`montageLines[${k}]: ${x}`)));
    }
    return p;
  });
}

/**
 * @param {object} dossier
 * @param {object} outline
 * @param {{gemini, log?, maxRepairs?: number, concurrency?: number, only?: string[], previous?: object}} opts
 */
async function writeScript(dossier, outline, opts = {}) {
  const log = opts.log || (() => {});
  const g = opts.gemini;
  const wpm = (outline.budget && outline.budget.wpm) || 160;
  const secs = [outline.coldOpen, ...outline.chapters, outline.recap];
  // opts.only + opts.previous (cost): redraft only these section ids, reuse the rest from a previous script.json
  const prev = opts.previous && opts.only ? Object.fromEntries(opts.previous.sections.map((s) => [s.id, s])) : null;
  let sections = await pool(secs, opts.concurrency || 3, async (sec) => {
    if (prev && !opts.only.includes(sec.id) && prev[sec.id] && prev[sec.id].sentences.length) {
      const { stats, problems, ...kept } = JSON.parse(JSON.stringify(prev[sec.id]));
      if (sec.id === "cold") { kept.montageLines = opts.previous.montageLines || []; kept.anchorLine = opts.previous.anchorLine || null; }
      log(`script: reusing ${sec.id}`);
      return autoFix(kept);
    }
    // opts.drafts[id]: a raw draft already paid for (e.g. an A/B run) is used instead of a new call
    if (opts.drafts && opts.drafts[sec.id]) { log(`script: using supplied draft for ${sec.id}`); return autoFix(normalizeSection(sec, opts.drafts[sec.id])); }
    log(`script: drafting ${sec.id}`);
    return autoFix(normalizeSection(sec, await g.json(scriptPrompt(dossier, outline, sec), { temperature: 0.9, task: "longform.script", thinking: opts.thinking, thinkingTask: sec.id === "cold" ? "longform.script.cold" : undefined })));
  });
  sections.forEach((s) => { if (s.autoFix.splits) log(`script: ${s.id}: splitter made ${s.autoFix.splits} split(s) before any repair`); });
  let problems = checkAll(sections, dossier, { wpm });
  const history = [problems.map((p) => p.length)];
  // a repair can fix one thing and break two others: keep each section's best draft so far
  // (an empty section is always the worst draft, whatever its problem count says)
  const score = (s, p) => (s.sentences.length ? p.length : Infinity);
  const best = sections.map((s, i) => ({ section: s, n: score(s, problems[i]) }));
  const { costMode } = require("../ai/models");
  for (let round = 1; round <= (opts.maxRepairs ?? 3) && problems.some((p) => p.length); round++) {
    // budget >= 80 % (lib/longform/budget.js): one repair round at most, on the cheaper tier
    if (round > 1 && costMode() !== "normal") {
      log("script: budget tight; no further repair rounds");
      break;
    }
    // only failing sections are re-sent (cost)
    const todo = sections.map((s, i) => i).filter((i) => problems[i].length);
    log(`script: repair round ${round}: ${todo.map((i) => `${sections[i].id}(${problems[i].length})`).join(" ")}`);
    todo.forEach((i) => problems[i].forEach((x) => log(`  ${sections[i].id}: ${x}`)));
    const fixed = await pool(todo, opts.concurrency || 3, async (i) => autoFix(normalizeSection(secs[i], await g.json(repairPrompt(dossier, outline, secs[i], sections[i], problems[i]), { temperature: 0.6, task: "script.repair" }))));
    todo.forEach((i, k) => {
      const f = fixed[k];
      if (!f.sentences.length) return;
      if (f.id === "cold") {
        if (!(f.montageLines || []).length) f.montageLines = sections[i].montageLines;
        if (!f.anchorLine) f.anchorLine = sections[i].anchorLine;
      }
      sections[i] = f;
    });
    problems = checkAll(sections, dossier, { wpm });
    history.push(problems.map((p) => p.length));
    sections.forEach((s, i) => { if (score(s, problems[i]) < best[i].n) best[i] = { section: s, n: score(s, problems[i]) }; });
  }
  if (sections.some((s, i) => best[i].section !== s)) {
    sections = best.map((b) => b.section);
    problems = checkAll(sections, dossier, { wpm });
    history.push(problems.map((p) => p.length));
  }
  // editor pass on the cold open (flow and rhythm; one cheap call; kept only when it does not break a gate)
  let editNote = null;
  const coldRedrafted = !opts.only || opts.only.includes("cold");
  // the editor is a polish pass: skipped when the budget is tight
  if (opts.edit !== false && coldRedrafted && costMode() === "normal") {
    const r = await editColdOpen(sections, problems, dossier, secs, g, { wpm, editThinking: opts.editThinking });
    sections = r.sections;
    problems = r.problems;
    editNote = r.note;
    log(`script: cold-open editor: ${editNote}`);
    history.push(problems.map((p) => p.length));
  }
  sections.forEach((s, i) => {
    const st = lengthStats(s.sentences);
    s.stats = { words: s.sentences.reduce((a, x) => a + words(x.text).length, 0), fk: Number(fkGrade(s.sentences).toFixed(2)), sentences: s.sentences.length, medianWords: st.median };
    s.problems = problems[i];
  });
  const cold = sections.find((s) => s.id === "cold") || {};
  const totalWords = sections.reduce((a, s) => a + s.stats.words, 0);
  return {
    version: SCRIPT_VERSION,
    topic: dossier.topic,
    title: outline.title,
    runningJoke: outline.runningJoke,
    hook: outline.hook || null,
    montageLines: cold.montageLines || [],
    anchorLine: cold.anchorLine || null,
    sections: sections.map(({ montageLines, anchorLine, ...s }) => s),
    stats: {
      words: totalWords,
      estMinutes: Number((totalWords / wpm).toFixed(2)),
      wpm,
      fkMax: Math.max(...sections.map((s) => s.stats.fk)),
      problems: problems.reduce((a, p) => a + p.length, 0),
      repairHistory: history,
      editor: editNote,
    },
  };
}

/** Readable script.md: sections, sentences, fact refs, and the source list. */
function scriptMarkdown(script, dossier) {
  const factById = Object.fromEntries(dossier.facts.map((f) => [f.id, f]));
  const L = [`# ${script.title}`, "", `Topic: ${script.topic}  `, `Words: ${script.stats.words} (~${script.stats.estMinutes} min at ${script.stats.wpm} wpm) · max FK grade ${script.stats.fkMax} · open problems ${script.stats.problems}  `, `Running joke: ${script.runningJoke}`, ""];
  if ((script.montageLines || []).length) L.push("## Montage lines", "", ...script.montageLines.map((l) => `- ${l.text}`), "", `Anchor: ${script.anchorLine ? script.anchorLine.text : "-"}`, "");
  script.sections.forEach((s) => {
    L.push(`## ${s.id === "cold" || s.id === "recap" ? s.title : `${s.id.replace("ch", "Chapter ")}: ${s.title}`}`);
    L.push(`*${s.stats.words} words · FK ${s.stats.fk} · median ${s.stats.medianWords ?? "?"} words${s.mood ? ` · mood ${s.mood}/${s.energy}` : ""}${s.question ? ` · ${s.question}` : ""}*`, "");
    s.sentences.forEach((x) => L.push(`${x.text}${x.factIds.length ? ` <sub>[${x.factIds.join(", ")}]</sub>` : ""}${x.visual ? ` <sub>{${x.visual}${(x.devices || []).length ? `; ${x.devices.join(", ")}` : ""}}</sub>` : ""}`));
    if (s.problems.length) L.push("", ...s.problems.map((p) => `> CHECK: ${p}`));
    L.push("");
  });
  const used = [...new Set(script.sections.flatMap((s) => s.sentences.flatMap((x) => x.factIds)))].filter((id) => factById[id]);
  L.push("## Facts used", "");
  used.forEach((id) => { const f = factById[id]; L.push(`- **${id}** ${f.claim} (${f.confidence}) - ${f.sources.map((s) => `[${s.title}](${s.url})`).join(", ")}`); });
  return L.join("\n") + "\n";
}

module.exports = { writeScript, scriptMarkdown, scriptPrompt, repairPrompt, editorPrompt, editColdOpen, lockedTokens, normalizeSection, autoFix, checkAll, STYLE, TAGS, COLD_EXAMPLES, SCRIPT_VERSION };
