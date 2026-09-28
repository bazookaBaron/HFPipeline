"use strict";

// Beat sheet rules (lib/longform/beatSheet.js), the storyboard variety gate (storyboardLF.varietyProblems)
// and the set-2 module schemas / compile pass (lib/video/v3/lf2.js). Offline, no model.

const test = require("node:test");
const assert = require("node:assert");
const BS = require("./beatSheet");
const SL = require("./storyboardLF");
const { lf2Problems, resolveLF2, raceFrames } = require("../video/v3/lf2");
const { compileStoryboard } = require("../video/v3/compile");
const { syntheticTimeline, PROFILES } = require("../video/v3/storyboardGen");

// a synthetic ~6 minute script with every hint kind, some sentences tagged (WS-F) and some not
const LINES = [
  "Argentina borrowed money from banks in London and shipped wheat across the Atlantic.",
  "Inflation rose every year for three decades.",
  "The debt reached forty six billion dollars.",
  "One in four families lost their savings.",
  "Imagine paying rent in a currency that melts.",
  "The president signed a decree in two thousand one.",
  "Brazil grew while Argentina shrank.",
  "Banks lent to the government, which paid the banks back with new loans.",
  "Economists called it a doom loop.",
  "Ships carried soybeans from Rosario to Shanghai.",
  "The peso lost half its value in a week.",
  "Crowds gathered outside the central bank.",
];
function script(nSections = 6) {
  const sections = [];
  let k = 0;
  const ids = ["cold", ...Array.from({ length: nSections - 2 }, (_, i) => `ch${i + 1}`), "recap"];
  ids.forEach((id) => {
    const sentences = [];
    for (let i = 0; i < 12; i++) {
      const text = LINES[(k + i) % LINES.length];
      sentences.push({ id: `${id}-s${String(i + 1).padStart(2, "0")}`, text, factIds: [], ...(i % 3 === 0 ? { visual: ["geo", "number", "trend", "concept"][(k + i) % 4] } : {}) });
    }
    k += 5;
    sections.push({ id, sentences, mood: "tension", energy: 3 });
  });
  return { sections };
}
const DATA = { series: [{ id: "S1", kind: "time", country: "ARG", metric: "inflation", indicator: "FP.CPI", points: [{ x: 2000, y: 1 }] }, { id: "S2", kind: "map", values: { ARG: 200, BRA: 5 } }] };

test("hints: WS-F tags win; heuristics place the rest deterministically", () => {
  const places = new Set(["argentina", "london", "brazil"]);
  assert.strictEqual(BS.hintOf({ text: "Anything at all.", visual: "quote" }, places).hint, "quote");
  assert.strictEqual(BS.hintOf({ text: "Ships carried wheat from Argentina to London." }, places).hint, "geo");
  assert.strictEqual(BS.hintOf({ text: "Inflation rose every year." }, places).hint, "trend");
  assert.strictEqual(BS.hintOf({ text: "The debt reached forty billion dollars." }, places).hint, "number");
  assert.strictEqual(BS.hintOf({ text: "Imagine a club issuing drink tokens." }, places).hint, "joke");
  assert.strictEqual(BS.hintOf({ text: "It was a strange idea." }, places).source, "default");
});

test("beat sheet: structure first, hard rules hold video-wide, mix targets roughly met", async () => {
  const b = await BS.buildBeatSheet(script(8), { data: DATA });
  assert.strictEqual(b.version, "beats.v2");
  assert.deepStrictEqual(BS.planProblems(b), []);
  assert.strictEqual(b.sections.cold.scenes[0].kind, "cold");
  assert.strictEqual(b.sections.ch1.scenes[0].kind, "chapter");
  assert.strictEqual(b.sections.recap.scenes[1].kind, "recapList");
  const flat = Object.values(b.sections).flatMap((s) => s.scenes);
  for (let i = 1; i < flat.length; i++) assert.notStrictEqual(flat[i].kind, flat[i - 1].kind, `repeat at ${flat[i].from}`);
  const maps = flat.filter((s) => s.category === "map");
  assert.ok(maps.length >= 2, "places in the script get maps");
  for (let i = 1; i < maps.length; i++) assert.ok(maps[i].t0 - maps[i - 1].t0 >= BS.RULES.mapGapS);
  const content = flat.filter((s) => s.category !== "structure");
  const cap = Math.max(1, Math.floor(BS.RULES.maxShare * content.length));
  Object.entries(b.stats.byKind).forEach(([k, n]) => k !== "recapList" && assert.ok(n <= cap, `${k} ${n} > ${cap}`));
  assert.ok(Object.keys(b.stats.byKind).length >= 8, "at least 8 distinct kinds");
  assert.ok(b.stats.byCategory.media >= 20 && b.stats.byCategory.media <= 50, `media ${b.stats.byCategory.media}`);
  flat.filter((s) => s.kind !== "recapList").forEach((s) => assert.ok(s.seconds <= 12, `${s.from} runs ${s.seconds} s`));
  // deterministic + keyed
  const b2 = await BS.buildBeatSheet(script(8), { data: DATA });
  assert.deepStrictEqual(b2, b);
});

test("beat sheet: at most one lite call, only for untagged sentences the rules cannot place", async () => {
  const s = { sections: [{ id: "cold", sentences: ["It was odd.", "Nobody knew why.", "Things changed.", "People wondered."].map((text, i) => ({ id: `c${i}`, text })) }] };
  let calls = 0;
  const gemini = { json: async (prompt, o) => (calls++, assert.strictEqual(o.task, "longform.beats"), { hints: { c1: "event", c2: "trend", c3: "bogus" } }) };
  const b = await BS.buildBeatSheet(s, { gemini });
  assert.strictEqual(calls, 1);
  assert.strictEqual(b.stats.refined, 2);
  const failing = { json: async () => { throw new Error("HTTP 500"); } };
  const b3 = await BS.buildBeatSheet(s, { gemini: failing });
  assert.strictEqual(b3.stats.refined, 0);
});

// ---- variety gate
const sentences = Array.from({ length: 8 }, (_, i) => ({ id: `s${i + 1}`, text: "The money moved from one bank to another bank quickly today." }));
const sc = (id, from, template, slots) => ({ id, template, from, slots });
const photo = (slot) => ({ hero: { type: "photo", props: { slot } } });

test("variety gate: plan compliance, no back-to-back repeats, map spacing, precise messages", () => {
  const plan = [
    { n: 1, from: "s1", sentences: ["s1"], kind: "chapter" },
    { n: 2, from: "s2", sentences: ["s2", "s3"], kind: "lfYearTimeline" },
    { n: 3, from: "s4", sentences: ["s4", "s5"], kind: "countryMap" },
    { n: 4, from: "s6", sentences: ["s6", "s7", "s8"], kind: "photo" },
  ];
  const good = { sentences, scaffolds: [sc("a", "s1", "lfChapter", {}), sc("b", "s2", "lfFeature", { hero: { type: "lfYearTimeline" } }), sc("c", "s4", "lfMap", { map: { type: "countryMap" } }), sc("d", "s6", "lfStage", photo("x"))] };
  assert.deepStrictEqual(SL.varietyProblems(good, plan), []);
  const bad = { sentences, scaffolds: [sc("a", "s1", "lfChapter", {}), sc("b", "s2", "lfStage", photo("x")), sc("c", "s4", "lfStage", photo("y")), sc("d", "s7", "lfMap", { map: { type: "worldMap" } })] };
  const P = SL.varietyProblems(bad, plan).join("\n");
  assert.match(P, /scaffold b: the scene plan assigns lfYearTimeline to the scene from s2/);
  assert.match(P, /scaffold c: the scene plan assigns countryMap/);
  assert.match(P, /scene plan: scene 4 \(photo\) must be a scaffold starting at sentence s6/);
  assert.match(P, /scaffolds b and c are both photo/);
  // without a plan: repeats of a non-photo kind and maps closer than 60 s still fail
  const maps = { sentences, scaffolds: [sc("a", "s1", "lfChapter", {}), sc("b", "s2", "lfMap", { map: { type: "countryMap" } }), sc("c", "s5", "lfMap", { map: { type: "countryMap" } })] };
  const Q = SL.varietyProblems(maps, null).join("\n");
  assert.match(Q, /both countryMap/);
  assert.match(Q, /a second map only \d+ s after b/);
});

test("sceneKind maps every LF template to the beat-sheet vocabulary", () => {
  assert.strictEqual(SL.sceneKind(sc("x", "s1", "lfChart", { chart: { type: "lineChart" } })), "lineChart");
  assert.strictEqual(SL.sceneKind(sc("x", "s1", "lfDuo", {})), "splitScreen");
  assert.strictEqual(SL.sceneKind(sc("x", "s1", "lfQuote", {})), "quoteCard");
  assert.strictEqual(SL.sceneKind(sc("x", "s1", "lfMap", {})), "countryMap");
  Object.entries(BS.KINDS).forEach(([k, K]) => assert.ok(K.template && K.category, k));
});

test("plan reaches the prompt (static catalog first) and the resume hash", () => {
  const ctx = { section: { id: "ch1", sentences }, meta: { kind: "chapter", index: 1, count: 4, title: "T" }, dossier: { facts: [] }, outline: { chapters: [] }, topic: "t", plan: [{ n: 1, from: "s1", sentences: ["s1"], seconds: 5, kind: "chapter" }, { n: 2, from: "s2", sentences: ["s2"], seconds: 6, kind: "flowDiagram" }] };
  const p = SL.buildPromptLF(ctx);
  assert.ok(p.startsWith(SL.staticPromptLF()), "static part is the prefix");
  assert.match(p, /SCENE PLAN \(hard/);
  assert.match(p, /scene 2: "from": "s2".*flowDiagram/);
  assert.match(p, /- quoteCard: /);
  assert.notStrictEqual(SL.sectionHash(ctx.section, ctx.meta, SL.planKey(ctx.plan)), SL.sectionHash(ctx.section, ctx.meta));
  assert.strictEqual(SL.planKey(null), "");
});

// ---- module schemas + compile pass
test("set-2 module schemas catch bad props", () => {
  assert.deepStrictEqual(lf2Problems("quoteCard", { quote: "Calling paper a dollar works until someone brings a tape measure.", source: "X", highlight: "tape measure" }, "q"), []);
  assert.match(lf2Problems("quoteCard", { quote: "Too short", highlight: "nope" }, "q").join("|"), /needs source.*|highlight "nope"/);
  assert.match(lf2Problems("flowDiagram", { nodes: [{ id: "a", label: "A" }, { id: "b", label: "B", icon: "rocket" }], flows: [{ from: "a", to: "z" }] }, "f").join("|"), /icon must be one of[\s\S]*flow 1 must join/);
  assert.match(lf2Problems("pictogramGrid", { total: 200, filled: 3, label: "x" }, "p").join("|"), /total must be 4-100/);
  assert.match(lf2Problems("documentStamp", { stamp: "A VERY LONG STAMP WORD", title: "T" }, "d").join("|"), /2-12 characters/);
  assert.match(lf2Problems("splitScreen", { left: { slot: "a" } }, "s").join("|"), /needs left and right/);
  assert.match(lf2Problems("lfYearTimeline", { items: [{ year: "x", label: "" }] }, "t").join("|"), /2-8 items[\s\S]*numeric year/);
  assert.deepStrictEqual(lf2Problems("flashBurst", { items: [{ slot: "a" }, { slot: "b" }, { slot: "c" }], kicker: "Too many words here" }, "b").length, 1);
});

test("barRace frames from a map series (top N + highlight by ISO3) and from time series", () => {
  const r = raceFrames({ values: { ARG: 211, VEN: 190, TUR: 50, USA: 3, IND: 5, DEU: 2 }, year: 2023, top: 3, highlight: "IND" }, "t");
  assert.strictEqual(r.frames.length, 1);
  assert.deepStrictEqual(r.frames[0].bars.map((b) => b.name), ["Argentina", "Venezuela", "India"]);
  assert.strictEqual(r.highlight, "India");
  const t = raceFrames({ series: [{ name: "A", points: [{ x: 2000, y: 1 }, { x: 2001, y: 3 }] }, { name: "B", points: [{ x: 2000, y: 2 }, { x: 2001, y: 1 }] }] }, "t");
  assert.deepStrictEqual(t.frames.map((f) => f.label), ["2000", "2001"]);
  assert.throws(() => raceFrames({}, "w"), /barRace needs/);
});

test("compile: set-2 templates lay out, word-driven modules switch auto off, routeMap resolves stops and legs", () => {
  const sb = {
    version: "storyboard.v3", profile: "LF", frame: { w: 1920, h: 1080 }, topic: "t", sentences,
    scaffolds: [
      sc("a", "s1", "lfFeature", { title: { props: { title: "Two centuries" } }, hero: { id: "tl", type: "lfYearTimeline", props: { items: [{ year: 1824, label: "Loan" }, { year: 2001, label: "Default" }] } } }),
      sc("b", "s3", "lfQuote", { quote: { id: "q", props: { quote: "Money moved quickly between the two banks today.", source: "Someone" } } }),
      sc("c", "s5", "lfMap", { map: { id: "r", type: "routeMap", props: { stops: [{ city: "london" }, { city: "buenos aires" }, { city: "new york" }], legs: [{ from: 1, to: 2, label: "Loan" }, { from: 2, to: 3 }] } } }),
      sc("d", "s7", "lfDuo", { split: { id: "sp", props: { left: { slot: "a", label: "A" }, right: { slot: "b", label: "B" } } } }),
    ],
    events: [{ sentence: "s2", anchor: { text: "money" }, op: "go", target: "tl", value: { i: 1 } }, { sentence: "s6", anchor: { text: "money" }, op: "leg", target: "r", value: { i: 2 } }],
  };
  const spec = compileStoryboard(sb, syntheticTimeline(sb, PROFILES.LF.syn), { mascot: false });
  const mod = (id) => spec.scaffolds.flatMap((s) => s.modules).find((m) => m.id === id);
  assert.strictEqual(mod("tl").props.auto, false);
  assert.strictEqual(mod("q").props.auto, undefined);
  const r = mod("r");
  assert.strictEqual(r.type, "routeMap");
  assert.strictEqual(r.props.pins.filter((p) => p.stop).length, 3);
  assert.strictEqual(r.props.arrows.filter((a) => a.route).length, 2);
  assert.strictEqual(r.props.auto, false);
  assert.ok(r.props.geo.grat.length > 1000, "graticule shipped");
  assert.ok(r.props.geo.countries.every((c) => Array.isArray(c.c) || c.c === null));
  assert.deepStrictEqual(mod("sp").rect, [0, 0, 1920, 1080]);
  assert.ok(spec.scaffolds[0].modules.some((m) => m.type === "lfText"), "lfFeature title");
  // resolveLF2 is idempotent on an already compiled spec
  resolveLF2(spec.scaffolds, spec.events);
});

test("documentStamp honesty: invented numbers / letterheads fail, dossier strings and generic text pass", () => {
  const { docStampProblems } = require("../video/v3/lf2");
  const dossier = "Argentina defaulted on $132 billion in December 2001. Decree 1606/2001 was published.";
  assert.deepStrictEqual(docStampProblems({ title: "Debt notice", lines: ["Suspension of debt payments"], date: "December 2001", stamp: "DEFAULT" }, dossier, "d"), []);
  assert.deepStrictEqual(docStampProblems({ title: "Debt notice", ref: "Decree 1606/2001", stamp: "DEFAULT" }, dossier, "d"), []);
  const P = docStampProblems({ title: "Ministerio de Economia", ref: "Decreto 999/2002", lines: ["Principal: US$ 77,000"], stamp: "DEFAULT" }, dossier, "d").join("\n");
  assert.match(P, /title "Ministerio de Economia" reads like a real official letterhead/);
  assert.match(P, /shows 999\/2002/);
  assert.match(P, /shows 77,000/);
});
