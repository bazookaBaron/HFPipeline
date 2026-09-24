import { z } from "zod";

/**
 * Internal, business-logic shape of a scene / script.
 *
 * This mirrors the placeholder component contract handed down from the
 * orchestrating plan verbatim:
 *
 *   {
 *     sceneId: string,
 *     componentType: string,
 *     durationSeconds: number,
 *     narration: string,
 *     props: Record<string, unknown>,
 *     narrationAnchors: { anchorText: string, propPath: string }[]
 *   }
 *
 * NOTE: `componentType` values and the shape of `props` are placeholders.
 * Phase 2 (video-engine/compositions/components/) owns the real component
 * names and prop schemas and will publish them in its own README. Nothing
 * in this file, or in validation.ts / history.ts, depends on specific
 * componentType strings or specific prop keys -- see PHASE3-REPORT.md for
 * the exact reconciliation needed once that lands.
 */

export const NarrationAnchorSchema = z.object({
  anchorText: z.string(),
  propPath: z.string(),
});
export type NarrationAnchor = z.infer<typeof NarrationAnchorSchema>;

export const SceneSchema = z.object({
  sceneId: z.string(),
  componentType: z.string(),
  durationSeconds: z.number(),
  narration: z.string(),
  // Short (3-6 word) on-screen headline + an optional one-line subtitle for this scene,
  // independent of componentType/props. Added for the "light editorial" chapter-shell theme
  // (video-engine/compositions/components/chapter-shell/), which needs a real per-scene
  // headline to render as persistent chrome above the scene's own content -- see
  // orchestrator/lib/video/composeHtml.js's theme wiring. Every componentType gets one
  // (even dark-theme runs that never render it), so this never depends on which component a
  // scene happens to use.
  sceneHeadline: z.string(),
  sceneSubtitle: z.string(),
  props: z.record(z.string(), z.unknown()),
  narrationAnchors: z.array(NarrationAnchorSchema),
});
export type Scene = z.infer<typeof SceneSchema>;

export const ScriptSchema = z.object({
  topic: z.string(),
  // Bucket used for the local variety-history file, e.g. "cs-fundamentals",
  // "web-security", "carousel-devtips". Deliberately free-form/coarse.
  topicCategory: z.string(),
  scenes: z.array(SceneSchema),
});
export type Script = z.infer<typeof ScriptSchema>;

/** One scene-duration/topic brief the caller wants Gemini to script against. */
export interface SceneBrief {
  sceneId: string;
  targetDurationSeconds: number;
  beat: string; // short human description of what this scene should cover
}

export interface GenerationInput {
  topic: string;
  topicCategory: string;
  audienceNote?: string;
  scenes: SceneBrief[];
}

export interface StructuralIssue {
  check: "pacing" | "anchor" | "variety" | "placeholder" | "schema" | "componentCatalog" | "narrativeArc";
  sceneId?: string;
  message: string;
}

export interface ValidationConfig {
  wordsPerMinute: number;
  /** Fractional tolerance band around the ideal word count, e.g. 0.2 = +/-20%. */
  pacingTolerance: number;
  /** How many recent component usages (per topicCategory) to look at for variety checks. */
  varietyHistoryWindow: number;
  /** If a componentType occupies >= this fraction of recent history AND is reused, flag it. */
  varietyRepeatThreshold: number;
  /** Max retries after the first attempt (i.e. total attempts = maxRetries + 1). */
  maxRetries: number;
  /**
   * Narrative-arc completeness (checkNarrativeArc in validation.ts). A script
   * shorter than `minSceneCount` or longer than `maxSceneCount` is rejected.
   * Defaults are deliberately permissive (1..100) so this stays a no-op for
   * pre-existing short test/demo scripts; real generation should use
   * NARRATIVE_ARC_VALIDATION_CONFIG below to actually enforce the 10-16
   * scene / 90-150s target.
   */
  minSceneCount: number;
  maxSceneCount: number;
  /**
   * Gates the hook/recap text heuristics in checkNarrativeArc (first scene
   * must not read like generic throat-clearing, last scene must share real
   * vocabulary with an earlier scene). Off by default for the same
   * backward-compatibility reason as minSceneCount/maxSceneCount above.
   */
  requireArcHeuristics: boolean;
}

export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  wordsPerMinute: 150,
  pacingTolerance: 0.25,
  varietyHistoryWindow: 15,
  varietyRepeatThreshold: 0.5,
  maxRetries: 2,
  minSceneCount: 1,
  maxSceneCount: 100,
  requireArcHeuristics: false,
};

/**
 * Use this instead of DEFAULT_VALIDATION_CONFIG to actually enforce the
 * narrative-arc script-depth redesign: 10-16 scenes (matching the 90-150s
 * reference-video target researched for this pipeline -- see
 * promptBuilder.ts and orchestrator/lib/video/scenePlan.js, which target the
 * same range independently) plus the hook/recap heuristics. src/cli.ts uses
 * this for real generation; a caller wiring in their own GenerationInput
 * (e.g. a future orchestrator update) should pass this explicitly too.
 */
export const NARRATIVE_ARC_VALIDATION_CONFIG: ValidationConfig = {
  ...DEFAULT_VALIDATION_CONFIG,
  minSceneCount: 10,
  maxSceneCount: 16,
  requireArcHeuristics: true,
};
