"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { tierOf, vetFactSources } = require("./sourceQuality");

test("source tiers", () => {
  assert.strictEqual(tierOf("https://www.rbi.org.in/Scripts/x"), "official");
  assert.strictEqual(tierOf("https://www.imf.org/en/x"), "official");
  assert.strictEqual(tierOf("https://www.livemint.com/x"), "press");
  assert.strictEqual(tierOf("https://en.wikipedia.org/wiki/x"), "reference");
  assert.strictEqual(tierOf("https://www.quora.com/x"), "ugc");
  assert.strictEqual(tierOf("https://www.slideshare.net/x"), "ugc");
  assert.strictEqual(tierOf("https://unknown-blog.in/x"), "other");
});

test("a figure needs a non-UGC source; UGC is dropped from kept facts", () => {
  const ugc = { title: "quora", url: "https://www.quora.com/a" };
  const mint = { title: "mint", url: "https://www.livemint.com/a" };
  assert.deepStrictEqual(vetFactSources([ugc], true), { keep: false, sources: [], ugcOnly: true });
  const mixed = vetFactSources([ugc, mint], true);
  assert.ok(mixed.keep && mixed.sources.length === 1 && mixed.sources[0] === mint);
  const qual = vetFactSources([ugc], false);
  assert.ok(qual.keep && qual.ugcOnly);
});
