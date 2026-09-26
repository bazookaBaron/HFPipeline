"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildPrompt, buildLongPrompt, cleanLongTopic, isLongDuplicate, appendUniqueLong, collectLongTopics,
  scheduleDates, parseDays, loadPastLongformTitles, LONG_CATEGORIES,
} = require("../generate-topics");

const item = (topic, category, entities, extra = {}) => ({ topic, category, angle: `Hook for ${topic}?`, entities, region: "india", ...extra });

test("long prompt: finance deep-dive contract, categories, mix, safety, avoid list", () => {
  const prompt = buildLongPrompt(16, ["Why Kingfisher Airlines went bankrupt"], { "business-model": 3 });
  for (const phrase of [
    "exactly 16", "8-12 minute", "16:9", "Indian audience", "Amul", "Kingfisher", "Pakistan",
    ...LONG_CATEGORIES.map((c) => `"${c}"`),
    "60%", "40%", "Never investment advice", "defamatory", "Geopolitics: neutral", "reputable sources",
    '"angle"', '"entities"', '"whyNow"', '"region"', "Why Kingfisher Airlines went bankrupt", "business-model: 3",
  ]) assert.ok(prompt.includes(phrase), phrase);
  assert.ok(!prompt.includes("CS/tech"), "long prompt must not reuse the short prompt");
  assert.ok(!buildLongPrompt(4, []).includes("Already planned per category"));
  // the short prompt is unchanged by the long mode
  assert.ok(buildPrompt(30, []).startsWith("Plan 30 distinct topics for a CS/tech explainer calendar."));
});

test("long cleaning: fields, category normalisation, entities, region, whyNow", () => {
  assert.deepEqual(cleanLongTopic({
    topic: ' 1. "How Amul became   India\'s biggest dairy brand" ', category: "Business Model",
    angle: "  How does a farmer co-op   beat global giants? ", entities: ["Amul", "amul", " GCMMF ", "", "Verghese Kurien", "NDDB", "extra"],
    region: "India", whyNow: "", extra: true,
  }), {
    topic: "How Amul became India's biggest dairy brand", category: "business-model",
    angle: "How does a farmer co-op beat global giants?", entities: ["Amul", "GCMMF", "Verghese Kurien", "NDDB"], region: "india",
  });
  const c = cleanLongTopic({ topic: "How Sri Lanka ran out of dollars", category: "sovereign debt", angle: "Why?", entities: "Sri Lanka, IMF", region: "moon", whyNow: "IMF review due" });
  assert.equal(c.category, "country-economics");
  assert.deepEqual(c.entities, ["Sri Lanka", "IMF"]);
  assert.equal(c.region, "global");
  assert.equal(c.whyNow, "IMF review due");
  assert.equal(cleanLongTopic({ topic: "Why Jet Airways collapsed", category: "collapse", entities: ["Jet Airways"] }), null, "angle required");
  assert.equal(cleanLongTopic({ topic: "Why Jet Airways collapsed", category: "collapse", angle: "Why?", entities: [] }), null, "entities required");
  assert.equal(cleanLongTopic({ topic: "Why Jet Airways collapsed", category: "gossip", angle: "Why?", entities: ["Jet"] }), null, "unknown category");
  assert.equal(cleanLongTopic({ topic: 7 }), null);
});

test("long cleaning rejects advice, sensational and defamatory framing", () => {
  for (const topic of ["Best stocks to buy in the gold rush", "Should you invest in copper now?", "The biggest scam in Indian banking", "How crooks looted a bank", "Price targets for Reliance explained"]) {
    assert.equal(cleanLongTopic(item(topic, "money-systems", ["X Corp"])), null, topic);
  }
  assert.equal(cleanLongTopic(item("Why oil prices matter", "sectors-commodities", ["Crude oil"], { angle: "Should you buy oil stocks?" })), null, "angle checked too");
  assert.ok(cleanLongTopic(item("How Satyam's accounting scandal unravelled", "collapse-turnaround", ["Satyam Computer Services"])));
});

test("long near-dup: wording, same main entity, broad entities exempt, avoid list and past titles", () => {
  const kf = cleanLongTopic(item("Why Kingfisher collapsed so fast", "collapse-turnaround", ["Kingfisher Airlines", "Vijay Mallya"]));
  assert.equal(isLongDuplicate(kf, ["How Kingfisher Airlines Collapsed into Rs 9,000 Cr Debt"]), true, "past title mentions the main entity");
  assert.equal(isLongDuplicate(kf, ["How Pakistan fell into a debt trap"]), false);
  const pk = cleanLongTopic(item("Why Pakistan keeps going back to the IMF", "country-economics", ["Pakistan", "IMF"]));
  assert.equal(isLongDuplicate(pk, ["How Pakistan fell into a debt trap"]), true);
  const gst = cleanLongTopic(item("How GST changed India's tax system", "money-systems", ["India", "GST Council"]));
  const rupee = cleanLongTopic(item("Why the rupee keeps weakening", "country-economics", ["India", "Rupee"]));
  assert.equal(isLongDuplicate(rupee, [], [gst]), false, "broad entity 'India' does not make topics duplicates");
  const amul = cleanLongTopic(item("How Amul makes money", "business-model", ["Amul"]));
  const amul2 = cleanLongTopic(item("The co-op model that beat Nestle", "business-model", ["Amul Dairy", "Nestle"]));
  assert.equal(isLongDuplicate(amul2, [], [amul]), true, "'Amul Dairy' contains the core of 'Amul'");
  const nestle = cleanLongTopic(item("Why Nestle sells Maggi so cheaply", "business-model", ["Nestle India", "Maggi"]));
  assert.equal(isLongDuplicate(nestle, [], [amul]), false, "different main subject");
  const amul3 = cleanLongTopic(item("Inside the dairy giant owned by farmers", "business-model", ["Amul"]));
  assert.equal(isLongDuplicate(amul3, [], [amul]), true, "same main entity within the calendar");
  const reworded = cleanLongTopic(item("How does Amul make money?", "business-model", ["GCMMF"]));
  assert.equal(isLongDuplicate(reworded, ["How Amul makes money"]), true, "near-duplicate wording");
});

test("appendUniqueLong balances categories and region until relaxed", () => {
  const raw = [
    item("How Zomato makes money", "business-model", ["Zomato"]),
    item("How Titan built a jewellery empire", "business-model", ["Titan"]),
    item("How Asian Paints dominates paint", "business-model", ["Asian Paints"]),
    item("Why Jet Airways collapsed", "collapse-turnaround", ["Jet Airways"]),
  ];
  const balanced = [];
  appendUniqueLong(raw, balanced, [], 4);
  // cap = ceil(4/5)+1 = 2 per category
  assert.deepEqual(balanced.map((t) => t.topic), ["How Zomato makes money", "How Titan built a jewellery empire", "Why Jet Airways collapsed"]);
  const relaxed = [];
  appendUniqueLong(raw, relaxed, [], 4, { enforceBalance: false });
  assert.equal(relaxed.length, 4);
  assert.throws(() => appendUniqueLong({ nope: 1 }, [], [], 2), /did not return a topic array/);
});

test("collectLongTopics refills remaining slots with the running mix, never persists, fails when exhausted", async () => {
  const calls = [];
  const batches = [
    [item("How Zomato makes money", "business-model", ["Zomato"]), item("Best stocks to buy now", "money-systems", ["NSE"])],
    [item("How Zomato earns from delivery", "business-model", ["Zomato"]), item("How UPI moves money for free", "money-systems", ["UPI", "NPCI"])],
  ];
  const result = await collectLongTopics(2, ["Old topic"], async (remaining, excluded, mix) => {
    calls.push({ remaining, excluded, mix });
    return batches.shift();
  });
  assert.deepEqual(calls, [
    { remaining: 2, excluded: ["Old topic"], mix: {} },
    { remaining: 1, excluded: ["Old topic", "How Zomato makes money"], mix: { "business-model": 1 } },
  ]);
  assert.deepEqual(result.map((t) => t.topic), ["How Zomato makes money", "How UPI moves money for free"]);
  assert.deepEqual(Object.keys(result[1]), ["topic", "category", "angle", "entities", "region"]);
  await assert.rejects(collectLongTopics(2, [], async () => [item("Same", "business-model", ["Same Co"])]), /Only 1\/2 unique long-form topics after 3 batches/);
});

test("schedule: 4 days a week (Mon/Tue/Thu/Sat by default), inclusive start, configurable days", () => {
  // 2026-09-27 is a Sunday
  assert.deepEqual(scheduleDates(6, { start: "2026-09-27" }), ["2026-09-28", "2026-09-29", "2026-10-01", "2026-10-03", "2026-10-05", "2026-10-06"]);
  const month = scheduleDates(16, { start: "2026-09-28" });
  assert.equal(month.length, 16);
  assert.equal(month[0], "2026-09-28", "start day counts when it is a publish day");
  assert.equal(month[15], "2026-10-24");
  const weekdays = month.map((d) => new Date(`${d}T00:00:00Z`).getUTCDay());
  assert.deepEqual([...new Set(weekdays)].sort(), [1, 2, 4, 6]);
  assert.deepEqual(scheduleDates(3, { start: "2026-12-30", days: "wed,fri" }), ["2026-12-30", "2027-01-01", "2027-01-06"], "crosses the year");
  assert.deepEqual(parseDays("Sat, monday,TUE,sat,xyz"), ["mon", "tue", "sat"]);
  assert.throws(() => parseDays("xyz"), /--days/);
  assert.throws(() => scheduleDates(1, { start: "27/09/2026" }), /YYYY-MM-DD/);
});

test("past long-form runs: titles and topics come from <dir>/<run>/outline.json", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-past-"));
  try {
    fs.mkdirSync(path.join(dir, "run1"));
    fs.writeFileSync(path.join(dir, "run1", "outline.json"), JSON.stringify({ topic: "Why Kingfisher went bankrupt", title: "How Kingfisher Collapsed" }));
    fs.mkdirSync(path.join(dir, "run2"));
    fs.writeFileSync(path.join(dir, "run2", "outline.json"), "{broken");
    fs.mkdirSync(path.join(dir, "cs-run"));
    assert.deepEqual(loadPastLongformTitles([dir, path.join(dir, "missing")]), ["Why Kingfisher went bankrupt", "How Kingfisher Collapsed"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
