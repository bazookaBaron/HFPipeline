"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { summarizeTopic } = require("./topicStatus");

const topic = { id: "topic-1", videoRunId: "cs-1", carouselRunId: "car-1" };
const summarize = (video, carousel) => summarizeTopic(topic, (id) => ({ status: id === "cs-1" ? video : carousel }));

test("a topic tracks both assets independently", () => {
  assert.equal(summarize("succeeded", "succeeded").status, "done");
  assert.equal(summarize("succeeded", "not-started").status, "partial");
  assert.equal(summarize("succeeded", "failed").status, "needs-attention");
  assert.equal(summarize("queued", "succeeded").status, "running");
  assert.equal(summarize("interrupted", "succeeded").status, "needs-attention");
  assert.deepEqual([summarize("succeeded", "failed").videoStatus, summarize("succeeded", "failed").carouselStatus], ["succeeded", "failed"]);
});

test("untouched and missing runs do not look completed", () => {
  assert.equal(summarizeTopic({ id: "topic-2" }, () => null).status, "pending");
  assert.equal(summarizeTopic(topic, () => null).status, "needs-attention");
});
