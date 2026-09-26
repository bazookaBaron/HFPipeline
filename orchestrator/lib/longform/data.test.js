"use strict";

// Offline: World Bank responses recorded live on 2026-09-27 (fixtures/lf/data/wb-responses.json).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const D = require("./data");

const REC = require("../../fixtures/lf/data/wb-responses.json");
const EXPECTED = require("../../fixtures/lf/data/expected-data.json");
const DOSSIER = {
  facts: [{ id: "F1", claim: "x", sources: [{ title: "t", url: "https://example.org" }], confidence: "high" }],
  sources: [{ id: "S1", title: "t", url: "https://example.org" }],
  dataAsks: [
    { metric: "Pakistan external debt", country: "Pakistan", years: [2010, 2023], worldBankIndicator: "DT.DOD.DECT.GN.ZS" },
    { metric: "India GDP", country: "IND", years: [2000, 2023], worldBankIndicator: "NY.GDP.MKTP.CD" },
    { metric: "Kingfisher revenue", country: null, years: [2005, 2012] },
  ],
};
const NOW = Date.parse("2026-09-27T01:00:00Z");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "lf-data-"));
function replayFetch(calls) {
  return async (url) => {
    calls && calls.push(url);
    if (!(url in REC)) throw new Error(`no recording for ${url}`);
    return { ok: true, status: 200, json: async () => REC[url] };
  };
}
const strip = (d) => JSON.parse(JSON.stringify(d, (k, v) => (k === "retrieved" ? undefined : v)));

test("buildData: recorded World Bank responses -> the expected data.json (deterministic)", async () => {
  const calls = [];
  const data = await D.buildData(DOSSIER, { fetch: replayFetch(calls), cacheDir: tmp(), now: () => NOW, minGapMs: 0, maps: ["DT.DOD.DECT.GN.ZS"] });
  assert.deepStrictEqual(strip(data), strip(EXPECTED));
  assert.ok(data.series.every((s) => s.retrieved === "2026-09-27"));
  // exact API shape (verified live): /v2/country/<ISO3>/indicator/<CODE>?format=json&date=Y1:Y2&per_page=100
  assert.ok(calls.includes("https://api.worldbank.org/v2/country/PAK/indicator/DT.DOD.DECT.GN.ZS?format=json&date=2010:2023&per_page=100&page=1"));
  const [s1, s2, s3] = data.series;
  assert.strictEqual(s1.id, "S1");
  assert.strictEqual(s1.unit, "% of GNI");
  assert.strictEqual(s1.source, "World Bank, External debt stocks (% of GNI) (DT.DOD.DECT.GN.ZS)");
  assert.strictEqual(s1.licence, "CC BY 4.0");
  assert.deepStrictEqual(s1.points.slice(-1)[0], { x: 2023, y: 39.4 });
  assert.ok(s1.points.every((p, i) => i === 0 || p.x > s1.points[i - 1].x), "ascending years");
  assert.strictEqual(s2.unit, "US$ trillion");
  assert.strictEqual(s2.decimals, 2);
  assert.strictEqual(s3.kind, "map");
  assert.strictEqual(s3.year, 2023);
  assert.ok(Object.keys(s3.values).length > 100 && !("AFE" in s3.values), "countries only, no aggregates");
  assert.strictEqual(data.skipped.length, 1);
});

test("cache: a fresh entry is used without a request; stale + offline still serves it", async () => {
  const dir = tmp();
  await D.buildData(DOSSIER, { fetch: replayFetch(), cacheDir: dir, now: () => NOW, minGapMs: 0, maps: false });
  const boom = async () => {
    throw new Error("network must not be touched");
  };
  const again = await D.buildData(DOSSIER, { fetch: boom, cacheDir: dir, now: () => NOW + 3600e3, minGapMs: 0, maps: false });
  assert.strictEqual(again.series.length, 2);
  const offline = await D.buildData(DOSSIER, { fetch: boom, cacheDir: dir, now: () => NOW + 30 * 24 * 3600e3, offline: true, maps: false });
  assert.strictEqual(offline.series.length, 2);
  const empty = await D.buildData(DOSSIER, { fetch: boom, cacheDir: tmp(), offline: true, maps: false });
  assert.strictEqual(empty.series.length, 0);
  assert.ok(empty.skipped.some((s) => /offline/.test(s.reason)));
});

test("resolveCountry / splitIndicatorName / scaleFor / withUnit", () => {
  const list = [{ iso3: "PAK", iso2: "PK", name: "Pakistan" }, { iso3: "LKA", iso2: "LK", name: "Sri Lanka" }];
  assert.strictEqual(D.resolveCountry("Pakistan", list), "PAK");
  assert.strictEqual(D.resolveCountry("PK", list), "PAK");
  assert.strictEqual(D.resolveCountry("sri lanka", list), "LKA");
  assert.strictEqual(D.resolveCountry(null, list), null);
  assert.strictEqual(D.resolveCountry("Atlantis", list), undefined);
  assert.deepStrictEqual(D.splitIndicatorName("GDP (current US$)"), { metric: "GDP", unit: "current US$" });
  assert.deepStrictEqual(D.splitIndicatorName("Total reserves in months of imports"), { metric: "Total reserves", unit: "months of imports" });
  assert.deepStrictEqual(D.scaleFor("current US$", [3.5e12], 0), { div: 1e12, unit: "US$ trillion", decimals: 2 });
  assert.deepStrictEqual(D.scaleFor("% of GNI", [39.44], 1), { div: 1, unit: "% of GNI", decimals: 1 });
  assert.strictEqual(D.withUnit(39.4, "% of GNI", 1), "39.4% of GNI");
  assert.strictEqual(D.withUnit(3.5, "US$ trillion", 2), "US$3.50 trillion");
});

test("dataFacts: latest + peak per time series, merge is idempotent", () => {
  const facts = D.dataFacts(EXPECTED);
  assert.deepStrictEqual(facts.map((f) => [f.id, f.series, f.year, f.value, f.unit]), [
    ["D1", "S1", 2023, 39.4, "% of GNI"],
    ["D2", "S1", 2020, 40, "% of GNI"],
    ["D3", "S2", 2023, 3.5, "US$ trillion"],
  ]);
  assert.strictEqual(facts[0].claim, "Pakistan's external debt stocks stood at 39.4% of GNI in 2023 (World Bank).");
  assert.strictEqual(facts[2].claim, "India's GDP stood at US$3.50 trillion in 2023 (World Bank).");
  const once = D.mergeDataFacts(DOSSIER, EXPECTED);
  const twice = D.mergeDataFacts(once, EXPECTED);
  assert.deepStrictEqual(twice, once);
  assert.strictEqual(once.facts.filter((f) => /^D/.test(f.id)).length, 3);
  assert.ok(once.sources.some((s) => /worldbank\.org/.test(s.url)));
  assert.deepStrictEqual(once.dataSeries.map((s) => s.id), ["S1", "S2", "S3"]);
});
