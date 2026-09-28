"use strict";

// Media gate (long-form v2 plan §3, "no empty frames"): a slot without usable media makes ONLY the
// scenes that reference it graphics-only; compile marks any remaining placeholder and a name card
// never is one. Real inputs: the recorded Kingfisher chapter (fixtures/lf/kingfisher); the model is a
// fake `generate`; the layout audit (headless Chrome) is skipped.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const SL = require("./storyboardLF");
const { compileStoryboard } = require("../video/v3/compile");
const { syntheticTimeline, PROFILES } = require("../video/v3/storyboardGen");

const KF = path.join(__dirname, "..", "..", "output", "lf", "kingfisher");
const FIX = path.join(__dirname, "..", "..", "fixtures", "lf", "kingfisher");
const have = fs.existsSync(path.join(KF, "script.json")) && fs.existsSync(path.join(FIX, "ch2.response.json"));
const load = (f) => JSON.parse(fs.readFileSync(f, "utf-8"));
const kf = have ? { script: load(path.join(KF, "script.json")), outline: load(path.join(KF, "outline.json")), dossier: load(path.join(KF, "dossier.json")) } : null;
const ctxFor = (id) => ({ section: kf.script.sections.find((s) => s.id === id), meta: SL.chapterMeta(kf.script, kf.outline, id), dossier: kf.dossier, outline: kf.outline, topic: kf.script.topic });
const chapter = () => SL.assemble(load(path.join(FIX, "ch2.response.json")), ctxFor("ch2"));

/** fixture manifest: every declared slot resolved, except `bad` (fallback) and `card` (name card) */
function manifestFor(sb, { bad = [], card = [] } = {}) {
  const slots = {};
  for (const it of sb.mediaIntents) {
    if (bad.includes(it.slot)) slots[it.slot] = { status: "fallback", kind: "photo", reason: "commons: 12 found, 2 eligible, 2 vetted, 0 passed" };
    else if (card.includes(it.slot)) slots[it.slot] = { status: "namecard", kind: "namecard", namecard: { name: "UB City", initials: "UC", role: "Office tower", year: "2007", context: "", person: false } };
    else slots[it.slot] = { status: "ok", kind: "image", file: `assets/media/cache/00/fixture-${it.slot}.jpg`, credit: "Photo: fixture / Wikimedia Commons · CC BY-SA 4.0", focal: [0.1, 0.1, 0.8, 0.8], width: 1920, height: 1280 };
  }
  return { version: "media-manifest.v1", slots };
}

const placeholders = (spec) => spec.scaffolds.flatMap((s) => s.modules.filter((m) => JSON.stringify(m.props || {}).includes('"placeholder":true')).map((m) => `${s.id}/${m.id}`));
const compileWith = (sb, manifest) => compileStoryboard(sb, syntheticTimeline(sb, PROFILES.LF.syn), { mascot: false, media: manifest });

test("compile: a fallback slot is marked placeholder; a name card is designed content, not a placeholder", { skip: !have }, () => {
  const sb = chapter();
  const fb = compileWith(sb, manifestFor(sb, { bad: ["ubCity"] }));
  assert.deepStrictEqual(placeholders(fb), ["stake/ubpic"]);
  const nc = compileWith(sb, manifestFor(sb, { card: ["ubCity"] }));
  assert.deepStrictEqual(placeholders(nc), []);
  const hero = nc.scaffolds.find((s) => s.id === "stake").modules.find((m) => m.id === "ubpic");
  assert.strictEqual(hero.props.mediaStatus, "namecard");
  assert.strictEqual(hero.props.namecard.initials, "UC");
  assert.ok(!hero.props.src && !hero.props.credit, "a name card has no file and no credit");
  assert.ok(!("tag" in hero.props), "the card already names its subject: no tag chip over it");
  // a related-place stand-in is re-tagged with what the photo shows
  const rel = manifestFor(sb);
  rel.slots.ubCity = { ...rel.slots.ubCity, ladder: "related", related: "Bengaluru skyline" };
  const hr = compileWith(sb, rel).scaffolds.find((s) => s.id === "stake").modules.find((m) => m.id === "ubpic");
  assert.strictEqual(hr.props.tag, "Bengaluru skyline");
});

test("media gate: only the scene with the unusable slot changes (rules variant), and no placeholder survives compile", { skip: !have }, async () => {
  const sb = chapter();
  const before = JSON.parse(JSON.stringify(sb));
  const manifest = manifestFor(sb, { bad: ["ubCity"] });
  const storyboards = { ch2: sb };
  const written = [];
  const g = await SL.mediaGate({ sections: ["ch2"], storyboards, manifest, ctxFor, layoutAudit: false, onChange: (id) => written.push(id) });
  assert.deepStrictEqual(g.failed, []);
  assert.deepStrictEqual(g.changed, [{ id: "ch2", slots: ["ubCity"], scaffolds: ["stake"], how: "rules" }]);
  assert.deepStrictEqual(written, ["ch2"]);
  const out = storyboards.ch2;
  out.scaffolds.forEach((s, i) => s.id !== "stake" && assert.deepStrictEqual(s, before.scaffolds[i], `${s.id} unchanged`));
  const stake = out.scaffolds.find((s) => s.id === "stake");
  assert.strictEqual(stake.slots.hero.type, "lfText");
  assert.ok(!JSON.stringify(stake).includes('"slot"'));
  assert.ok(!out.mediaIntents.some((it) => it.slot === "ubCity"), "the dropped slot is no longer requested");
  assert.deepStrictEqual(out.lfMeta.mediaGate, { slots: ["ubCity"], scaffolds: ["stake"], how: "rules" });
  const v = await SL.validateChapter(out, ctxFor("ch2"), { layoutAudit: false });
  assert.deepStrictEqual(v.problems, []);
  assert.deepStrictEqual(placeholders(compileWith(out, manifest)), []);
});

test("media gate: cheap-tier model rewrite first (retried once with the problems), name cards pass untouched", { skip: !have }, async () => {
  const sb = chapter();
  const manifest = manifestFor(sb, { bad: ["ubCity"] });
  const prompts = [];
  const generate = async (prompt, info) => {
    prompts.push({ prompt, info });
    const stake = JSON.parse(JSON.stringify(sb.scaffolds.find((s) => s.id === "stake")));
    if (info.attempt === 1) return { scaffolds: [stake], events: [] }; // still uses the slot -> rejected
    stake.slots.hero = { id: "ubtext", type: "lfText", props: { eyebrow: "Bengaluru", title: "Mallya's first bite of Air Deccan", plate: true } };
    return { scaffolds: [stake], events: sb.events.filter((e) => e.sentence === "ch2-s06" && e.target !== "ubpic") };
  };
  const storyboards = { ch2: sb };
  const g = await SL.mediaGate({ sections: ["ch2"], storyboards, manifest, ctxFor, generate, layoutAudit: false });
  assert.deepStrictEqual(g.changed.map((c) => c.how), ["model"]);
  assert.strictEqual(prompts.length, 2);
  assert.match(prompts[0].prompt, /MEDIA GATE: there is no usable picture for media slot\(s\) ubCity\. Rewrite ONLY scaffold\(s\) stake/);
  assert.match(prompts[1].prompt, /still use slot\(s\) ubCity/);
  assert.strictEqual(storyboards.ch2.scaffolds.find((s) => s.id === "stake").slots.hero.id, "ubtext");

  const sb2 = chapter();
  const g2 = await SL.mediaGate({ sections: ["ch2"], storyboards: { ch2: sb2 }, manifest: manifestFor(sb2, { card: ["ubCity"] }), ctxFor, generate, layoutAudit: false });
  assert.deepStrictEqual(g2, { changed: [], failed: [] });
});

test("media gate maps merged (renamed) slot names back to the chapter's own", { skip: !have }, async () => {
  const a = chapter();
  const b = chapter();
  // same slot name, different picture in the second chapter -> merge renames it "b-ubCity"
  b.mediaIntents.find((it) => it.slot === "ubCity").intent = "UB City tower at night";
  const merged = SL.mergeIntents([{ id: "a", sb: JSON.parse(JSON.stringify(a)) }, { id: "b", sb: JSON.parse(JSON.stringify(b)) }]).intents;
  assert.ok(merged.some((it) => it.slot === "b-ubCity"));
  const slots = {};
  merged.forEach((it) => (slots[it.slot] = it.slot === "b-ubCity" ? { status: "fallback" } : { status: "ok", file: "x.jpg", credit: "c" }));
  const storyboards = { a, b };
  const ctx = (id) => ctxFor("ch2");
  const g = await SL.mediaGate({ sections: ["a", "b"], storyboards, manifest: { slots }, ctxFor: ctx, layoutAudit: false });
  assert.deepStrictEqual(g.changed.map((c) => [c.id, c.slots]), [["b", ["ubCity"]]]);
  assert.ok(JSON.stringify(storyboards.a).includes('"slot":"ubCity"'), "chapter a keeps its picture");
});
