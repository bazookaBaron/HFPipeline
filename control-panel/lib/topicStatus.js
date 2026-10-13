"use strict";

const ACTIVE = new Set(["queued", "running"]);
const BAD = new Set(["failed", "interrupted", "stubbed"]);

function summarizeTopic(topic, getRun) {
  const videoStatus = topic.videoRunId ? (getRun(topic.videoRunId)?.status || "missing") : "not-started";
  const carouselStatus = topic.carouselRunId ? (getRun(topic.carouselRunId)?.status || "missing") : "not-started";
  const statuses = [videoStatus, carouselStatus];
  let status = "pending";
  if (statuses.some((value) => ACTIVE.has(value))) status = "running";
  else if (statuses.every((value) => value === "succeeded")) status = "done";
  else if (statuses.some((value) => BAD.has(value) || value === "missing")) status = "needs-attention";
  else if (statuses.some((value) => value === "succeeded")) status = "partial";
  return { ...topic, status, videoStatus, carouselStatus };
}

module.exports = { summarizeTopic, ACTIVE };
