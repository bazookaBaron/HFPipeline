"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { mergeTopicCalendar } = require("./topics");

test("calendar regeneration keeps completed assets and replaces only untouched ideas", () => {
  const old = [
    { id: "one", day: 1, date: "2026-10-01", topic: "Old done", status: "done", videoRunId: "cs-1", carouselRunId: "car-1" },
    { id: "two", day: 2, date: "2026-10-02", topic: "Old pending", status: "pending", videoRunId: null, carouselRunId: null },
    { id: "three", day: 3, date: "2026-10-03", topic: "Old partial", status: "pending", videoRunId: "cs-3", carouselRunId: null },
  ];
  const result = mergeTopicCalendar(old, [{ topic: "Why do websites slow down?", category: "web" }], 3);
  assert.equal(result[0], old[0]);
  assert.equal(result[1].topic, "Why do websites slow down?");
  assert.equal(result[1].id, "two");
  assert.equal(result[2], old[2]);
});
