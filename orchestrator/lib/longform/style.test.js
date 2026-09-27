"use strict";

// LF v2 workstream F: script-craft gates, splitter, tags schema, hook skeleton, verbatim quotes.
const test = require("node:test");
const assert = require("node:assert");
const S = require("./style");
const { hookProblems, outlinePrompt, wordBudget } = require("./outline");
const { finalizeDossier, finalizeQuotes, finalizeHook, planQuestions, makeRegistry, researchPrompt, planPrompt } = require("./research");
const { normalizeSection, autoFix, checkAll, scriptPrompt, SCRIPT_VERSION } = require("./script");
const { sectionProblems } = require("./checks");

const sent = (id, text, extra = {}) => ({ id, text, factIds: [], ...extra });

test("splitter: long sentences split at safe boundaries, quotes and subordinate clauses untouched", () => {
  const a = S.splitSentence("The yen kept falling for years and years against the dollar, and nobody in Tokyo seemed to have a plan to stop it.");
  assert.ok(a.length >= 2, a.join(" | "));
  assert.match(a[1], /^And nobody/);
  const b = S.splitSentence("Banks lent money to companies that could never pay it back; the loans sat on the books like old furniture nobody wanted.");
  assert.deepStrictEqual(b.map((x) => /[.!?]$/.test(x)), [true, true]);
  assert.match(b[1], /^The loans/);
  const w = S.splitSentence("Prices barely moved for three decades in a row, which means a coffee in Tokyo cost about the same in both years we checked.");
  assert.match(w[1], /^That means/);
  // subordinate clause: "If X, it was Y" is never cut into "If X."
  const sub = "If the central bank had raised rates in those early years of the boom, it was going to hurt a lot of people.";
  assert.deepStrictEqual(S.splitSentence(sub), [sub]);
  // inside a quote: never split
  const q = "He said \"we will do whatever it takes and believe me it will be enough, and then some more on top\" to the press.";
  assert.ok(S.splitSentence(q).every((x) => !/^And then/.test(x)));
  // short sentences are returned as is
  assert.deepStrictEqual(S.splitSentence("Zero growth."), ["Zero growth."]);
});

test("splitter on a section: ids renumbered, tags copied, calc kept only where a figure is said", () => {
  const sec = { id: "ch1", sentences: [
    sent("x1", "Japan's debt grew to about two hundred and fifty percent of its economy, and most of that money was borrowed from its own people.", { factIds: ["F1"], calc: [{ expr: "F1" }], visual: "number", devices: ["stat"] }),
    sent("x2", "Short one."),
  ] };
  const n = S.splitLongSentences(sec);
  assert.strictEqual(n, 1);
  assert.deepStrictEqual(sec.sentences.map((s) => s.id), ["ch1-s01", "ch1-s02", "ch1-s03"]);
  assert.ok(sec.sentences[0].calc && !sec.sentences[1].calc);
  assert.strictEqual(sec.sentences[1].visual, "number");
  assert.deepStrictEqual(sec.sentences[1].devices, ["stat"]);
});

test("dangling 'So the question is.' merges into the next sentence", () => {
  const sec = { id: "cold", sentences: [sent("a", "Lost decades."), sent("b", "So the question is.", { devices: ["pivot"] }), sent("c", "How did it happen?", { devices: ["question"] }), sent("d", "Here's the thing.")] };
  assert.strictEqual(S.mergeDanglingLeads(sec), 1);
  assert.deepStrictEqual(sec.sentences.map((s) => s.text), ["Lost decades.", "So the question is, how did it happen?", "Here's the thing."]);
  assert.deepStrictEqual(sec.sentences[1].devices, ["pivot", "question"]);
  assert.deepStrictEqual(sec.sentences.map((s) => s.id), ["cold-s01", "cold-s02", "cold-s03"]);
});

test("script: sentences found under other keys; an empty draft never wins as 'best'", async () => {
  const sec = { id: "ch1", title: "A", words: 20 };
  assert.strictEqual(normalizeSection(sec, { section: { sentences: [{ text: "Hi there." }] } }).sentences.length, 1);
  assert.strictEqual(normalizeSection(sec, { chapter: [{ text: "Hi there." }], montageLines: [] }).sentences.length, 1);
  assert.strictEqual(normalizeSection(sec, [{ text: "Hi there." }]).sentences.length, 1);
  const { writeScript } = require("./script");
  // draft: empty; repairs: a real (imperfect) section -> the real one is kept
  let calls = 0;
  const g = { json: async () => (++calls === 1 ? { sentences: [] } : { mood: "calm", energy: 2, sentences: [{ text: "Why does it matter to you?" }, { text: "But prices fell like a stone for years." , devices: ["metaphor"] }, { text: "Look at Osaka, where shops cut prices.", devices: ["case"] }] }) };
  const outline = { title: "T", runningJoke: "j", budget: { wpm: 160 }, coldOpen: { id: "cold", words: 10 }, chapters: [{ id: "ch1", index: 1, title: "A", question: "Why?", words: 20 }], recap: { id: "recap", words: 10 } };
  const gemini = { json: async (p) => (/COLD OPEN|RECAP/.test(p) ? { sentences: [{ text: "Okay." }] } : g.json()) };
  const full = await writeScript({ topic: "t", facts: [], glossary: [], timeline: [], quotes: [] }, outline, { gemini, maxRepairs: 1, concurrency: 1 });
  const ch = full.sections.find((s) => s.id === "ch1");
  assert.ok(ch.sentences.length > 0, "the non-empty repair replaced the empty draft");
  assert.strictEqual(full.version, "lf-script.v2");
  assert.ok(Array.isArray(full.montageLines) && !full.sections.some((s) => "montageLines" in s));
});

test("length gate: median <= 12 and < 5% over 20 words", () => {
  const long = Array.from({ length: 10 }, (_, i) => sent(`s${i}`, "This sentence has exactly fourteen words in it so the median will be too high now."));
  const p = S.styleProblems({ id: "recap", sentences: long }, {});
  assert.ok(p.some((x) => /median sentence is 1[56]/.test(x)), p.join("\n"));
  const st = S.lengthStats([sent("a", "one two three"), sent("b", Array(21).fill("w").join(" ") + ".")]);
  assert.strictEqual(st.long.length, 1);
  assert.strictEqual(st.longShare, 0.5);
});

test("direct address and pivot every ~40 s window", () => {
  // 2 windows of ~110 words each; only the first talks to the viewer and turns
  const filler = (id) => sent(id, "Rice farms grew slowly across the quiet valley that year.");
  const first = [sent("a1", "Imagine you run a noodle shop in Osaka."), sent("a2", "But prices never rise.")];
  const sents = [...first, ...Array.from({ length: 20 }, (_, i) => filler(`f${i}`))];
  const w = S.windows(sents, 160);
  assert.ok(w.length >= 2, `windows ${w.length}`);
  const p = S.styleProblems({ id: "recap", sentences: sents }, {});
  assert.ok(p.some((x) => /no direct address/.test(x)));
  assert.ok(p.some((x) => /no pivot/.test(x)));
  assert.ok(S.DIRECT.test("Look at this chart.") && S.DIRECT.test("Here's the thing.") && !S.DIRECT.test("The bank lent money."));
  assert.ok(S.PIVOT.test("The irony is, it worked.") && S.PIVOT.test("What most people don't realise is this.") && !S.PIVOT.test("Rates went up."));
});

test("chapter gates: metaphor + case tags, opening question, cliffhanger except the last chapter", () => {
  const body = [sent("c1", "Why did you never hear about it?"), sent("c2", "But here's the thing."), sent("c3", "It was quiet.")];
  const p = S.styleProblems({ id: "ch1", sentences: body }, {});
  assert.ok(p.some((x) => /no everyday metaphor/.test(x)));
  assert.ok(p.some((x) => /no concrete, named case/.test(x)));
  assert.ok(p.some((x) => /cliffhanger/.test(x)));
  const ok = [sent("c1", "Why did you never hear about it?"), sent("c2", "It was like a slow leak in a tyre.", { devices: ["metaphor"] }),
    sent("c3", "But look at Yubari, a town that went broke.", { devices: ["case"] }), sent("c3b", "Which, in hindsight, was a bold plan.", { devices: ["joke"] }), sent("c4", "So what happened next?")];
  assert.deepStrictEqual(S.styleProblems({ id: "ch2", sentences: ok }, {}), []);
  const last = ok.slice(0, 3);
  assert.ok(!S.styleProblems({ id: "ch3", sentences: last }, { isLastChapter: true }).some((x) => /cliffhanger/.test(x)));
});

const QD = { facts: [{ id: "F1", claim: "x", value: 3, unit: "%" }], quotes: [{ id: "Q1", text: "Three percent growth is not a miracle, it is a plan", speaker: "A. Minister", sources: [{ url: "https://www.reuters.com/x" }] }] };

test("quotes: verbatim excerpts pass and get the quote id; invented quotes fail; quoted numbers skip the number gate", () => {
  const good = sent("q1", "As the minister put it: \"Three percent growth is not a miracle\".", { devices: ["quote"] });
  assert.deepStrictEqual(S.quoteProblems(good, QD), []);
  assert.strictEqual(good.quoteId, "Q1");
  const bad = sent("q2", "He said: \"growth is a miracle we planned for years\".");
  assert.match(S.quoteProblems(bad, QD)[0], /not a verbatim dossier quote/);
  assert.match(S.quoteProblems(sent("q3", "He said growth was a plan.", { devices: ["quote"] }), QD)[0], /no quoted words/);
  // "three percent" inside a verified quote is the speaker's number, not ours
  const p = sectionProblems({ id: "cold", sentences: [sent("q1", "The minister said: \"Three percent growth is not a miracle\".")] }, { dossier: { ...QD, facts: [] } });
  assert.ok(!p.some((x) => /matches no dossier fact/.test(x)), p.join("\n"));
});

test("hook script gate: every skeleton element, stakes with numbers, irony by ~60 s, last question about the viewer", () => {
  const d = { facts: [], quotes: [] };
  const good = [
    sent("h1", "Lost decades.", { devices: ["chorus"] }),
    sent("h2", "Most people think Japan just got lazy.", { devices: ["myth"] }),
    sent("h3", "What they don't realise is it never got poor.", { devices: ["reveal"] }),
    sent("h4a", "Picture a noodle shop owner in Tokyo.", { devices: ["stakes"] }),
    sent("h4", "His prices fell by ten percent.", { devices: ["stakes"] }),
    sent("h5a", "Now picture a car worker in Detroit.", { devices: ["stakes"] }),
    sent("h5", "Forty thousand jobs like his vanished.", { devices: ["stakes"] }),
    sent("h6a", "And a renter in Berlin, watching the bills.", { devices: ["stakes"] }),
    sent("h6", "Rents there went up by half in twenty years.", { devices: ["stakes"] }),
    sent("h7", "But the irony is, Japan is still very rich.", { devices: ["irony", "pivot"] }),
    sent("h7b", "Its people and firms own huge piles of assets abroad.", {}),
    sent("h8", "Deflation means prices go down, not up.", { devices: ["definition", "stat"] }),
    sent("h9", "It's like a sale that never ends.", { devices: ["metaphor"] }),
    sent("h10", "Look at Yubari, a town that went broke.", { devices: ["case"] }),
    sent("h10b", "Its melon festival did not save it.", { devices: ["joke"] }),
    sent("h11", "So how did it happen?", { devices: ["question"] }),
    sent("h12", "Who paid for it?", { devices: ["question"] }),
    sent("h13", "And what does it mean for your savings?", { devices: ["question"] }),
  ];
  assert.deepStrictEqual(S.hookScriptProblems(good, { dossier: d }), []);
  const noViewer = good.slice(0, -1).concat(sent("h13", "And what comes next?", { devices: ["question"] }));
  assert.ok(S.hookScriptProblems(noViewer, { dossier: d }).some((x) => /about the viewer/.test(x)));
  const late = [...Array.from({ length: 25 }, (_, i) => sent(`p${i}`, "Words words words words words words words words.")), ...good];
  assert.ok(S.hookScriptProblems(late, { dossier: d }).some((x) => /irony pivot .* must land by/.test(x)));
  const missing = S.hookScriptProblems(good.filter((s) => !(s.devices || []).includes("case")), { dossier: QD });
  assert.ok(missing.some((x) => /case study/.test(x)));
  assert.ok(missing.some((x) => /anchor quote/.test(x)), "dossier with quotes requires the anchor quote");
});

test("hook v2 gates: number density, list-of-numbers runs, scenes, joke, irony reversal, label fragments, spoken numbers", () => {
  const d = { facts: [], quotes: [] };
  const listy = [
    sent("a", "Lost decades.", { devices: ["chorus"] }),
    sent("b", "Most people think forty million Japanese are broke.", { devices: ["myth"] }),
    sent("c", "Growth was one point one percent.", { devices: ["reveal"] }),
    sent("d", "Germany fell zero point three percent.", { devices: ["stakes"] }),
    sent("e", "China owed eighty-six trillion yuan.", { devices: ["stakes"] }),
    sent("f", "America owes thirty-one trillion dollars.", { devices: ["stakes"] }),
    sent("g", "Debt hit two hundred fifty percent.", {}),
    sent("h", "But the irony is.", { devices: ["irony"] }),
    sent("i", "Here's the catch: demographic drag.", { devices: ["definition"] }),
  ];
  const p = S.hookScriptProblems(listy, { dossier: d });
  for (const re of [/figures before the irony pivot/, /follow another number sentence/, /scene sentence/, /no light joke/, /irony pivot is a fragment/, /cold open says \d+ figures in 9 sentences/]) assert.ok(p.some((x) => re.test(x)), `${re}\n${p.join("\n")}`);
  const sp = S.styleProblems({ id: "cold", sentences: listy }, { dossier: d });
  assert.ok(sp.some((x) => /zero point/.test(x)));
  assert.ok(sp.some((x) => /too many decimals/.test(x)));
  assert.ok(sp.some((x) => /names a label without saying what it means/.test(x)));
  // irony must come after the belief
  const flipped = [sent("x", "But the irony is, Japan is still very rich today.", { devices: ["irony"] }), sent("y", "Most people think it broke.", { devices: ["myth"] }), sent("z", "It owns a lot abroad.")];
  assert.ok(S.hookScriptProblems(flipped, { dossier: d }).some((x) => /reverse the belief stated BEFORE/.test(x)));
  // an explained label is fine
  assert.ok(!S.LABEL_FRAGMENT.test("Here's the catch: fewer workers means less growth for everyone."));
  // chapters allow one decimal, the cold open none
  assert.deepStrictEqual(S.spokenNumberProblems([sent("a", "It grew one point nine percent.")], "ch1", []), []);
  assert.strictEqual(S.spokenNumberProblems([sent("a", "It grew one point nine percent.")], "cold", []).length, 1);
});

test("thinking knob: env per task, level or budget, default low for the pro script", () => {
  const { thinkingConfigFor } = require("./gemini");
  assert.deepStrictEqual(thinkingConfigFor("longform.script", {}), { thinkingLevel: "low" });
  assert.deepStrictEqual(thinkingConfigFor("longform.script", { GEMINI_THINKING_LONGFORM_SCRIPT: "high" }), { thinkingLevel: "high" });
  assert.deepStrictEqual(thinkingConfigFor("longform.outline", { GEMINI_THINKING_LONGFORM_OUTLINE: "1024" }), { thinkingBudget: 1024 });
  assert.strictEqual(thinkingConfigFor("longform.script", { GEMINI_THINKING_LONGFORM_SCRIPT: "default" }), null);
  assert.strictEqual(thinkingConfigFor("research.distil", {}), null);
  assert.strictEqual(thinkingConfigFor("longform.script.cold", {}), null); // the hook keeps the model default
  assert.deepStrictEqual(thinkingConfigFor("longform.script.cold", { GEMINI_THINKING_LONGFORM_SCRIPT_COLD: "low" }), { thinkingLevel: "low" });
  // a stakes stop said like a person ("it shrank in 2023") is anchored by its year
  const stops = ["Picture a Bavarian line going idle.", "Their economy shrank in twenty twenty-three.", "Picture a Shanghai tower.", "Developers owed eighty-six trillion yuan.", "Picture a US shopper.", "Debt hit thirty-one trillion dollars."]
    .map((t, i) => sent(`k${i}`, t, { devices: ["stakes"] }));
  assert.ok(!S.hookScriptProblems(stops, { dossier: { quotes: [] } }).some((x) => /stakes tour has/.test(x)));
});

test("writeScript only/previous: redrafts only the named sections", async () => {
  const { writeScript } = require("./script");
  const prompts = [];
  const gemini = { json: async (p) => { prompts.push(p); return { mood: "calm", energy: 2, sentences: [{ text: "Why does it matter to you?" }] }; } };
  const outline = { title: "T", runningJoke: "j", budget: { wpm: 160 }, coldOpen: { id: "cold", words: 10 }, chapters: [{ id: "ch1", index: 1, title: "A", question: "Why?", words: 10 }], recap: { id: "recap", words: 10 } };
  const previous = { montageLines: [{ text: "Lost decades.", factIds: [] }], anchorLine: { text: "x", quoteId: null }, sections: ["cold", "ch1", "recap"].map((id) => ({ id, sentences: [{ id: `${id}-s01`, text: "Kept sentence here.", factIds: [] }] })) };
  const s = await writeScript({ topic: "t", facts: [], glossary: [], timeline: [], quotes: [] }, outline, { gemini, only: ["ch1"], previous, maxRepairs: 0 });
  assert.strictEqual(prompts.length, 1);
  assert.match(prompts[0], /CHAPTER 1/);
  assert.strictEqual(s.sections.find((x) => x.id === "cold").sentences[0].text, "Kept sentence here.");
  assert.deepStrictEqual(s.montageLines.map((l) => l.text), ["Lost decades."]);
});

test("montage lines and anchor line", () => {
  const lines = ["Lost decades.", "Zero growth.", "Prices frozen.", "Wages frozen.", "A whole country on pause."].map((text) => ({ text, factIds: [] }));
  assert.deepStrictEqual(S.montageProblems(lines, { text: "Three percent growth is not a miracle", quoteId: "Q1" }, QD), []);
  const p = S.montageProblems([...lines.slice(0, 3), { text: "This line is far too long to slam on screen in one beat" }, { text: "Up 3 times" }], { text: "not what he said", quoteId: "Q1" }, QD);
  assert.ok(p.some((x) => /max 10/.test(x)));
  assert.ok(p.some((x) => /digits/.test(x)));
  assert.ok(p.some((x) => /verbatim/.test(x)));
  assert.ok(S.montageProblems(lines.slice(0, 2), null, QD).some((x) => /5-7 lines/.test(x)));
});

test("tags: invalid or missing mood/energy/visual filled deterministically; devices filtered", () => {
  const sec = { id: "ch1", mood: "spooky", sentences: [sent("a", "It fell by forty percent."), sent("b", "Ha.", { devices: ["joke", "nonsense"] }), sent("c", "He said \"we will do whatever it takes\".")] };
  const notes = S.fillTags(sec);
  assert.strictEqual(sec.mood, "investigative");
  assert.strictEqual(sec.energy, 3);
  assert.ok(notes.length === 2);
  assert.deepStrictEqual(sec.sentences.map((s) => s.visual), ["number", "joke", "quote"]);
  assert.deepStrictEqual(sec.sentences[1].devices, ["joke"]);
  assert.ok(S.MOODS.includes("dread") && S.VISUALS.length === 9);
});

test("outline hook skeleton validation", () => {
  const facts = Array.from({ length: 8 }, (_, i) => ({ id: `F${i + 1}`, value: i + 1 }));
  const hook = {
    chorus: "Lost decades.", anchorQuote: { quoteId: "Q1" },
    myth: { belief: "b", reveal: "r", factIds: ["F1"] },
    stakesTour: [{ place: "Tokyo", factId: "F2", why: "w", scene: "s" }, { place: "Detroit", factId: "F3", why: "w", scene: "s" }, { place: "Berlin", factId: "F4", why: "w", scene: "s" }],
    ironyPivot: { thesis: "t", explain: "e", factIds: ["F5"] }, joke: "j", statDefinitionMetaphor: { factId: "F6", definition: "d", metaphor: "m" },
    caseStudy: { name: "Yubari", factIds: ["F7"] }, questionStack: ["How?", "Why?", "What about your job?"],
  };
  const d = { facts, quotes: [{ id: "Q1", text: "q" }] };
  assert.deepStrictEqual(hookProblems(hook, d), []);
  const bad = { ...hook, anchorQuote: { quoteId: "Q9" }, stakesTour: [hook.stakesTour[0], { place: "tokyo", factId: "F3" }], questionStack: ["How?", "Why?", "What next?"], statDefinitionMetaphor: { factId: "F99" } };
  const p = hookProblems(bad, d);
  for (const re of [/anchorQuote/, /exactly 3 stops/, /DIFFERENT places/, /about the viewer/, /statDefinitionMetaphor/]) assert.ok(p.some((x) => re.test(x)), `${re} in\n${p.join("\n")}`);
  assert.ok(hookProblems({ ...hook, anchorQuote: { quoteId: "Q1" } }, { facts, quotes: [] }).some((x) => /must be null/.test(x)));
  assert.deepStrictEqual(hookProblems(null, d), ["missing hook skeleton"]);
  const prompt = outlinePrompt({ topic: "t", angle: "a", summary: "s", facts, timeline: [], entities: [], glossary: [], dataAsks: [], quotes: d.quotes, hook: { stakes: [{ place: "Tokyo", factId: "F2" }], counterView: ["F8"] } }, wordBudget(10));
  assert.match(prompt, /HOOK SKELETON/);
  assert.match(prompt, /Q1: "q"/);
  assert.match(prompt, /COUNTER-VIEW FACTS/);
});

test("research: hook questions, verbatim non-UGC quotes, distinct stakes places", () => {
  const qs = planQuestions({ questions: Array.from({ length: 10 }, (_, i) => `q${i}`), hookQuestions: { myth: "m", stakes: "s", quote: "qq", counter: "c" } });
  assert.strictEqual(qs.length, 12);
  assert.deepStrictEqual(qs.slice(-4).map((x) => x.kind), ["myth", "stakes", "quote", "counter"]);
  assert.match(researchPrompt("t", "q", "quote"), /verbatim/);
  assert.match(planPrompt("t"), /hookQuestions/);
  const reg = makeRegistry();
  reg.add({ uri: "https://www.reuters.com/a", title: "reuters.com" });
  reg.add({ uri: "https://www.reddit.com/r/x", title: "reddit.com" });
  const notes = "The governor said “We will not raise rates until wages grow” in 2023. Someone wrote “made up words here”.";
  const raw = {
    facts: [{ id: "F1", claim: "a", value: 5, unit: "%", sourceIds: ["S1"] }, { id: "F2", claim: "b", value: 7, unit: "%", sourceIds: ["S1"] }, { id: "F3", claim: "c", sourceIds: ["S1"] }],
    hook: { belief: { text: "b", factIds: ["F3", "F9"] }, irony: { text: "i", factIds: ["F1"] }, stakes: [{ place: "Japan", factId: "F1" }, { place: "japan", factId: "F2" }, { place: "Peru", factId: "F3" }], counterView: ["F2", "F77"] },
    quotes: [
      { id: "Q1", text: "We will not raise rates until wages grow", speaker: "The Governor", sourceIds: ["S1"] },
      { id: "Q2", text: "We will not raise rates until wages grow", speaker: "The Governor", sourceIds: ["S2"] }, // UGC only
      { id: "Q3", text: "We will never raise rates again, ever", speaker: "X", sourceIds: ["S1"] }, // not verbatim in notes
    ],
  };
  const d = finalizeDossier(raw, "t", "a", reg.list, notes);
  assert.deepStrictEqual(d.quotes.map((q) => q.text), ["We will not raise rates until wages grow"]);
  assert.strictEqual(d.quotes[0].id, "Q1");
  assert.deepStrictEqual(d.hook.stakes.map((s) => s.place), ["Japan"]); // duplicate place and non-numeric fact dropped
  assert.deepStrictEqual(d.hook.belief.factIds, ["F3"]);
  assert.deepStrictEqual(d.hook.counterView, ["F2"]);
  assert.deepStrictEqual(finalizeQuotes([{ text: "too short", speaker: "x", sourceIds: ["S1"] }], { S1: reg.list[0] }, null), []);
  assert.strictEqual(finalizeHook(null, []).stakes.length, 0);
});

test("script schema: normalizeSection + autoFix keep tags, montage lines and anchor line", () => {
  const sec = { id: "cold", words: 40 };
  const raw = {
    mood: "tension", energy: 4,
    sentences: [{ text: "Lost decades.", devices: ["chorus"], visual: "concept" }, { text: "It fell by ten percent.", factIds: ["F1"], visual: "number", devices: ["stakes"] }],
    montageLines: ["Lost decades.", { text: "Zero growth.", factIds: [] }], anchorLine: { text: "Three percent growth is not a miracle", quoteId: "Q1" },
  };
  const s = autoFix(normalizeSection(sec, raw));
  assert.strictEqual(s.mood, "tension");
  assert.strictEqual(s.energy, 4);
  assert.deepStrictEqual(s.sentences.map((x) => [x.id, x.visual]), [["cold-s01", "concept"], ["cold-s02", "number"]]);
  assert.deepStrictEqual(s.montageLines.map((l) => l.text), ["Lost decades.", "Zero growth."]);
  assert.strictEqual(s.anchorLine.quoteId, "Q1");
  const probs = checkAll([s], { facts: [{ id: "F1", claim: "fell", value: 10, unit: "%" }], glossary: [], quotes: QD.quotes, timeline: [] })[0];
  assert.ok(probs.some((x) => /montageLines needs 5-7/.test(x)));
  assert.ok(probs.some((x) => /cold open lacks the irony pivot/.test(x)));
  assert.strictEqual(SCRIPT_VERSION, "lf-script.v2");
});

test("script prompt carries voice rules, tags, hook skeleton and montage schema", () => {
  const dossier = { topic: "t", angle: "a", facts: [{ id: "F1", claim: "c", value: 1, unit: "%" }], glossary: [], quotes: QD.quotes, hook: { counterView: ["F1"] } };
  const outline = {
    title: "T", runningJoke: "j", coldOpen: { id: "cold", words: 150, hook: "h", factIds: ["F1"] },
    hook: { chorus: "Lost decades.", anchorQuote: { quoteId: "Q1" }, myth: { belief: "b", reveal: "r", factIds: [] }, stakesTour: [{ place: "Tokyo", factId: "F1", line: "l" }], ironyPivot: { thesis: "t", factIds: [] }, statDefinitionMetaphor: {}, caseStudy: {}, questionStack: ["What about you?"] },
    chapters: [{ id: "ch1", index: 1, title: "A", question: "Why?", words: 100, beats: [], metaphor: "m", caseStudy: "c", butTurn: "b", cliffhanger: "x?" }],
    recap: { id: "recap", words: 45, takeaways: [] },
  };
  const cold = scriptPrompt(dossier, outline, outline.coldOpen);
  for (const re of [/SHORT sentences/, /Talk TO the viewer/, /"visual"/, /"devices"/, /"montageLines"/, /"anchorLine"/, /HOOK SKELETON/, /Three percent growth is not a miracle/, /COUNTER-VIEW/]) assert.match(cold, re);
  const ch = scriptPrompt(dossier, outline, outline.chapters[0]);
  assert.match(ch, /open question -> story\/example -> numbers \+ metaphor/);
  assert.doesNotMatch(ch, /"montageLines"/);
});
