"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { normalizeLicense, fromCategories } = require("./license");

const table = [
  // [input, extra, allowed, id, label]
  ["CC BY-SA 4.0", {}, true, "cc-by-sa", "CC BY-SA 4.0"],
  ["CC BY-SA 3.0 de", {}, true, "cc-by-sa", "CC BY-SA 3.0"],
  ["CC BY 2.0", {}, true, "cc-by", "CC BY 2.0"],
  ["cc-by-sa-4.0", {}, true, "cc-by-sa", "CC BY-SA 4.0"],
  ["CC0", {}, true, "cc0", "CC0"],
  ["Public domain", {}, true, "pd", "Public domain"],
  ["PD-USGov-NASA", {}, true, "pd", "Public domain"],
  ["pdm", {}, true, "pd", "Public domain"],
  ["by", { version: "2.0" }, true, "cc-by", "CC BY 2.0"],
  ["by-sa", { version: "4.0" }, true, "cc-by-sa", "CC BY-SA 4.0"],
  ["CC BY-NC-SA 2.0", {}, false, "nc", null],
  ["CC BY-NC 4.0", {}, false, "nc", null],
  ["by-nc", {}, false, "nc", null],
  ["CC BY-ND 2.0", {}, false, "nd", null],
  ["GFDL 1.2", {}, false, "gfdl", null],
  ["", {}, false, "unknown", null],
  ["Copyrighted free use", {}, false, "unknown", null],
  ["", { url: "https://creativecommons.org/licenses/by-sa/2.0" }, true, "cc-by-sa", "CC BY-SA 2.0"],
];

for (const [input, extra, allowed, id, label] of table) {
  test(`licence "${input}" ${JSON.stringify(extra)} -> ${allowed ? "allow" : "reject"} ${id}`, () => {
    const r = normalizeLicense(input, extra);
    assert.strictEqual(r.allowed, allowed);
    assert.strictEqual(r.id, id);
    if (label) assert.strictEqual(r.label, label);
    if (!allowed) assert.ok(r.reason);
  });
}

test("CC BY-SA carries the share-alike flag and a licence URL", () => {
  const r = normalizeLicense("CC BY-SA 4.0");
  assert.strictEqual(r.sa, true);
  assert.strictEqual(r.attribution, true);
  assert.strictEqual(r.url, "https://creativecommons.org/licenses/by-sa/4.0/");
});

test("GFDL first pick is rescued by a CC category (dual licence), not otherwise", () => {
  const dual = normalizeLicense("GFDL 1.2", { categories: ["Category:GFDL-1.2", "Category:CC-BY-SA-3.0", "Category:Airbus A330"] });
  assert.strictEqual(dual.allowed, true);
  assert.strictEqual(dual.label, "CC BY-SA 3.0");
  assert.strictEqual(dual.via, "category");
  const only = normalizeLicense("GFDL 1.2", { categories: ["Category:GFDL-1.2", "Category:Items with VRTS permission confirmed"] });
  assert.strictEqual(only.allowed, false);
  assert.strictEqual(only.reason, "GFDL-only");
});

test("an NC licence is never rescued by categories", () => {
  const r = normalizeLicense("CC BY-NC-SA 2.0", { categories: ["Category:CC-BY-SA-2.0"] });
  assert.strictEqual(r.allowed, false);
});

test("category ranking prefers PD/CC0 over BY over BY-SA", () => {
  assert.strictEqual(fromCategories(["Category:CC-BY-SA-4.0", "Category:CC-BY-4.0"]).id, "cc-by");
  assert.strictEqual(fromCategories(["Category:CC-BY-SA-4.0", "Category:CC-Zero"]).id, "cc0");
  assert.strictEqual(fromCategories(["Category:Buildings in Mumbai"]), null);
});

test("GODL-India allowed with attribution; Flickr 'No known copyright restrictions' rejected", () => {
  const g = normalizeLicense("GODL-India");
  assert.strictEqual(g.allowed, true);
  assert.strictEqual(g.label, "GODL-India");
  assert.strictEqual(g.attribution, true);
  assert.strictEqual(normalizeLicense("", { categories: ["Category:GODL-India"] }).label, "GODL-India");
  assert.strictEqual(normalizeLicense("No restrictions").allowed, false);
  assert.strictEqual(normalizeLicense("No known copyright restrictions").allowed, false);
});
