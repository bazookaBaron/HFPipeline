"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { validateMetadata } = require("../make-publish-metadata");

test("publishing metadata has all required fields and rejects placeholders", () => {
  const good = validateMetadata({ title: "Why websites slow down", description: "A short guide to what happens when traffic surges.", tags: ["websites", "traffic", "servers"], thumbnailText: "TOO MANY VISITORS" }, "youtube");
  assert.equal(good.tags.length, 3);
  assert.equal(good.thumbnailText, "TOO MANY VISITORS");
  assert.throws(() => validateMetadata({ ...good, title: "@example" }, "youtube"), /placeholder/);
  assert.throws(() => validateMetadata({ ...good, tags: [] }, "youtube"), /length/);
});
