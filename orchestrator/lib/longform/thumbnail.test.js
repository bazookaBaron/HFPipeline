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
