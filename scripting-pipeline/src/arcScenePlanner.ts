import type { SceneBrief } from "./types.js";

/**
 * Narrative-arc scene planner used by src/cli.ts for real/manual generation
 * runs.
 *
 * Mirrors the 7-stage arc described in promptBuilder.ts's prompt copy, and
 * independently mirrors (deliberately duplicated rather than shared --
 * scripting-pipeline and orchestrator/ are separate packages; the
 * orchestrator only ever consumes scripting-pipeline's compiled dist/
 * output, never its TypeScript source, per orchestrator/lib/video/
 * scriptGen.js's own comment) orchestrator/lib/video/scenePlan.js's scene
 * planning: hook -> naive/obvious approach -> why it breaks -> the real
 * mechanism (1-3 sub-step scenes when there's room) -> a complication or
 * edge case (1-2 scenes) -> a refinement or alternative (1-2 scenes) ->
 * recap. Scene count is clamped to [MIN_ARC_SCENES, MAX_ARC_SCENES] (10-16),
 * matching the 90-150s reference-video target from the script-depth research
 * behind this redesign (see PLAN.md discussion).
 */

interface ArcStage {
  key: string;
  min: number;
  max: number;
  beat: (part: number, total: number) => string;
}

const ARC_STAGES: ArcStage[] = [
  {
    key: "hook",
    min: 1,
    max: 1,
    beat: () => "Hook: state the problem or question directly -- no throat-clearing, no generic intro.",
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
      "Recap: tie it together, ideally with one concrete metaphor, synthesizing hook through refinement into a single takeaway. Do not introduce new unexplained material.",
  },
];

export const MIN_ARC_SCENES = ARC_STAGES.reduce((sum, s) => sum + s.min, 0); // 10
export const MAX_ARC_SCENES = ARC_STAGES.reduce((sum, s) => sum + s.max, 0); // 16

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Allocates `numScenes` (already clamped to [MIN_ARC_SCENES, MAX_ARC_SCENES])
 * across ARC_STAGES. Every stage starts at its minimum; extra scenes beyond
 * that go first to "mechanism", then "complication", then "refinement" (in
 * that priority order) up to each stage's max -- those are the stages that
 * benefit most from extra depth on a more complex topic.
 */
function allocateStages(numScenes: number): number[] {
  const counts = ARC_STAGES.map((s) => s.min);
  let remaining = numScenes - MIN_ARC_SCENES;
  const growPriority = ["mechanism", "complication", "refinement"];
  for (const key of growPriority) {
    if (remaining <= 0) break;
    const idx = ARC_STAGES.findIndex((s) => s.key === key);
    const room = ARC_STAGES[idx]!.max - counts[idx]!;
    const grant = Math.min(room, remaining);
    counts[idx] = counts[idx]! + grant;
    remaining -= grant;
  }
  return counts;
}

/** Builds the `beat` text for each scene, in arc order, for `numScenes` scenes. */
export function buildArcBeats(numScenes: number): string[] {
  const n = clamp(Math.round(numScenes), MIN_ARC_SCENES, MAX_ARC_SCENES);
  const counts = allocateStages(n);
  const beats: string[] = [];
  ARC_STAGES.forEach((stage, i) => {
    const total = counts[i]!;
    for (let part = 1; part <= total; part++) {
      beats.push(stage.beat(part, total));
    }
  });
  return beats;
}

/**
 * Plans `SceneBrief[]` for a target total video length in seconds, following
 * the narrative arc above. Per-scene target duration is spread evenly
 * (remainder on the last scene), clamped to a natural 6-26s speaking-pace
 * band. `totalSeconds` is floored at 90 (and defaults to 120 when falsy) so
 * a caller that forgets to pass a length still gets a real arc instead of a
 * cut-down one -- mirrors orchestrator/lib/video/scenePlan.js's own floor.
 */
export function planArcScenes(totalSeconds: number): SceneBrief[] {
  const total = Math.max(90, Number(totalSeconds) || 120);
  const idealSceneLen = 10; // midpoint of the reference-video pacing band
  const numScenes = clamp(Math.round(total / idealSceneLen), MIN_ARC_SCENES, MAX_ARC_SCENES);
  const beats = buildArcBeats(numScenes);

  const base = Math.floor(total / numScenes);
  const targets = new Array(numScenes).fill(clamp(base, 6, 20));
  const remainder = total - targets.reduce((a: number, b: number) => a + b, 0);
  targets[targets.length - 1] = clamp(targets[targets.length - 1] + remainder, 6, 26);

  return targets.map((targetDurationSeconds, i) => ({
    sceneId: `scene-${i + 1}`,
    targetDurationSeconds,
    beat: beats[i]!,
  }));
}
