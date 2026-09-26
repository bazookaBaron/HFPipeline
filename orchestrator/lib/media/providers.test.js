"use strict";
// Provider parsers against recorded API responses (fixtures/*.json, recorded 2026-09-26).

const test = require("node:test");
const assert = require("node:assert");
const commons = require("./providers/commons");
const wikidata = require("./providers/wikidata");
const openverse = require("./providers/openverse");
const nasa = require("./providers/nasa");

const fx = (n) => require(`./fixtures/${n}`);

test("commons: licences, authors, thumb vs original URL, rank order", () => {
  const c = commons.parsePages(fx("commons-search-kingfisher.json"), "commons:search", "Kingfisher Airlines aircraft");
  assert.strictEqual(c.length, 8);
  // sorted by search index
  assert.strictEqual(c[0].id, "File:Kingfisher Airlines tail.JPG");
  const tail = c[0];
  assert.strictEqual(tail.licence.label, "CC BY-SA 4.0");
  assert.strictEqual(tail.licence.allowed, true);
  assert.strictEqual(tail.author, "Prateek Karandikar");
  assert.strictEqual(tail.width, 1920); // 3648 px original -> 1920 thumb
  assert.match(tail.fileUrl, /\/1920px-/);
  const a320 = c.find((x) => x.id === "File:Kingfisher Airlines Airbus A320-200.jpg");
  assert.strictEqual(a320.author, "marirs"); // from <a> HTML
  assert.strictEqual(a320.width, 1200); // smaller than 1920: the original is served
  assert.doesNotMatch(a320.fileUrl, /\/thumb\//);
  const gfdl = c.filter((x) => x.licence.id === "gfdl");
  assert.strictEqual(gfdl.length, 5);
  assert.ok(gfdl.every((x) => !x.licence.allowed));
  assert.strictEqual(c.find((x) => /JP7333565/.test(x.id)).author, "Sean D Silva");
});

test("wikidata: entity pick skips namesakes, claims parsed", () => {
  const s = fx("wikidata-search-kingfisher.json");
  const pick = wikidata.pickEntity(s.search, { name: "Kingfisher Airlines", classHint: "airline" });
  assert.strictEqual(pick.id, "Q744935");
  // a query for the tennis event must not land on the list article
  const e = wikidata.parseEntity(fx("wikidata-entity-Q744935.json"), "Q744935");
  assert.strictEqual(e.image, "Kingfisher Airlines Airbus A320-200.jpg");
  assert.strictEqual(e.commonsCategory, "Kingfisher Airlines");
  assert.strictEqual(e.logo, null);
  const files = wikidata.filesForKind(e, "photo", "Kingfisher aircraft");
  assert.deepStrictEqual(files.map((f) => f.prop), ["P18"]);
  assert.deepStrictEqual(wikidata.filesForKind({ ...e, logo: "Kingfisher logo.svg" }, "logo", "").map((f) => f.prop), ["P154"]);
});

test("openverse: results mapped to candidates with provider and licence", () => {
  const c = openverse.parseResults(fx("openverse-search-mumbai-airport.json"), "Mumbai airport");
  assert.ok(c.length >= 5);
  const first = c[0];
  assert.strictEqual(first.source, "openverse");
  assert.strictEqual(first.provider, "flickr");
  assert.strictEqual(first.licence.label, "CC BY 2.0");
  assert.ok(first.licence.allowed);
  assert.ok(first.pageUrl.startsWith("http"));
  assert.ok(c.every((x) => x.licence.allowed));
});

test("nasa: public domain unless credited to a third party; picks a <= 2400 px rendition", () => {
  const c = nasa.parseResults(fx("nasa-search-refuel.json"), "aircraft refueling");
  assert.ok(c.length >= 1);
  assert.strictEqual(c[0].licence.label, "Public domain");
  assert.ok(c[0].width > 0 && c[0].width <= 2400);
  assert.match(c[0].pageUrl, /^https:\/\/images\.nasa\.gov\/details\//);
  const third = nasa.parseResults(
    { collection: { items: [{ data: [{ nasa_id: "x", media_type: "image", description: "Photo courtesy of Boeing. © Boeing", center: "HQ" }], links: [{ href: "https://x/y~medium.jpg", render: "image", width: 1280, height: 720 }] }] } },
    "q"
  );
  assert.strictEqual(third[0].licence.allowed, false);
});
