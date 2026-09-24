"use strict";

/**
 * Piece 2 step 1 (scene planning). Decides scene count/target durations from
 * --length-seconds. Real per-scene duration is later ground-truthed by the
 * actual measured TTS audio (see narrationSync.js / generate-video.js) --
 * these targets only steer Gemini's pacing via the scripting-pipeline's
 * SceneBrief.targetDurationSeconds, not the final render.
 *
 * UPDATED for the scripting-pipeline narrative-arc script-depth redesign
 * (see scripting-pipeline/src/promptBuilder.ts and
 * scripting-pipeline/src/arcScenePlanner.ts, which independently target the
 * same arc/range -- scripting-pipeline and this file are deliberately kept
 * separate; scriptGen.js only ever imports scripting-pipeline's compiled
 * dist/ output, never its source, so the two beat-planning implementations
 * are duplicated on purpose rather than shared). Script-depth research
 * (PLAN.md) found real reference explainers run 2:00-2:20 across 8-10
 * narrative beats; the old 3-6 shallow "beats" here produced 45-60s videos
 * with no real arc. Scene count is now clamped to 10-16 (up from 3-6) and
 * beats follow a fixed 7-stage narrative arc: hook -> naive/obvious approach
 * -> why it breaks -> the real mechanism (2-3 scenes when there's room) ->
 * a complication or edge case -> a refinement or alternative -> recap.
 *
 * The `--length-seconds` floor/default is also raised (90s floor / 120s
 * default, instead of the old 15s floor / 45s default) so a caller that
 * doesn't pass an explicit longer value -- e.g. generate-video.js's own
 * `--length-seconds` CLI default of 45 -- still gets a real narrative arc
 * instead of a cut-down one.
 *
 * This file's exported contract is UNCHANGED: `planScenes(lengthSeconds)`
 * still returns `{sceneId, targetDurationSeconds, beat}[]`, so
 * orchestrator/generate-video.js and lib/video/scriptGen.js (both owned by
 * another workstream right now) need zero changes to keep working.
 */

// Each stage is one narrative beat; some may be split into multiple scenes
// when there's room (see min/max below). Order is fixed and matches
// scripting-pipeline/src/promptBuilder.ts's prompt copy.
const ARC_STAGES = [
  {
    key: "hook",
    min: 1,
    max: 1,
    beat: () =>
      "Hook: state the problem or question directly -- no throat-clearing, no generic intro ('In this video...').",
  },
  {
    key: "naive",
    min: 1,
    max: 1,
    beat: () => "Naive/obvious approach: what someone would try first, presented as if it might reasonably work.",
  },
  {
    key: "breaks",
    min: 1,
    max: 1,
    beat: () =>
      "Why it breaks: the concrete failure mode of that naive approach -- a specific, real way it goes wrong.",
  },
  {
    key: "mechanism",
    min: 3,
    max: 6,
    beat: (part, total) =>
      total > 1
        ? `The real mechanism (part ${part} of ${total}): go one level deeper into how it actually works, one sub-step or component at a time.`
        : "The real mechanism: how it actually works.",
  },
  {
    key: "complication",
    min: 2,
    max: 3,
    beat: (part, total) =>
      total > 1
        ? `A complication or edge case (part ${part} of ${total}): what makes this non-trivial in practice.`
        : "A complication or edge case: what makes this non-trivial in practice.",
  },
  {
    key: "refinement",
    min: 1,
    max: 3,
    beat: (part, total) =>
      total > 1
        ? `A refinement or alternative (part ${part} of ${total}): how real systems actually handle the complication above.`
        : "A refinement or alternative: how real systems actually handle the complication above.",
  },
  {
    key: "recap",
    min: 1,
    max: 1,
    beat: () =>
      "Recap: tie it together, ideally with one concrete metaphor (e.g. 'blue is the stage currently serving " +
      "the audience, green is an identical stage behind the curtain'), synthesizing hook through refinement " +
      "into a single takeaway. Do not introduce new unexplained material.",
  },
];

const MIN_SCENES = ARC_STAGES.reduce((sum, s) => sum + s.min, 0); // 10
const MAX_SCENES = ARC_STAGES.reduce((sum, s) => sum + s.max, 0); // 16

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Allocates `numScenes` (already clamped to [MIN_SCENES, MAX_SCENES]) across
 * ARC_STAGES. Every stage starts at its minimum; extra scenes beyond that go
 * first to "mechanism", then "complication", then "refinement" (in that
 * priority order) up to each stage's max -- those are the stages that
 * benefit most from extra depth on a more complex topic.
 */
function allocateStages(numScenes) {
  const counts = ARC_STAGES.map((s) => s.min);
  let remaining = numScenes - MIN_SCENES;
  const growPriority = ["mechanism", "complication", "refinement"];
  for (const key of growPriority) {
    if (remaining <= 0) break;
    const idx = ARC_STAGES.findIndex((s) => s.key === key);
    const room = ARC_STAGES[idx].max - counts[idx];
    const grant = Math.min(room, remaining);
    counts[idx] += grant;
    remaining -= grant;
  }
  return counts;
}

function buildBeats(numScenes) {
  const counts = allocateStages(numScenes);
  const beats = [];
  ARC_STAGES.forEach((stage, i) => {
    const total = counts[i];
    for (let part = 1; part <= total; part++) {
      beats.push(stage.beat(part, total));
    }
  });
  return beats;
}

/**
 * @param {number} lengthSeconds requested total video length
 * @returns {{sceneId: string, targetDurationSeconds: number, beat: string}[]}
 */
function planScenes(lengthSeconds) {
  // Reference videos run 2:00-2:20; floor/default raised from the old
  // 15s/45s (which produced shallow 3-6 scene scripts) so every real
  // narrative arc stays intact even when a caller doesn't pass an explicit
  // --length-seconds.
  const total = Math.max(90, Number(lengthSeconds) || 120);
  const idealSceneLen = 10; // midpoint of the reference-video pacing band
  const numScenes = clamp(Math.round(total / idealSceneLen), MIN_SCENES, MAX_SCENES);
  const beats = buildBeats(numScenes);

  const base = Math.floor(total / numScenes);
  const targets = new Array(numScenes).fill(clamp(base, 6, 20));
  const remainder = total - targets.reduce((a, b) => a + b, 0);
  targets[targets.length - 1] = clamp(targets[targets.length - 1] + remainder, 6, 26);

  return targets.map((targetDurationSeconds, i) => ({
    sceneId: `scene-${i + 1}`,
    targetDurationSeconds,
    beat: beats[i],
  }));
}

module.exports = { planScenes };
