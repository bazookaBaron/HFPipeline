"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const TH = require("./thumbnail");
const { TASKS } = require("../ai/models");

const dossier = {
  angle: "How Vijay Mallya's Kingfisher Airlines crashed into a ₹9,000 crore debt disaster",
  entities: [{ name: "Vijay Mallya", kind: "person" }, { name: "Kingfisher Airlines", kind: "company" }, { name: "State Bank of India", kind: "org" }],
  facts: [
    { id: "F6", value: 4000, unit: "INR crore", claim: "accumulated losses of ₹4,000 crore", confidence: "high" },
    { id: "F8", value: 9000, unit: "INR crore", claim: "defaulted on debts exceeding ₹9,000 crore", confidence: "high" },
    { id: "F16", value: 147, unit: "USD per barrel", claim: "crude hit $147", confidence: "high" },
    { id: "F99", value: 50000, unit: "INR crore", claim: "rumoured exposure", confidence: "low" },
  ],
};
const outline = { title: "How Kingfisher Airlines Collapsed into ₹9,000 Cr Debt" };
const img = (o) => ({ status: "ok", kind: "image", source: "commons", file: "x.jpg", width: 1920, height: 1280, focal: [0, 0, 1, 1], licence: "CC BY 4.0", credit: "c", ...o });
const manifest = {
  slots: {
    plane: img({ depicts: "Kingfisher Airlines A320" }),
    mallya: img({ depicts: "portrait of Vijay Mallya", height: 1726 }),
    art: img({ status: "illustration", source: "illustration", licence: "AI-generated", depicts: "Vijay Mallya cartoon" }),
    logo: img({ depicts: "Kingfisher logo" }),
    gone: { status: "fallback", kind: "image" },
  },
};
const intents = [
  { slot: "plane", kind: "photo", entity: "Kingfisher Airlines" },
  { slot: "mallya", kind: "portrait", entity: "Vijay Mallya" },
  { slot: "art", kind: "illustration", entity: "Vijay Mallya" },
  { slot: "logo", kind: "logo", entity: "Kingfisher Airlines" },
];
const vision = (e) => ({ confidence: /A320/.test(e.depicts) ? 0.95 : 0.75 });

test("models: longform.thumbnail is a lite task", () => {
  assert.equal(TASKS["longform.thumbnail"], "lite");
});

test("hero: a real person photo of a main entity beats the brand photo; no illustration, logo or fallback", () => {
  const r = TH.rankHeroes({ manifest, intents, dossier, outline, topic: "Why Kingfisher went bankrupt", vision });
  assert.equal(r[0].slot, "mallya");
  assert.deepEqual(r.map((x) => x.slot).sort(), ["mallya", "plane"]);
  assert.equal(TH.pickScene(r, r[0]).slot, "plane");
});

test("hero: an illustration is used only when no real photo exists", () => {
  const only = { slots: { art: manifest.slots.art } };
  const r = TH.rankHeroes({ manifest: only, intents, dossier, outline, topic: "x", vision });
  assert.equal(r[0].slot, "art");
});

test("stat: the dossier value named in the title, formatted; low-confidence facts ignored", () => {
  const s = TH.pickStat({ dossier, outline });
  assert.equal(s.text, "₹9,000 CR");
  assert.equal(s.label, "DEBT");
  assert.equal(s.factId, "F8");
  const s2 = TH.pickStat({ dossier, outline: { title: "Kingfisher" } });
  assert.equal(s2.factId, "F8"); // largest confident money value (F99 is low confidence)
  assert.equal(TH.formatStat({ value: 147, unit: "USD per barrel" }), null);
  assert.equal(TH.formatStat({ value: 2.5, unit: "USD billion" }), "$2.5B");
  assert.equal(TH.formatStat({ value: 150000, unit: "INR crore" }), "₹1.5 LAKH CR");
});

test("title: deterministic fallback is 2-4 words; Gemini output is validated", async () => {
  const fb = TH.fallbackTitle({ outline, dossier, topic: "Why Kingfisher went bankrupt" });
  assert.equal(fb.text, "WHAT KILLED KINGFISHER?");
  assert.ok(TH.validTitle(fb.text));
  assert.equal(TH.validTitle("one"), null);
  assert.equal(TH.validTitle("this title is far too long for a thumbnail"), null);
  const g = await TH.makeTitle({ outline, dossier, topic: "t", ask: async () => ({ text: "Mallya's Big Bet", highlight: "bet" }) });
  assert.deepEqual([g.text, g.highlight, g.source], ["MALLYA'S BIG BET", "BET", "gemini"]);
  const bad = await TH.makeTitle({ outline, dossier, topic: "Why Kingfisher went bankrupt", ask: async () => ({ text: "x" }) });
  assert.equal(bad.source, "deterministic");
  const err = await TH.makeTitle({ outline, dossier, topic: "Why Kingfisher went bankrupt", ask: async () => { throw new Error("402"); } });
  assert.equal(err.source, "deterministic");
});

test("place: cover fit keeps the subject at the target and never leaves a gap", () => {
  const p = TH.place({ boxW: 560, boxH: 720, imgW: 1920, imgH: 1726, focal: [0, 0.05, 1, 0.95], target: [0.5, 0.44], zoom: 1.1, person: true });
  assert.ok(p.img.left <= 0 && p.img.top <= 0);
  assert.ok(p.img.left + p.img.width >= 560 - 0.5 && p.img.top + p.img.height >= 720 - 0.5);
  const cx = p.subject.x + p.subject.w / 2;
  assert.ok(Math.abs(cx - 280) < 1, `subject centred (${cx})`);
});

// ------------------------------------------------------------------ v2 (thumbnailV2.js, thumbFace.js)
const V2 = require("./thumbnailV2");
const TF = require("./thumbFace");

test("v2: main person = a person named in the title, else the dossier's first person", () => {
  assert.equal(V2.mainPerson({ dossier, outline, topic: "Why Kingfisher went bankrupt" }), "Vijay Mallya");
  const d2 = { entities: [{ name: "Argentina", kind: "place" }, { name: "IMF", kind: "org" }, { name: "Domingo Cavallo", kind: "person" }] };
  assert.equal(V2.mainPerson({ dossier: d2, outline: { title: "Why Argentina Keeps Going Broke" }, topic: "Argentina" }), "Domingo Cavallo");
  assert.equal(V2.mainPerson({ dossier: { entities: [{ name: "IMF", kind: "org" }] }, outline, topic: "x" }), null);
});

test("v2: concepts are validated (2-4 word headline, power word inside it, subtitle numbers only from the stat)", async () => {
  const stat = { text: "$539M", label: "DEBT" };
  const ask = async () => ({
    concepts: [
      { headline: "Endless Trap", power: "trap", subtitle: "The $539M mistake", scene: "an empty bank hall" },
      { headline: "this headline is much too long to use", power: "x", subtitle: "Lost 900 billion", scene: "" },
      { headline: "Broken Promise", power: "nope", subtitle: "Default after default", scene: "a dark vault" },
    ],
    prop: "a rusty anchor",
  });
  const { concepts, prop } = await V2.makeConcepts({ outline, dossier, topic: "Why Kingfisher went bankrupt", ask }, stat, null);
  assert.deepEqual([concepts[0].text, concepts[0].highlight, concepts[0].subtitle], ["ENDLESS TRAP", "TRAP", "THE $539M MISTAKE"]);
  assert.equal(concepts[1].source, "deterministic"); // headline too long -> fallback
  assert.equal(concepts[1].subtitle, "$539M DEBT"); // "900" is not the stat -> fallback subtitle
  assert.ok(concepts[1].scene.length > 10);
  assert.equal(concepts[2].highlight, "PROMISE"); // unknown power word -> last word
  assert.equal(prop, "a rusty anchor");
  assert.equal(V2.validSubtitle("six words is one word too many", null), null);
});

test("v2: face placement puts the face box where asked; headline marks the power word", () => {
  const face = { width: 600, height: 700, faceBox: [200, 100, 180, 220] };
  const p = V2.placeFace(face, { fh: 330, cx: 960, top: 90 });
  assert.equal(p.face.h, 330);
  assert.equal(p.face.y, 90);
  assert.ok(Math.abs(p.face.x + p.face.w / 2 - 960) <= 1);
  assert.match(V2.headlineHtml({ text: "ENDLESS TRAP", highlight: "TRAP" }, "yellow"), /ENDLESS<br><span class="y">TRAP<\/span>/);
  assert.match(V2.headlineHtml({ text: "STOLEN WEALTH", highlight: "STOLEN" }, "chip"), /class="chip">STOLEN/);
  const { html, faceBox } = V2.buildVariant({ bgUri: "data:,", concept: { text: "A B", highlight: "B", subtitle: "S" }, hero: "face", face, faceUri: "data:,", faceAt: { fh: 330, cx: 960, top: 90 }, headStyle: "yellow", strip: "red", warm: true });
  assert.ok(faceBox && /data-subject/.test(html) && /data-secondary/.test(html));
});

test("v2: contrast counts a thick outline or a chip background, not just the pixels behind", () => {
  const dark = [{ p10: 0.01, p50: 0.02, p90: 0.05 }];
  const bright = [{ p10: 0.6, p50: 0.8, p90: 0.95 }];
  const white = { color: "rgb(255, 255, 255)", stroke: 9, strokeColor: "rgb(11, 13, 16)", bg: "rgba(0, 0, 0, 0)", spans: [] };
  assert.ok(V2.textContrast(white, dark) > 10);
  assert.ok(V2.textContrast(white, bright) > 10, "outline carries it on a bright background");
  const noStroke = { ...white, stroke: 0 };
  assert.ok(V2.textContrast(noStroke, bright) < 2);
  const chip = { ...noStroke, spans: [{ color: "rgb(255, 255, 255)", stroke: 0, strokeColor: "", bg: "rgb(224, 32, 46)" }] };
  assert.ok(V2.textContrast({ ...white, spans: chip.spans }, bright) >= 4.5);
});

test("face finder: licence filter (no share-alike), surname match, single-face rule", () => {
  const L = (id, sa = false) => ({ id, allowed: true, sa, label: id });
  const c = (id, licence, extra = {}) => ({ id, licence, mediaType: "image", origWidth: 800, origHeight: 1000, width: 800, height: 1000, via: "commons:search", ...extra });
  const out = TF.screenCandidates([
    c("File:Domingo Cavallo (cropped).jpg", L("cc-by-sa", true)),
    c("File:Domingo Cavallo 02(cropped).jpg", L("cc-by")),
    c("File:Mingo Park.jpg", L("cc0")),
    c("File:FirmaCavallo.png", L("pd")),
    c("File:Domingo Cavallo 1991.jpg", L("pd")),
    c("File:Portrait.jpg", L("pd"), { via: "wikidata:P18" }),
  ], "Domingo Cavallo");
  assert.deepEqual(out.map((x) => x.id), ["File:Portrait.jpg", "File:Domingo Cavallo 02(cropped).jpg", "File:Domingo Cavallo 1991.jpg"]);
  const cand = { width: 1000, height: 1000 };
  assert.equal(TF.score({ isPerson: true, confidence: 0.9, faces: 2, faceBox: [0.1, 0.1, 0.3, 0.3] }, cand), -1);
  assert.ok(TF.score({ isPerson: true, confidence: 0.9, faces: 1, faceBox: [0.1, 0.1, 0.3, 0.3], frontal: true }, cand) > 0);
  assert.equal(TF.score({ isPerson: true, confidence: 0.9, faces: 1, faceBox: [0.1, 0.1, 0.05, 0.05] }, cand), -1); // too small
  const b = TF.cropBox([400, 200, 100, 120], 1000, 800);
  assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= 1000 && b.y + b.h <= 800 && b.w % 2 === 0);
});

test("v2 review fixes: face gate, place cue, prop fit, no invented urgency", () => {
  // a crop that runs past the left/top of the photo is flagged; ending at the bottom is fine
  assert.equal(TF.cropBox([10, 200, 100, 120], 1000, 800).edge, true);
  assert.equal(TF.cropBox([450, 200, 100, 120], 1000, 500).edge, false);
  // sources under 600 px tall are not candidates
  const L = { id: "cc-by", allowed: true, sa: false, label: "CC BY" };
  assert.equal(TF.screenCandidates([{ id: "File:Domingo Cavallo 02(cropped).jpg", licence: L, mediaType: "image", origWidth: 350, origHeight: 425, via: "commons:search" }], "Domingo Cavallo").length, 0);
  // the story's country, its flag colours and a glowing outline from the geo assets
  const p = V2.placeOf({ outline: { title: "Why Argentina Keeps Going Broke" }, dossier: {}, topic: "x" });
  assert.equal(p.iso, "ARG");
  assert.deepEqual(p.colors, V2.FLAG.ARG);
  const o = V2.outlineSvg(p, { h: 600, cx: 900, cy: 360, mode: "hero" });
  assert.equal(o.box.h, 600);
  assert.match(o.svg, /<path d="M/);
  assert.equal(V2.placeOf({ outline: { title: "How Kingfisher collapsed" }, dossier: { entities: [] }, topic: "Kingfisher" }), null);
  // a wide prop is limited by width
  const wide = V2.placeProp({ width: 2000, height: 500, box: [0, 0, 2000, 500] }, { h: 450, cx: 900, cy: 360, maxW: 520 });
  assert.equal(wide.box.w, 520);
  assert.equal(V2.validSubtitle("$539M DUE TONIGHT", { text: "$539M" }), null);
});
