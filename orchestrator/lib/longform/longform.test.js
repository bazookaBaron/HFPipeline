"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { parseSpokenNumbers, checkSentenceNumbers, evalCalc, unitScale, close } = require("./numbers");
const { fkGrade, jargonProblems, sectionProblems, relevantFactIds } = require("./checks");
const { wordBudget, chapterCount, outlineProblems } = require("./outline");
const { finalizeDossier, annotate, makeRegistry } = require("./research");

const val = (s) => parseSpokenNumbers(s).map((n) => n.value);

test("number parser: Indian and western scales, decimals, percent", () => {
  assert.deepStrictEqual(val("It owed nine thousand crore rupees."), [9e10]);
  assert.deepStrictEqual(val("two point five lakh crore"), [2.5e12]);
  assert.deepStrictEqual(val("one lakh twenty thousand people"), [120000]);
  assert.deepStrictEqual(val("one point two billion dollars"), [1.2e9]);
  assert.deepStrictEqual(val("thirty five thousand crore"), [3.5e11]);
  assert.deepStrictEqual(val("six hundred and fifty"), [650]);
  assert.deepStrictEqual(val("a hundred planes"), [100]);
  assert.deepStrictEqual(val("one and a half billion"), [1.5e9]);
  const p = parseSpokenNumbers("seventy three point five per cent of it")[0];
  assert.strictEqual(p.value, 73.5);
  assert.ok(p.percent);
  assert.ok(parseSpokenNumbers("forty-two percent")[0].percent);
});

test("number parser: years, boundaries, ordinals, digits", () => {
  for (const [s, y] of [["nineteen ninety one", 1991], ["twenty twelve", 2012], ["twenty twenty four", 2024], ["two thousand and twelve", 2012], ["nineteen oh five", 1905]]) {
    const n = parseSpokenNumbers(s)[0];
    assert.strictEqual(n.value, y, s);
    assert.ok(n.year, `${s} is a year`);
  }
  assert.deepStrictEqual(val("In twenty twelve, nine banks lost money"), [2012, 9]);
  assert.deepStrictEqual(val("two three"), [2, 3]);
  assert.ok(parseSpokenNumbers("the twenty-first century")[0].ordinal);
  assert.ok(parseSpokenNumbers("hundreds of flights")[0].plural);
  assert.ok(!parseSpokenNumbers("nine thousand crore")[0].year);
  const d = parseSpokenNumbers("It had 9,000 crore")[0];
  assert.strictEqual(d.value, 9e10);
  assert.ok(d.digits);
  assert.deepStrictEqual(val("No one knew. Someone often said it."), [1]);
});

test("unit scales and rounding tolerance", () => {
  assert.strictEqual(unitScale("INR crore"), 1e7);
  assert.strictEqual(unitScale("INR lakh crore"), 1e12);
  assert.strictEqual(unitScale("USD billion"), 1e9);
  assert.strictEqual(unitScale("%"), 1);
  assert.ok(close(9000, 9091)); // "about nine thousand"
  assert.ok(close(7000, 7500) === false);
  assert.ok(close(90, 91.4));
  assert.strictEqual(evalCalc("F1 / 365", { F1: 3650 }), 10);
  assert.strictEqual(evalCalc("(F1 - F2) * 100 / F2", { F1: 150, F2: 100 }), 50);
  assert.throws(() => evalCalc("F9 + 1", { F1: 1 }));
  assert.throws(() => evalCalc("process.exit()", {}));
});

const DOSSIER = {
  topic: "t",
  facts: [
    { id: "F1", claim: "debt", value: 9091, unit: "INR crore", year: 2012 },
    { id: "F2", claim: "share", value: 20, unit: "%", year: 2011 },
    { id: "F3", claim: "fleet", value: 66, unit: "aircraft", year: 2011 },
    { id: "F4", claim: "founded", year: 2003 },
  ],
  timeline: [{ year: 2005, event: "first flight", factIds: [] }],
  glossary: [{ term: "working capital", plain: "the cash a business needs to pay daily bills" }],
};

test("number gate: facts, years, calc, rejects", () => {
  const ok = checkSentenceNumbers({ text: "By twenty twelve it owed about nine thousand crore rupees, and flew sixty-six planes.", factIds: ["F1", "F3"] }, DOSSIER);
  assert.deepStrictEqual(ok.problems, []);
  assert.deepStrictEqual(ok.factIds.sort(), ["F1", "F3"]);
  assert.deepStrictEqual(checkSentenceNumbers({ text: "It started flying in two thousand five with twenty percent share.", factIds: ["F2"] }, DOSSIER).problems, []);
  // a figure matching a fact the sentence does not cite is flagged (often a coincidence)
  assert.match(checkSentenceNumbers({ text: "It had twenty percent share." }, DOSSIER).problems[0], /does not cite/);
  // days of the month are not figures; secondary figures in a fact's own claim are allowed
  assert.deepStrictEqual(checkSentenceNumbers({ text: "On October twenty, twenty twelve, it stopped." }, DOSSIER).problems, []);
  const d2 = { facts: [{ id: "F9", claim: "EBITDA of Rs 140 crore against interest of Rs 1,313 crore in FY2011", value: 140, unit: "INR crore", year: 2011 }] };
  assert.deepStrictEqual(checkSentenceNumbers({ text: "Interest alone was about one thousand three hundred crore.", factIds: ["F9"] }, d2).problems, []);
  assert.deepStrictEqual(checkSentenceNumbers({ text: "Two friends and three dreams." }, DOSSIER).problems, []);
  const bad = checkSentenceNumbers({ text: "It lost seven hundred crore in nineteen ninety nine." }, DOSSIER);
  assert.strictEqual(bad.problems.length, 2);
  // "twenty percent" must not be licensed by a non-percent fact, and 66 percent is not a share fact
  assert.strictEqual(checkSentenceNumbers({ text: "Sixty-six percent of flights." }, DOSSIER).problems.length, 1);
  // a derived number is licensed only by a verified calc: 9091 crore / 66 planes ~ 137.7 crore per plane
  const derivedText = "That's about one hundred and thirty-eight crore rupees of debt per plane.";
  assert.strictEqual(checkSentenceNumbers({ text: derivedText }, DOSSIER).problems.length, 1);
  const viaCalc = checkSentenceNumbers({ text: derivedText, calc: [{ expr: "F1 / F3" }] }, DOSSIER);
  assert.deepStrictEqual(viaCalc.problems, []);
  assert.deepStrictEqual(viaCalc.factIds.sort(), ["F1", "F3"]);
  assert.strictEqual(checkSentenceNumbers({ text: derivedText, calc: [{ expr: "F1 / F2" }] }, DOSSIER).problems.length, 1);
  assert.match(checkSentenceNumbers({ text: "It owed 9,091 crore." }, DOSSIER).problems[0], /digits/);
});

test("Flesch-Kincaid grade", () => {
  const easy = ["The cat sat on the mat.", "It was a big cat.", "Then it ran off."];
  const hard = ["Institutional creditors systematically underestimated the organisation's deteriorating liquidity position, precipitating catastrophic consequences."];
  assert.ok(fkGrade(easy) < 2, `easy ${fkGrade(easy)}`);
  assert.ok(fkGrade(hard) > 14, `hard ${fkGrade(hard)}`);
  assert.strictEqual(fkGrade([]), 0);
});

test("jargon check: explained in same or next sentence", () => {
  const g = DOSSIER.glossary;
  const good = [{ id: "a", text: "It ran out of working capital." }, { id: "b", text: "That's the cash a business needs to pay its daily bills." }];
  assert.deepStrictEqual(jargonProblems(good, g), []);
  const marker = [{ id: "a", text: "Working capital, which means cash for the daily bills, dried up." }];
  assert.deepStrictEqual(jargonProblems(marker, g), []);
  const bad = [{ id: "a", text: "It ran out of working capital." }, { id: "b", text: "Planes stayed on the ground." }, { id: "c", text: "That's cash a business needs for daily bills." }];
  assert.strictEqual(jargonProblems(bad, g).length, 1);
  assert.deepStrictEqual(jargonProblems([{ id: "a", text: "No jargon here." }], g), []);
});

test("section checks: length, CTA, advice, loaded labels", () => {
  const sec = { id: "ch1", sentences: [
    { text: "This is one very long sentence that keeps going and going with far too many words for anyone to follow it easily at all today." },
    { text: "Like and subscribe for more." },
    { text: "You should buy this stock now." },
    { text: "It is a failed state." },
  ] };
  const p = sectionProblems(sec, { dossier: DOSSIER });
  assert.ok(p.some((x) => /words \(max 22\)/.test(x)));
  assert.ok(p.some((x) => /channel CTA/.test(x)));
  assert.ok(p.some((x) => /investment advice/.test(x)));
  assert.ok(p.some((x) => /loaded label/.test(x)));
  assert.strictEqual(sec.sentences[0].id, "ch1-1");
  const dense = { id: "ch2", sentences: [
    { text: "Its cost was four point three one rupees a seat.", factIds: [] },
    { text: "It owed nine thousand crore, had sixty-six planes and twenty percent share.", factIds: ["F1", "F2", "F3"] },
    { text: "Mallya gave a personal guarantee to the banks.", factIds: [] },
  ] };
  const q = sectionProblems(dense, { dossier: { ...DOSSIER, facts: [...DOSSIER.facts, { id: "F5", claim: "cost", value: 4.31, unit: "INR" }] } });
  assert.ok(q.some((x) => /too precise/.test(x)), q.join("\n"));
  assert.ok(q.some((x) => /packs 3 figures/.test(x)));
  assert.ok(!q.some((x) => /absolute outcome/.test(x)), "personal guarantee is a noun, not a claim");
});

test("fact ids are pruned to the ones a sentence uses", () => {
  const s = { text: "The airline was founded with a big launch party.", factIds: ["F1", "F4"] };
  const d = { facts: [{ id: "F1", claim: "debt of 9091 crore" }, { id: "F4", claim: "The airline was founded in 2003" }] };
  assert.deepStrictEqual(relevantFactIds(s, [], d), ["F4"]);
  assert.deepStrictEqual(relevantFactIds(s, ["F1"], d).sort(), ["F1", "F4"]);
});

// a valid hook skeleton over facts F1..F14 with numeric values (no dossier quotes -> anchorQuote null)
const HOOK = {
  chorus: "Lost decades.",
  anchorQuote: { quoteId: null },
  myth: { belief: "Japan is poor now", reveal: "it is still rich", factIds: ["F1"] },
  stakesTour: [{ place: "Tokyo", factId: "F2", line: "l", why: "w", scene: "s" }, { place: "Osaka", factId: "F3", line: "l", why: "w", scene: "s" }, { place: "Germany", factId: "F4", line: "l", why: "w", scene: "s" }],
  ironyPivot: { thesis: "But the irony is...", explain: "e", factIds: ["F5"] },
  joke: "j",
  statDefinitionMetaphor: { factId: "F6", definition: "d", metaphor: "m" },
  caseStudy: { name: "Yubari", place: "Hokkaido", factIds: ["F7"] },
  questionStack: ["How?", "Why?", "What does it mean for your savings?"],
};

test("outline word budget", () => {
  for (const m of [8, 10, 12]) {
    const b = wordBudget(m);
    assert.strictEqual(b.coldOpen + b.recap + b.chapters.reduce((a, x) => a + x, 0), b.total);
    assert.strictEqual(b.chapters.length, chapterCount(m));
    assert.ok(b.chapters.length >= 6 && b.chapters.length <= 8);
    assert.ok(Math.max(...b.chapters) - Math.min(...b.chapters) <= 1);
  }
  const b10 = wordBudget(10);
  assert.strictEqual(b10.total, 1600); // 160 wpm gross (pace.js PACE.LF)
  assert.ok(b10.coldOpen >= 180 && b10.coldOpen <= 300); // hook skeleton: ~68-112 s
  assert.ok(wordBudget(8).total >= 1200 && wordBudget(12).total <= 1920);
});

test("outline word budget: short runs scale down (3 min = cold open + 3 short chapters + recap)", () => {
  const b3 = wordBudget(3);
  assert.strictEqual(b3.total, 480);
  assert.strictEqual(b3.chapters.length, 3); // YouTube needs >= 3 chapters
  assert.strictEqual(b3.coldOpen + b3.recap + b3.chapters.reduce((a, x) => a + x, 0), 480);
  assert.strictEqual(b3.coldOpen, 180, `cold ${b3.coldOpen}`); // the hook skeleton needs ~68 s even on short runs
  assert.ok(b3.recap >= 45 && b3.recap <= 60);
  // every chapter far above YouTube's 10 s minimum at 160 wpm
  assert.ok(Math.min(...b3.chapters) / 160 * 60 >= 30);
  assert.strictEqual(chapterCount(4), 3);
  assert.strictEqual(chapterCount(5), 4);
  assert.strictEqual(wordBudget(2).chapters.length, 3);
  const { isShort, outlinePrompt } = require("./outline");
  assert.ok(isShort(b3) && !isShort(wordBudget(10)));
  const p = outlinePrompt({ topic: "t", angle: "a", summary: "s", facts: [], timeline: [], entities: [], glossary: [], dataAsks: [] }, b3);
  assert.match(p, /Exactly 3 chapters/);
  assert.match(p, /SHORT video/);
  assert.match(p, /2-3 causal story beats/);
  // short outlines: 2 beats and 2 callbacks are enough
  const facts = Array.from({ length: 14 }, (_, i) => ({ id: `F${i + 1}`, value: i + 1 }));
  const ch = (i) => ({ title: "t", question: "q", example: "e", comedicBeat: "c", metaphor: "m", caseStudy: "cs", butTurn: "b", cliffhanger: "next?", callback: i < 2 ? "cb" : "", beats: ["a", "b"], factIds: [`F${3 * i + 1}`, `F${3 * i + 2}`, `F${3 * i + 3}`], visuals: [{ type: "photo", entity: "X" }, { type: "number", factId: "F1" }] });
  const o = { title: "T", runningJoke: "j", hook: HOOK, coldOpen: { hook: "h", beats: ["b"] }, chapters: [0, 1, 2].map(ch), recap: { takeaways: ["a", "b", "c"] } };
  assert.deepStrictEqual(outlineProblems(o, { facts }, b3), []);
});

test("outline problems catch structural gaps", () => {
  const b = wordBudget(8);
  const facts = Array.from({ length: 14 }, (_, i) => ({ id: `F${i + 1}`, value: i + 1 }));
  const ch = (i) => ({ title: "t", question: "q", example: "e", comedicBeat: "c", metaphor: "m", caseStudy: "cs", butTurn: "b", cliffhanger: "next?", callback: "cb", beats: ["a", "b", "c"], factIds: [`F${2 * i + 1}`, `F${2 * i + 2}`], visuals: [{ type: "photo", entity: "X" }, { type: "chart", metric: "m" }] });
  const good = { title: "T", runningJoke: "j", hook: HOOK, coldOpen: { hook: "h", beats: ["b"] }, chapters: Array.from({ length: 6 }, (_, i) => ch(i)), recap: { takeaways: ["a", "b", "c"] } };
  assert.deepStrictEqual(outlineProblems(good, { facts }, b), []);
  const bad = { ...good, chapters: good.chapters.slice(0, 5).map((c) => ({ ...c, visuals: [{ type: "gif" }] })) };
  const p = outlineProblems(bad, { facts }, b);
  assert.ok(p.some((x) => /exactly 6 chapters/.test(x)));
  assert.ok(p.some((x) => /unknown type gif/.test(x)));
  assert.ok(p.some((x) => /photo visual/.test(x)));
});

test("research: source markers and dossier finalisation never invent URLs", () => {
  const reg = makeRegistry();
  const ans = { text: "Debt rose. It collapsed.", chunks: [{ uri: "https://a.example/x", title: "a.example" }, { uri: "https://b.example/y", title: "b.example" }], supports: [{ segment: { text: "Debt rose." }, groundingChunkIndices: [1] }, { segment: { text: "It collapsed." }, groundingChunkIndices: [0, 1] }] };
  const { text } = annotate(ans, reg);
  assert.strictEqual(text, "Debt rose. [S2] It collapsed. [S1,S2]");
  const d = finalizeDossier({ facts: [
    { id: "F1", claim: "c", value: "9,000", unit: "INR crore", year: "2012", sourceIds: ["S1", "S2"], confidence: "high" },
    { id: "F2", claim: "unsourced", sourceIds: ["S9"] },
    { id: "F3", claim: "one source", sourceIds: ["S1"], confidence: "high" },
  ], entities: [{ name: "Kingfisher", kind: "airline" }], glossary: [{ term: "NPA", plain: "a loan that stopped being repaid" }], dataAsks: [{ metric: "m", worldBankIndicator: "DT.DOD.DECT.GN.ZS", years: [2000, 2020] }] }, "t", "a", reg.list);
  assert.deepStrictEqual(d.facts.map((f) => f.id), ["F1", "F3"]);
  // global audience: crore amounts are normalised to billions (9,000 crore = 90 billion)
  assert.strictEqual(d.facts[0].value, 90);
  assert.strictEqual(d.facts[0].unit, "INR billion");
  assert.strictEqual(d.facts[0].sources[1].url, "https://b.example/y");
  assert.strictEqual(d.facts[1].confidence, "medium");
  assert.strictEqual(d.entities[0].kind, "concept");
  assert.strictEqual(d.dataAsks[0].worldBankIndicator, "DT.DOD.DECT.GN.ZS");
  assert.strictEqual(d.numbersPolicy, "only facts[].value may be spoken or shown");
});
