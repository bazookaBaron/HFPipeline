"use strict";

// Offline tests for the long-form storyboard stage, cross-chapter media merge, the local media
// library and packaging. Real inputs: the recorded Kingfisher dossier/outline/script
// (output/lf/kingfisher) and the recorded chapter responses (fixtures/lf/kingfisher). The model is
// a fake `generate`; the layout audit (headless Chrome) is skipped here and exercised by
// make-longform.js / generate-video-v3.js.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SL = require("./storyboardLF");
const PK = require("./package");
const { joinPads } = require("./stitch");
const { matchLibrary, indexLibrary } = require("../media/library");

const KF = path.join(__dirname, "..", "..", "output", "lf", "kingfisher");
const FIX = path.join(__dirname, "..", "..", "fixtures", "lf", "kingfisher");
const have = fs.existsSync(path.join(KF, "script.json"));
const load = (f) => JSON.parse(fs.readFileSync(f, "utf-8"));
const kf = have ? { script: load(path.join(KF, "script.json")), outline: load(path.join(KF, "outline.json")), dossier: load(path.join(KF, "dossier.json")) } : null;
const ctxFor = (id) => ({ section: kf.script.sections.find((s) => s.id === id), meta: SL.chapterMeta(kf.script, kf.outline, id), dossier: kf.dossier, outline: kf.outline, topic: kf.script.topic });
const recorded = (id) => load(path.join(FIX, `${id}.response.json`));

test("chapter meta: cold open 0 (no chrome), chapters 1..n, recap n+1", { skip: !have }, () => {
  assert.deepStrictEqual(SL.chapterMeta(kf.script, kf.outline, "cold"), { kind: "cold", index: 0, count: 8, title: "Cold open" });
  assert.deepStrictEqual(SL.chapterMeta(kf.script, kf.outline, "ch2"), { kind: "chapter", index: 2, count: 8, title: "The Air Deccan Gamble" });
  assert.strictEqual(SL.chapterMeta(kf.script, kf.outline, "recap").index, 8);
});

test("LF prompt: fixed narration, LF-only catalog, mix rule, facts; no 9:16 cards", { skip: !have }, () => {
  const p = SL.buildPromptLF(ctxFor("ch2"));
  kf.script.sections.find((s) => s.id === "ch2").sentences.forEach((s) => assert.ok(p.includes(`${s.id}: ${s.text}`), s.id));
  assert.match(p, /NARRATION \(FIXED/);
  assert.match(p, /MIX RULE/);
  assert.match(p, /- photo: /);
  assert.match(p, /F10: /);
  assert.doesNotMatch(p, /\n- nodes: /); // shared 9:16 modules stay out of the LF catalog
  assert.doesNotMatch(p, /- endScreen: /);
  assert.match(p, /lfChapter card for "The Air Deccan Gamble"/);
});

test("recorded chapters validate (narration fixed, mix rule, media slots, dossier numbers)", { skip: !have }, async () => {
  for (const id of ["cold", "ch2"]) {
    const ctx = ctxFor(id);
    const sb = SL.assemble(recorded(id), ctx);
    assert.deepStrictEqual(sb.frame, { w: 1920, h: 1080 });
    assert.strictEqual(sb.profile, "LF");
    const v = await SL.validateChapter(sb, ctx, { layoutAudit: false });
    assert.deepStrictEqual(v.problems, [], `${id}: ${v.problems.join(" | ")}`);
    assert.ok(v.report.mediaSharePct >= 40 && v.report.mediaSharePct <= 70, `${id} media ${v.report.mediaSharePct}`);
    assert.deepStrictEqual(v.report.bareSeconds, []);
    assert.ok(v.report.graphicOnlyScenes >= 1);
  }
});

test("validation catches: rewritten narration source, slideshow, invented chart numbers, undeclared slots, missing chapter card", { skip: !have }, async () => {
  const ctx = ctxFor("ch2");
  // model output cannot change narration: assemble always takes the script sentences
  const raw = recorded("ch2");
  raw.sentences = [{ id: "ch2-s01", text: "Something else entirely." }];
  assert.strictEqual(SL.assemble(raw, ctx).sentences[0].text, ctx.section.sentences[0].text);

  const bad = recorded("ch2");
  bad.scaffolds[0].template = "lfSplit"; // no chapter card first
  bad.scaffolds[0].slots = { photo: bad.scaffolds[0].slots.photo, stack: [{ id: "x", type: "lfText", props: { title: "Why?" } }], overlays: bad.scaffolds[0].slots.overlays };
  const total = bad.scaffolds.find((s) => s.id === "total");
  total.slots.chart.props.bars[2].value = 1234; // not a dossier figure
  delete total.slots.chart.props.source;
  bad.scaffolds.find((s) => s.id === "stake").slots.photo.props.slot = "mysteryPhoto";
  const v = await SL.validateChapter(SL.assemble(bad, ctx), ctx, { layoutAudit: false });
  const all = v.problems.join("\n");
  assert.match(all, /starts with an lfChapter card/);
  assert.match(all, /on-screen number 1234 matches no dossier fact/);
  assert.match(all, /needs props.source/);
  assert.match(all, /slot "mysteryPhoto" is used in a scaffold but not declared/);
  assert.match(all, /media slot "ubCity" is declared but never used/);

  // slideshow: every scene a photo scene, no graphics over the photos
  const cold = recorded("cold");
  const ctxC = ctxFor("cold");
  const show = {
    scaffolds: ctxC.section.sentences.map((s, i) => ({ id: `p${i}`, template: "lfSplit", from: s.id, slots: { photo: { id: `ph${i}`, props: { slot: "kfA320" } } } })),
    events: [],
    media: [cold.media[0]],
  };
  const vs = await SL.validateChapter(SL.assemble(show, ctxC), ctxC, { layoutAudit: false });
  assert.match(vs.problems.join("\n"), /starts with an lfCold|no graphic over the photo|media scenes in a row|has no annotation/);
});

test("generate: repair loop feeds problems back; 402 is fatal and not retried", { skip: !have }, async () => {
  const ctx = ctxFor("cold");
  const prompts = [];
  const good = recorded("cold");
  const broken = JSON.parse(JSON.stringify(good));
  broken.media = broken.media.filter((m) => m.slot !== "jetFuel"); // undeclared slot
  let n = 0;
  const r = await SL.generateChapterStoryboard(ctx, {
    layoutAudit: false,
    generate: async (p) => {
      prompts.push(p);
      return n++ === 0 ? broken : good;
    },
  });
  assert.strictEqual(r.attempts.length, 2);
  assert.match(prompts[1], /IT FAILED VALIDATION:[\s\S]*slot "jetFuel" is used in a scaffold but not declared/);
  assert.strictEqual(r.storyboard.lfMeta.hash, SL.sectionHash(ctx.section, ctx.meta));

  let calls = 0;
  await assert.rejects(
    SL.generateChapterStoryboard(ctx, {
      layoutAudit: false,
      generate: async () => {
        calls++;
        throw Object.assign(new Error('HTTP 402: {"error":{"message":"Your prepaid credits are depleted."}}'), { fatal: true });
      },
    }),
    (err) => err.fatal === true && /not retried/.test(err.message)
  );
  assert.strictEqual(calls, 1);
});

test("mergeIntents: identical intents share one slot across chapters; clashing names are renamed", () => {
  const a = { scaffolds: [{ id: "x", slots: { photo: { props: { slot: "plane" } } } }], mediaIntents: [{ slot: "plane", kind: "photo", intent: "Kingfisher A320 on the tarmac", size: "card" }] };
  const b = {
    scaffolds: [{ id: "y", slots: { photo: { props: { slot: "jet" } }, backdrop: { props: { slot: "plane" } } } }],
    mediaIntents: [
      { slot: "jet", kind: "photo", intent: "Kingfisher A320 on the tarmac", size: "full" },
      { slot: "plane", kind: "photo", intent: "A different plane: an ATR in flight" },
    ],
  };
  const { intents, renames } = SL.mergeIntents([{ id: "cold", sb: a }, { id: "ch2", sb: b }]);
  assert.strictEqual(intents.length, 2);
  assert.strictEqual(intents[0].size, "full"); // the stricter size wins
  assert.deepStrictEqual(renames.ch2, { jet: "plane", plane: "ch2-plane" });
  assert.strictEqual(b.scaffolds[0].slots.photo.props.slot, "plane");
  assert.strictEqual(b.scaffolds[0].slots.backdrop.props.slot, "ch2-plane");
  assert.deepStrictEqual(b.mediaIntents.map((i) => i.slot).sort(), ["ch2-plane", "plane"]);
});

test("media library: exact intent reuse from cache sidecars, kind + size aware", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lflib-"));
  const put = (sha, rec, ext = "jpg") => {
    fs.mkdirSync(path.join(dir, sha.slice(0, 2)), { recursive: true });
    fs.writeFileSync(path.join(dir, sha.slice(0, 2), `${sha}.${ext}`), "x");
    fs.writeFileSync(path.join(dir, sha.slice(0, 2), `${sha}.json`), JSON.stringify({ sha256: sha, kind: "image", credit: "Photo: A / Wikimedia Commons · CC BY-SA 4.0", licence: "CC BY-SA 4.0", focal: [0, 0, 1, 1], fetchedAt: "2026-09-26T00:00:00Z", ...rec }));
  };
  put("aa11", { source: "commons", intent: "Kingfisher Airlines Airbus A320 aircraft on the tarmac", width: 1920, height: 1200 });
  put("bb22", { source: "commons", intent: "State Bank of India headquarters building", width: 900, height: 700 });
  put("cc33", { source: "illustration", intent: "a banker holding an IOU note", width: 1376, height: 768, credit: "Illustration: AI-generated", licence: "AI-generated" });
  const idx = indexLibrary(dir);
  const { hits, rest } = matchLibrary(
    [
      { slot: "p", kind: "photo", intent: "Kingfisher Airlines Airbus A320 aircraft on the tarmac!" },
      { slot: "s", kind: "photo", intent: "State Bank of India headquarters building", size: "full" }, // 900 px < 1280 full
      { slot: "s2", kind: "photo", intent: "State Bank of India headquarters building", size: "card" },
      { slot: "j", kind: "illustration", intent: "a banker holding an IOU note" },
      { slot: "j2", kind: "photo", intent: "a banker holding an IOU note" }, // a photo slot never takes AI art
    ],
    { index: idx }
  );
  assert.deepStrictEqual(Object.keys(hits).sort(), ["j", "p", "s2"]);
  assert.strictEqual(hits.j.status, "illustration");
  assert.strictEqual(hits.p.status, "ok");
  assert.ok(hits.p.credit && hits.p.focal);
  assert.deepStrictEqual(rest.map((r) => r.slot).sort(), ["j2", "s"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("package: SRT cues offset by chapter start, YouTube timestamps, chapter rules, description", { skip: !have }, () => {
  const words = (sid, t0, list) => list.map((w, i) => ({ sentenceId: sid, text: w, start: t0 + i * 0.4, end: t0 + i * 0.4 + 0.3 }));
  const chapters = [
    { start: 0, words: words("a", 0.1, ["Hello", "there,", "friend."]).concat(words("a2", 1.4, ["Second", "sentence", "here."])) },
    { start: 65.5, words: words("b", 0.12, ["Chapter", "two", "starts."]) },
  ];
  const cues = PK.buildCues(chapters);
  assert.strictEqual(cues.length, 3);
  assert.strictEqual(cues[2].text, "Chapter two starts.");
  assert.ok(Math.abs(cues[2].start - 65.62) < 1e-6);
  assert.deepStrictEqual(PK.cueProblems(cues, 70), []);
  // a long sentence splits into balanced parts, never an orphaned last word
  const long = "The deal did push Kingfisher's domestic market share to a peak of twenty-seven percent.".split(" ");
  const lc = PK.buildCues([{ start: 0, words: words("x", 0, long) }]);
  assert.strictEqual(lc.length, 2);
  assert.ok(lc.every((c) => c.text.split(" ").length >= 4 && c.text.length <= 84), JSON.stringify(lc));
  assert.match(PK.srt(cues), /^1\n00:00:00,100 --> 00:00:0\d,\d{3}\nHello there, friend\.\n/);
  assert.strictEqual(PK.ytTime(0), "0:00");
  assert.strictEqual(PK.ytTime(65.9), "1:05");
  assert.strictEqual(PK.ytTime(3725), "1:02:05");
  const list = [
    { title: "Intro", start: 0 },
    { title: "The Luxury Trap", start: 36.2 },
    { title: "Recap", start: 590 },
  ];
  assert.deepStrictEqual(PK.chapterRules(list, 640), []);
  assert.match(PK.chapterRules(list.slice(0, 2), 80).join(" "), /at least 3/);
  assert.match(PK.chapterRules([{ title: "a", start: 0 }, { title: "b", start: 5 }, { title: "c", start: 30 }], 60).join(" "), /"a" is 5.0 s/);
  const md = PK.descriptionMd({ outline: kf.outline, dossier: kf.dossier, chapters: list, credits: "Image credits\n\n[kfA320] \"A plane\" · by X · CC BY-SA 4.0\n", topic: kf.script.topic });
  assert.match(md, /## Chapters\n\n0:00 Intro\n0:36 The Luxury Trap\n9:50 Recap/);
  // sources: reputable first (press before reference), never user-generated sites
  assert.match(md, /## Sources\n\n- livemint\.com: https:\/\/www\.livemint\.com\//);
  assert.doesNotMatch(md, /quora\.com|slideshare\.net|scribd\.com|medium\.com/);
  assert.match(md, /## Image credits\n\n- "A plane" · by X · CC BY-SA 4\.0/);
  assert.match(md, /Not financial advice/);
  const titles = PK.titleOptions(kf.outline, kf.script.topic);
  assert.strictEqual(titles.length, 3);
  assert.ok(titles.every((t) => t.length <= 100));
});

test("stitch: join pads give a ~0.9 s voice gap across chapters", () => {
  const tl = (lead, lastEnd, total) => ({ words: [{ start: lead, end: lead + 0.3 }, { start: lastEnd - 0.3, end: lastEnd }], totalSeconds: total });
  const pads = joinPads([tl(0.12, 30.0, 30.6), tl(0.1, 50, 50.6), tl(0.1, 20, 20.6)], 0.9);
  assert.strictEqual(pads.length, 3);
  assert.ok(Math.abs(0.6 + pads[0] + 0.1 - 0.9) < 1 / 30 + 1e-9, `pad ${pads[0]}`);
  assert.strictEqual(pads[2], 0); // nothing after the last chapter
  assert.strictEqual(joinPads([tl(0.5, 10, 11.5), tl(0.2, 5, 5.6)], 0.9)[0], 0); // never negative
});
