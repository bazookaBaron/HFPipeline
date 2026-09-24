"use strict";

/**
 * Per-run stage instrumentation. The audited job cs-b9d30fa7964c0cf0 persisted only a start/end
 * time (767 s total), so neither latency nor the 45 s -> 70 s duration drift could be attributed to
 * a stage. This records wall time per stage, the duration chain (requested -> planned -> authored
 * audio -> final mp4), Gemini attempts, and -- on failure -- which stage failed and in which
 * failure class, into `<out>.metrics.json` next to the output video.
 */

const fs = require("fs");

// Failure classes shared with the v2 QA layer: a failure is repaired at the layer that caused it.
const FAILURE_CLASS = {
  script: "script",
  voice: "voice/alignment",
  compose: "visual-contract",
  check: "component/layout",
  render: "renderer",
  post: "renderer",
};

function createRunMetrics({ runId, metricsPath, config, now = () => Date.now() }) {
  const t0 = now();
  const data = {
    runId,
    config,
    startedAt: new Date(t0).toISOString(),
    stages: [],
    duration: {},
    counts: {},
    outcome: "running",
  };
  let open = null;

  function write() {
    if (!metricsPath) return;
    try {
      fs.writeFileSync(metricsPath, JSON.stringify(data, null, 2), "utf-8");
    } catch (_) {
      // Instrumentation must never fail a render.
    }
  }

  return {
    data,
    start(stage) {
      if (open) this.end();
      open = { stage, startMs: now() - t0 };
    },
    end(extra) {
      if (!open) return;
      const endMs = now() - t0;
      data.stages.push({ stage: open.stage, startMs: open.startMs, wallMs: endMs - open.startMs, ...(extra || {}) });
      open = null;
      write();
    },
    set(section, values) {
      Object.assign(data[section] || (data[section] = {}), values);
    },
    fail(stage, err) {
      if (open) this.end({ failed: true });
      data.outcome = "failed";
      data.failure = { stage, class: FAILURE_CLASS[stage] || "unknown", message: String((err && err.message) || err) };
      data.totalWallMs = now() - t0;
      write();
    },
    succeed() {
      if (open) this.end();
      data.outcome = "succeeded";
      data.totalWallMs = now() - t0;
      write();
    },
  };
}

module.exports = { createRunMetrics, FAILURE_CLASS };
