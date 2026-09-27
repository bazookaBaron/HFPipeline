"use strict";

// Deterministic storyboard auto-fixes (storyboardFix.js) and scene-level repair (sceneRepair.js), offline.
// Fixture: the LF pilot chapter (fixtures/v3/lf-pilot.json, the prompt's worked example), which validates clean;
// each test breaks it in one controlled way. The model is a fake `generate`; the layout audit is skipped
// (layoutAudit: false) -- raw layout findings are passed in by hand where a fixer uses them.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const SL = require("./storyboardLF");
const FX = require("./storyboardFix");
const SR = require("./sceneRepair");
const M = require("../ai/models");

const PILOT = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "fixtures", "v3", "lf-pilot.json"), "utf-8"));
const MEDIA = JSON.parse(SL.staticPromptLF().split("WORKED EXAMPLE")[1].split("\n").slice(1).join("\n")).output.media;
const clone = (x) => JSON.parse(JSON.stringify(x));

const section = { id: "ch2", sentences: PILOT.sentences.map((s) => ({ id: s.id, text: s.text })) };
const meta = { kind: "chapter", index: 2, count: 8, title: "The Air Deccan deal" };
const rawPilot = () => clone({ scaffolds: PILOT.scaffolds, events: PILOT.events, media: MEDIA });
const baseSb = () => SL.assemble(rawPilot(), { section, meta, topic: "Kingfisher" });
// the pilot's on-screen figures are the dossier facts (so the number gate passes)
const dossier = { facts: SL.screenNumbers(baseSb()).map((n, i) => ({ id: `F${i + 1}`, claim: "pilot figure", value: n.value })), timeline: [] };
const ctx = (extra = {}) => ({ section, meta, dossier, topic: "Kingfisher", outline: null, ...extra });
const validate = (sb, c = ctx()) => SL.validateChapter(sb, c, { layoutAudit: false });
const fixAll = async (sb, c = ctx()) => FX.applyAutoFixes(sb, c, await validate(sb, c), (x) => validate(x, c));
const fill = (sb, scId, key) => sb.scaffolds.find((s) => s.id === scId).slots[key];

test("fixture: the pilot chapter validates clean", async () => {
  const v = await validate(baseSb());
  assert.deepStrictEqual(v.problems, []);
});

test("text helpers: abbreviations, filler words, word/char limits, highlight kept in the text", () => {
  assert.strictEqual(FX.shortenWords("short label", 6), "short label");
  const t = FX.shortenWords("The International Monetary Fund lent 3 billion dollars to the government of Pakistan", 6);
  assert.ok(t.split(/\s+/).length <= 6, t);
  assert.match(t, /^The IMF lent 3B/);
  assert.ok(FX.shortenChars("Hyderabad International Airport", 14).length <= 14);
  assert.doesNotMatch(FX.shortenWords("Kingfisher bought a stake of Deccan and", 5), /\b(and|of)$/);
  const p = { title: "The shiny new toy of India's crowded skies in 2005", highlight: "shiny new toy" };
  p.title = FX.shortenWords(p.title, 8, p.highlight);
  FX.syncHighlight(p, "title");
  assert.ok(p.title.includes(p.highlight));
  const q = { title: "one two three", highlight: "gone phrase" };
  FX.syncHighlight(q, "title");
  assert.strictEqual(q.highlight, "two three");
  assert.strictEqual(FX.compact(1500000000), "1.5B");
});

test("auto-fix: over-long on-screen text is shortened (words + sub), no model call needed", async () => {
  const sb = baseSb();
  fill(sb, "toy", "title").props.title = "The shiny new toy of India's very crowded and noisy skies back in 2005";
  fill(sb, "toy", "title").props.sub = "A full paragraph that the narrator already says out loud.";
  fill(sb, "toy", "left")[0].props.text = "Leather seats and free headphones for every single passenger";
  fill(sb, "haunt", "lowerThird").props.sub = "The merger that set up the fall of the whole airline group";
  const v0 = await validate(sb);
  assert.ok(v0.problems.length >= 3, v0.problems.join(" | "));
  const r = await fixAll(sb);
  assert.deepStrictEqual(r.validation.problems, []);
  const title = fill(r.storyboard, "toy", "title").props;
  assert.ok(title.title.split(/\s+/).length <= 8, title.title);
  assert.ok(title.title.includes(title.highlight), "highlight phrase still in the title");
  assert.strictEqual(title.sub, undefined);
  assert.ok(fill(r.storyboard, "toy", "left")[0].props.text.split(/\s+/).length <= 6);
  assert.ok(r.fixes.some((f) => /^text: /.test(f)));
  assert.notStrictEqual(r.storyboard, sb, "the input storyboard is not mutated");
  assert.ok(fill(sb, "toy", "title").props.sub, "input kept");
});

test("auto-fix: layout-audit overflow shrinks an lfText title first, then cuts a callout by the measured px", () => {
  const sb = baseSb();
  const out = FX.fixText(sb, ctx(), [], {
    layout: [
      { kind: "text-outside-card", module: "toytxt:lfText", text: "The shiny new toy of India's skies", over: 120 },
      { kind: "text-clipped", module: "lowcost:callout", text: "India's first low-cost airline", over: 80 },
    ],
  });
  assert.strictEqual(fill(sb, "toy", "title").props.size, 61);
  assert.strictEqual(fill(sb, "toy", "title").props.maxLines, 2);
  const c = fill(sb, "deccan", "right")[0].props.text;
  assert.ok(c.length < "India's first low-cost airline".length, c);
  assert.strictEqual(out.length, 2);
});

test("auto-fix: overlap -- rails rebalanced, lower third next to a title dropped, back-to-back pushes become a cut", async () => {
  const sb = baseSb();
  const deal = sb.scaffolds.find((s) => s.id === "deal");
  deal.slots.left = [].concat(deal.slots.left, deal.slots.right);
  delete deal.slots.right;
  sb.scaffolds.find((s) => s.id === "papers").transition = { out: "zoomThrough", in: "zoomIn" };
  const v0 = await validate(sb);
  assert.ok(v0.problems.some((p) => /satellites unbalanced/.test(p)));
  assert.ok(v0.problems.some((p) => /two centre-push transitions in a row/.test(p)));
  const r = await fixAll(sb);
  assert.deepStrictEqual(r.validation.problems, []);
  const d = r.storyboard.scaffolds.find((s) => s.id === "deal").slots;
  assert.strictEqual([].concat(d.left).length, 1);
  assert.strictEqual([].concat(d.right).length, 1);
  assert.ok(!r.storyboard.scaffolds.find((s) => s.id === "papers").transition);
  // title + lower-third headline on one lfStage
  const sb2 = baseSb();
  fill(sb2, "toy", "title");
  sb2.scaffolds.find((s) => s.id === "toy").slots.headline = { id: "toylt", props: { title: "Kingfisher 2005" } };
  sb2.events.push({ sentence: "s3", anchor: { text: "Red," }, op: "highlight", target: "toylt" });
  FX.fixComposition(sb2, ctx(), []);
  assert.ok(!sb2.scaffolds.find((s) => s.id === "toy").slots.headline);
  assert.ok(!sb2.events.some((e) => e.target === "toylt"), "its events go with it");
});

test("auto-fix: overlays colliding in the layout audit are nudged apart", () => {
  const sb = baseSb();
  const before = fill(sb, "toy", "overlays")[0].at.slice();
  const out = FX.fixComposition(sb, ctx(), [], { layout: [{ kind: "card-overlap", modules: ["toyseat:callout", "toyred:callout"], frac: 0.4 }] });
  const after = fill(sb, "toy", "overlays")[0].at;
  assert.strictEqual(after[0], before[0]);
  assert.strictEqual(after[1], before[1] + 18);
  assert.match(out[0], /nudged/);
});

test("auto-fix: misc -- unused media intent, count op, text highlight without a phrase", async () => {
  const sb = baseSb();
  sb.mediaIntents.push({ slot: "spare", kind: "photo", intent: "an unused picture", size: "card" });
  delete fill(sb, "toy", "title").props.highlight; // the pilot highlights toytxt on "shiny"
  fill(sb, "deal", "number").props.count = "op"; // no count event on cheque
  const v0 = await validate(sb);
  assert.ok(v0.problems.some((p) => /declared but never used/.test(p)));
  const r = await fixAll(sb);
  assert.deepStrictEqual(r.validation.problems, []);
  assert.ok(!r.storyboard.mediaIntents.some((it) => it.slot === "spare"));
  assert.strictEqual(fill(r.storyboard, "toy", "title").props.highlight, "shiny new");
  assert.strictEqual(fill(r.storyboard, "deal", "number").props.count, "enter");
});

test("auto-fix: an unannotated photo gets a highlight on a word of its scene", async () => {
  const sb = baseSb();
  sb.scaffolds.find((s) => s.id === "deccan").slots.right = [];
  sb.events = sb.events.filter((e) => e.target !== "atr" && e.target !== "lowcost");
  sb.scaffolds.find((s) => s.id === "deccan").slots.left[0].anchor = undefined;
  const v0 = await validate(sb);
  assert.ok(v0.problems.some((p) => /photo deccan\/atr has no annotation/.test(p)), v0.problems.join(" | "));
  const out = FX.fixMisc(sb, ctx(), v0.problems);
  assert.ok(out.some((x) => /highlight added/.test(x)));
  assert.ok(sb.events.some((e) => e.target === "atr" && e.op === "highlight"));
});

test("auto-fix: numbers -- string figures parsed, huge raw figures scaled, decimals rounded, digit runs compacted", () => {
  const sb = baseSb();
  fill(sb, "deal", "number").props.value = "₹550";
  fill(sb, "deccan", "left")[0].props.value = 5500000000;
  delete fill(sb, "deccan", "left")[0].props.unit;
  delete fill(sb, "deccan", "left")[0].props.prefix;
  fill(sb, "rule", "left")[0].props.value = 5.123456;
  fill(sb, "toy", "left")[0].props.text = "1500000000 seats";
  fill(sb, "rule", "chart").props.bars[0].value = "2";
  const out = FX.fixNumbers(sb);
  assert.strictEqual(fill(sb, "deal", "number").props.value, 550);
  assert.strictEqual(fill(sb, "deccan", "left")[0].props.value, 5.5);
  assert.strictEqual(fill(sb, "deccan", "left")[0].props.unit, "billion");
  assert.strictEqual(fill(sb, "rule", "left")[0].props.value, 5.12);
  assert.strictEqual(fill(sb, "toy", "left")[0].props.text, "1.5B seats");
  assert.strictEqual(fill(sb, "rule", "chart").props.bars[0].value, 2);
  assert.ok(out.length >= 5);
  // rupee figures scale to crore
  const sb2 = baseSb();
  fill(sb2, "deal", "number").props.value = 5500000000;
  delete fill(sb2, "deal", "number").props.unit;
  FX.fixNumbers(sb2);
  assert.deepStrictEqual([fill(sb2, "deal", "number").props.value, fill(sb2, "deal", "number").props.unit], [550, "crore"]);
});

test("auto-fix: cadence -- beats/min over the band drops secondary events in the densest spot", async () => {
  const sb = baseSb();
  const toks = sb.sentences.flatMap((s) => s.text.split(/\s+/).map((w) => ({ sentence: s.id, w })));
  // a dim/undim on nearly every word of the timeline scene pushes the synthetic beats/min over 37
  toks.filter((x) => ["s10", "s11", "s12", "s13"].includes(x.sentence)).forEach((x, i) => {
    const target = { s10: "era", s11: "jokeart", s12: "cols", s13: "cols" }[x.sentence];
    sb.events.push({ sentence: x.sentence, anchor: { text: x.w, occurrence: toks.filter((y) => y.sentence === x.sentence && y.w === x.w).indexOf(x) + 1 }, op: i % 2 ? "undim" : "dim", target });
  });
  const v0 = await validate(sb);
  assert.ok(v0.problems.some((p) => /visual beats\/min is at the top/.test(p)), v0.problems.join(" | "));
  const r = await fixAll(sb);
  assert.ok(!r.validation.problems.some((p) => /beats\/min/.test(p)), r.validation.problems.join(" | "));
  assert.ok(r.validation.report.beatsPerMin <= 37);
  assert.ok(r.fixes.some((f) => /^cadence: dropped (dim|undim)/.test(f)));
  assert.strictEqual(r.storyboard.events.filter((e) => !["dim", "undim"].includes(e.op)).length, PILOT.events.length, "only secondary events went");
});

test("auto-fix: cadence -- too few beats: emphasis beats in the widest gaps", async () => {
  const sb = baseSb();
  sb.events = sb.events.filter((e, i) => i % 3 === 0);
  sb.scaffolds.forEach((sc) => Object.values(sc.slots).forEach((v) => [].concat(v || []).forEach((f) => f && delete f.anchor)));
  const v0 = await validate(sb);
  assert.ok(v0.problems.some((p) => /visual beats\/min/.test(p)), v0.problems.join(" | "));
  const r = await fixAll(sb);
  assert.deepStrictEqual(r.validation.problems, [], "holds and the beats/min band fixed without a model call");
  assert.ok(r.storyboard.events.length > sb.events.length, "beats were added");
});

test("auto-fix: variety -- a scaffold one sentence off its planned start moves onto it; chart / map types swap to the plan", async () => {
  const plan = PILOT.scaffolds.map((sc, i) => ({ n: i + 1, from: sc.from, kind: SL.sceneKind(sc), sentences: [sc.from], seconds: 6 }));
  const c = ctx({ plan });
  // the pilot shows two photo scenes in a row (fine without a plan); only that rule fires under its own plan
  const same = (p) => /both photo/.test(p);
  assert.deepStrictEqual((await validate(baseSb(), c)).problems.filter((p) => !same(p)), []);
  const sb = baseSb();
  sb.scaffolds.find((s) => s.id === "haunt").from = "s13";
  const v0 = await validate(sb, c);
  assert.ok(v0.problems.some((p) => /not a planned scene start/.test(p)), v0.problems.join(" | "));
  const r = await fixAll(sb, c);
  assert.strictEqual(r.storyboard.scaffolds.find((s) => s.id === "haunt").from, "s14");
  assert.deepStrictEqual(r.validation.problems.filter((p) => !same(p)), []);
  // chart swap: a bar chart over years becomes the planned line chart
  const sb2 = baseSb();
  const chart = fill(sb2, "rule", "chart");
  chart.props.bars = [{ label: "2005", value: 2 }, { label: "2006", value: 4 }, { label: "2007", value: 5 }];
  const out = FX.fixVariety(sb2, { plan: plan.map((p) => (p.from === "s7" ? { ...p, kind: "lineChart" } : p)) }, []);
  assert.strictEqual(chart.type, "lineChart");
  assert.deepStrictEqual(chart.props.points, [{ x: 2005, y: 2 }, { x: 2006, y: 4 }, { x: 2007, y: 5 }]);
  assert.match(out.join(" "), /barChart -> lineChart/);
  // bars that are not years stay a bar chart (the content does not fit)
  const sb3 = baseSb();
  FX.fixVariety(sb3, { plan: plan.map((p) => (p.from === "s7" ? { ...p, kind: "lineChart" } : p)) }, []);
  assert.strictEqual(fill(sb3, "rule", "chart").type, "barChart");
  // map swap: a world map with highlighted countries becomes the planned country map (focus from its highlights)
  const sb4 = { sentences: sb.sentences, events: [{ sentence: "s2", anchor: { text: "shiny" }, op: "highlight", target: "m1", value: { iso: "IND" } }], scaffolds: [{ id: "mp", template: "lfMap", from: "s2", slots: { map: { id: "m1", type: "worldMap", props: {} } } }] };
  FX.fixVariety(sb4, { plan: [{ n: 1, from: "s2", kind: "countryMap" }] }, []);
  assert.strictEqual(sb4.scaffolds[0].slots.map.type, "countryMap");
  assert.deepStrictEqual(sb4.scaffolds[0].slots.map.props.focus, ["IND"]);
});

test("auto-fix: maps -- duplicate pins, pin / arrow caps, one zoomTo per scene, long labels", () => {
  const ev = (op, value, w = "shiny") => ({ sentence: "s2", anchor: { text: w }, op, target: "m1", value });
  const sb = {
    sentences: section.sentences,
    scaffolds: [{ id: "mp", template: "lfMap", from: "s2", slots: { map: { id: "m1", type: "countryMap", props: { focus: ["IND"], pins: [{ city: "Mumbai", label: "Mumbai" }] } } } }],
    events: [
      ev("pin", { city: "mumbai", label: "HQ" }),
      ev("pin", { city: "Delhi", label: "Delhi" }),
      ev("pin", { city: "Chennai", label: "Chennai" }),
      ev("pin", { city: "Kolkata", label: "Kolkata" }),
      ev("pin", { city: "Hyderabad", label: "Hyderabad International Airport" }),
      ev("arrow", { from: { city: "Delhi" }, to: { city: "Mumbai" } }),
      ev("arrow", { from: { city: "Delhi" }, to: { city: "Chennai" } }),
      ev("arrow", { from: { city: "Delhi" }, to: { city: "Kolkata" } }),
      ev("arrow", { from: { city: "Delhi" }, to: { city: "Hyderabad" } }),
      ev("zoomTo", { isos: ["IND"] }),
      ev("zoomTo", { isos: ["PAK"] }),
    ],
  };
  const out = FX.fixMapsAndZooms(sb, {}, []);
  assert.ok(out.some((x) => /second pin/.test(x)));
  const pins = sb.events.filter((e) => e.op === "pin");
  assert.ok(pins.length + 1 <= 4, `${pins.length} pin events + 1 prop pin`);
  assert.ok(!pins.some((e) => e.value.city === "mumbai"));
  assert.strictEqual(sb.events.filter((e) => e.op === "arrow").length, 3);
  assert.strictEqual(sb.events.filter((e) => e.op === "zoomTo").length, 1);
  const txt = FX.fixText({ ...sb, events: [ev("pin", { city: "Pune", label: "Pune International Airport" })], scaffolds: sb.scaffolds }, {}, []);
  assert.ok(txt.some((x) => /label/.test(x)));
});

// ------------------------------------------------------------------------------------------ scene repair
test("scene repair: problems map to their scaffolds; structural problems force a whole-chapter repair", () => {
  const sb = baseSb();
  const at = (p) => SR.problemScaffolds(sb, p);
  assert.deepStrictEqual(at("scaffold toy: at most 2 satellites per rail (left 3, right 0)"), ["toy"]);
  assert.deepStrictEqual(at("scaffolds toy and deccan are both photo: never the same layout twice in a row; change deccan"), ["deccan"]);
  assert.deepStrictEqual(at('toy.left[0]:callout: callout text "a b c d e f g" is 7 words (max 6)'), ["toy"]);
  assert.deepStrictEqual(at("deal.number: on-screen number 777 matches no dossier fact, year or narration calc; show only fact figures"), ["deal"]);
  assert.deepStrictEqual(at("photo deccan/atr has no annotation: add an overlay"), ["deccan"]);
  assert.deepStrictEqual(at('bigNumber cheque (count "op") shows 0 for 3.0 s'), ["deal"]);
  assert.deepStrictEqual(at('slot "kfHyd" is used in a scaffold but not declared in "media"').sort(), ["haunt", "plan"]);
  assert.deepStrictEqual(at("no graphic over the photo for more than 1.5 s at toy @3.5s, deccan @9.5s: add a callout"), ["toy", "deccan"]);
  assert.deepStrictEqual(at('layout at 4.20 s: text "Red, everywhere" in toyred:callout spills 40 px outside its card -- shorten it'), ["toy"]);
  assert.deepStrictEqual(at('no visual change for 6.1 s (max 5 s) around sentence s11 near the word "gym" in scaffold joke: add a word-anchored event'), ["joke"]);
  assert.strictEqual(at("narration differs from the script (sentences are fixed)"), null);
  assert.strictEqual(at("only 14 visual beats/min (keep >= 20): add word-anchored events"), null);
  assert.strictEqual(at("real media visible only 12% of the section (target 40-70 %): add photo cards"), null);
  assert.strictEqual(at("something nobody anticipated"), null);

  const local = SR.planRepair(sb, ['toy.left[0]:callout: callout text "x" is 7 words (max 6)', "photo deccan/atr has no annotation: add"]);
  assert.strictEqual(local.mode, "scene");
  assert.deepStrictEqual(local.ids, ["toy", "deccan"]);
  assert.deepStrictEqual(local.sentences, ["s2", "s3", "s4"]);
  assert.strictEqual(SR.planRepair(sb, ["scaffold toy: x", "a chapter starts with an lfChapter card (got lfStage)"]).mode, "chapter");
  const many = sb.scaffolds.map((s) => `scaffold ${s.id}: x`);
  assert.strictEqual(SR.planRepair(sb, many).mode, "chapter", "most scenes failing = a chapter problem");
});

test("scene repair: splice replaces only the named scaffolds and their sentences' events; media upserted and pruned", () => {
  const sb = baseSb();
  const raw = {
    scaffolds: [{ id: "deccan", template: "lfStage", from: "WRONG", slots: { hero: { id: "atr", props: { slot: "deccanNew", tag: "Air Deccan ATR" } }, left: [{ id: "rupee2", type: "bigNumber", props: { value: 1, prefix: "₹", context: "the cheapest seats" } }], right: [{ id: "lc2", type: "callout", props: { text: "Low cost" } }] } }, { id: "cmp", template: "lfJoke", from: "s12", slots: {} }],
    events: [{ sentence: "s4", anchor: { text: "rupee." }, op: "highlight", target: "atr", value: { box: [20, 20, 40, 40], label: "₹1" } }, { sentence: "s9", anchor: { text: "x" }, op: "dim", target: "years" }],
    media: [{ slot: "deccanNew", kind: "photo", entity: "Air Deccan", intent: "Air Deccan ATR on the apron", size: "card" }],
  };
  const out = SR.applySceneRepair(sb, raw, ["deccan"], ["s4"]);
  const before = baseSb();
  out.scaffolds.forEach((s, i) => s.id !== "deccan" && assert.deepStrictEqual(s, before.scaffolds[i], `${s.id} untouched`));
  const d = out.scaffolds.find((s) => s.id === "deccan");
  assert.strictEqual(d.from, "s4", "id / from kept");
  assert.strictEqual(d.slots.left[0].id, "rupee2");
  assert.deepStrictEqual(out.events.filter((e) => e.sentence === "s4").map((e) => e.op), ["highlight"]);
  assert.ok(!out.events.some((e) => e.sentence === "s9" && e.op === "dim"), "events outside the sentences are ignored");
  assert.strictEqual(out.events.filter((e) => e.sentence !== "s4").length, before.events.filter((e) => e.sentence !== "s4").length);
  assert.ok(out.mediaIntents.some((it) => it.slot === "deccanNew"));
  assert.ok(out.mediaIntents.some((it) => it.slot === "deccanATR"), "still used by the timeline / compare");
  assert.throws(() => SR.applySceneRepair(sb, { scaffolds: [] }, ["deccan"], ["s4"]), /did not return scaffold/);
  assert.deepStrictEqual(sb, before, "input not mutated");
});

test("scene repair prompt: static catalog first, only the failing scenes' JSON, neighbours by id", () => {
  const sb = baseSb();
  const p = SR.buildSceneRepairPrompt(ctx(), sb, ["deccan"], ["s4"], ["photo deccan/atr has no annotation: add an overlay"]);
  assert.ok(p.startsWith(SL.staticPromptLF()), "cacheable static prefix");
  const tail = p.slice(SL.staticPromptLF().length);
  assert.match(tail, /NEIGHBOURING SCENES[\s\S]*- toy \(lfStage[\s\S]*>> FIX deccan[\s\S]*- deal \(lfNumber/);
  assert.doesNotMatch(tail, /- cmp \(/, "only neighbours are listed");
  const json = JSON.parse(tail.split("SCENES TO FIX (current JSON):\n")[1].split("\n")[0]);
  assert.deepStrictEqual(json.scaffolds.map((s) => s.id), ["deccan"]);
  assert.ok(json.events.every((e) => e.sentence === "s4"));
  assert.deepStrictEqual(json.media.map((m) => m.slot), ["deccanATR"]);
  assert.match(tail, /FACTS/, "a scene with a bigNumber gets the facts");
  const full = SL.buildRepairPromptLF(ctx(), SR.rawOf(sb), ["x"], "").slice(SL.staticPromptLF().length);
  assert.ok(tail.length < full.length * 0.7, `scene tail ${tail.length} vs chapter tail ${full.length}`);
});

// ------------------------------------------------------------------------------------------ the loop
test("loop: fixable problems cost no extra model call; a local unfixable one gets ONE scene repair", async () => {
  const first = rawPilot();
  first.scaffolds.find((s) => s.id === "toy").slots.left[0].props.text = "Leather seats and free headphones for every single passenger";
  first.scaffolds.find((s) => s.id === "deal").slots.number.props.value = 777; // not a dossier figure: code cannot know the right one
  const calls = [];
  const generate = async (prompt, info) => {
    calls.push({ prompt, info });
    if (info.kind === "first") return first;
    assert.strictEqual(info.kind, "scene");
    const cur = JSON.parse(prompt.split("SCENES TO FIX (current JSON):\n")[1].split("\n")[0]);
    assert.deepStrictEqual(cur.scaffolds.map((s) => s.id), ["deal"]);
    cur.scaffolds[0].slots.number.props.value = 550;
    return cur;
  };
  const r = await SL.generateChapterStoryboard(ctx(), { generate, layoutAudit: false });
  assert.deepStrictEqual(calls.map((c) => c.info.kind), ["first", "scene"]);
  assert.strictEqual(r.storyboard.lfMeta.calls, "first,scene");
  assert.ok(r.storyboard.lfMeta.autoFixes >= 1);
  assert.ok(r.storyboard.scaffolds.find((s) => s.id === "toy").slots.left[0].props.text.split(/\s+/).length <= 6);
  assert.strictEqual(r.storyboard.scaffolds.find((s) => s.id === "deal").slots.number.props.value, 550);
});

test("loop: a structural problem goes to a whole-chapter repair; an unusable scene answer falls back to it too", async () => {
  const first = rawPilot();
  first.scaffolds = first.scaffolds.slice(1); // no chapter card
  const kinds = [];
  const r = await SL.generateChapterStoryboard(ctx(), {
    layoutAudit: false,
    generate: async (prompt, info) => {
      kinds.push(info.kind);
      if (info.kind === "first") return first;
      assert.match(prompt, /YOUR PREVIOUS OUTPUT/);
      return rawPilot();
    },
  });
  assert.deepStrictEqual(kinds, ["first", "repair"]);
  assert.ok(r.storyboard);

  const bad = rawPilot();
  bad.scaffolds.find((s) => s.id === "deal").slots.number.props.value = 777;
  const kinds2 = [];
  await SL.generateChapterStoryboard(ctx(), {
    layoutAudit: false,
    generate: async (prompt, info) => {
      kinds2.push(info.kind);
      if (info.kind === "first") return bad;
      if (info.kind === "scene") return { scaffolds: [] };
      return rawPilot();
    },
  });
  assert.deepStrictEqual(kinds2, ["first", "scene", "repair"]);
});

test("loop: budget stop is fatal (never retried); a tight budget caps the repairs and lowers the repair tier", async () => {
  const stop = Object.assign(new Error("budget exhausted: longform.storyboard not sent"), { budget: true, fatal: true });
  await assert.rejects(SL.generateChapterStoryboard(ctx(), { layoutAudit: false, generate: async () => { throw stop; } }), (e) => e.fatal && e.budget);

  const bad = rawPilot();
  bad.scaffolds.find((s) => s.id === "deal").slots.number.props.value = 777;
  let n = 0;
  M.setCostMode("tight");
  try {
    assert.strictEqual(M.modelFor("longform.storyboard.scene"), M.DEFAULTS.lite);
    assert.strictEqual(M.modelFor("longform.storyboard"), M.DEFAULTS.standard, "first passes keep their tier");
    await assert.rejects(SL.generateChapterStoryboard(ctx(), { layoutAudit: false, generate: async () => (n++, bad) }), /still invalid after 3 attempts/);
    assert.strictEqual(n, 3, "first pass + at most 2 repairs once tight");
  } finally {
    M.setCostMode("normal");
  }
});
