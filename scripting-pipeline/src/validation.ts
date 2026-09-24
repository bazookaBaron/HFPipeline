import type { Script, Scene, StructuralIssue, ValidationConfig } from "./types.js";
import type { ComponentHistory } from "./history.js";
import { loadComponentCatalog, findComponent, type ComponentInfo } from "./componentCatalog.js";

/**
 * Structural checks that run *after* zod/responseSchema validation has
 * already confirmed the response is shaped correctly. These catch things a
 * schema cannot express: numeric relationships, cross-field references,
 * repetition across runs, and semantic emptiness.
 *
 * Deliberately generic: nothing here reads specific componentType strings
 * or specific prop keys, so it keeps working unchanged once Phase 2's real
 * component catalog replaces the placeholder names.
 */

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /lorem\s+ipsum/i,
  /\bplaceholder\b/i,
  /your\s+headline\s+here/i,
  /your\s+text\s+here/i,
  /insert\s+(your\s+)?(text|headline|title|content)\s+here/i,
  /^\s*(tbd|todo|n\/?a|xxx|fixme)\s*$/i,
  /coming\s+soon/i,
  /sample\s+text/i,
  /^\s*(foo|bar|baz|foobar)\s*$/i,
  /example\.com/i,
  /^\s*test\s*(content|text|value)?\s*$/i,
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** Recursively collect every string leaf value out of a props object. */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Pacing budget
// ---------------------------------------------------------------------------

export function checkPacing(script: Script, config: ValidationConfig): StructuralIssue[] {
  const issues: StructuralIssue[] = [];
  const wordsPerSecond = config.wordsPerMinute / 60;

  for (const scene of script.scenes) {
    const actualWords = words(scene.narration).length;
    const idealWords = scene.durationSeconds * wordsPerSecond;
    const minWords = idealWords * (1 - config.pacingTolerance);
    const maxWords = idealWords * (1 + config.pacingTolerance);

    if (actualWords < minWords) {
      issues.push({
        check: "pacing",
        sceneId: scene.sceneId,
        message:
          `Scene "${scene.sceneId}" is under-paced: ${actualWords} narration word(s) for a ` +
          `${scene.durationSeconds}s scene at ${config.wordsPerMinute}wpm expects roughly ` +
          `${Math.round(idealWords)} words (min ${Math.round(minWords)}). Add narration or shorten the scene.`,
      });
    } else if (actualWords > maxWords) {
      issues.push({
        check: "pacing",
        sceneId: scene.sceneId,
        message:
          `Scene "${scene.sceneId}" is over-paced: ${actualWords} narration word(s) for a ` +
          `${scene.durationSeconds}s scene at ${config.wordsPerMinute}wpm expects roughly ` +
          `${Math.round(idealWords)} words (max ${Math.round(maxWords)}). Trim narration or lengthen the scene.`,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// 2. Narration-anchor correctness
// ---------------------------------------------------------------------------

export function checkAnchors(script: Script, catalog: ComponentInfo[] = loadComponentCatalog()): StructuralIssue[] {
  const issues: StructuralIssue[] = [];

  for (const scene of script.scenes) {
    const component = findComponent(catalog, scene.componentType);

    for (const anchor of scene.narrationAnchors) {
      if (anchor.anchorText.length === 0) {
        issues.push({
          check: "anchor",
          sceneId: scene.sceneId,
          message: `Scene "${scene.sceneId}" has an empty narrationAnchor.anchorText.`,
        });
        continue;
      }

      if (!scene.narration.includes(anchor.anchorText)) {
        issues.push({
          check: "anchor",
          sceneId: scene.sceneId,
          message:
            `Scene "${scene.sceneId}" has narrationAnchor anchorText "${anchor.anchorText}" ` +
            `which is not a verbatim substring of its narration: "${scene.narration}". ` +
            `anchorText must be copy-pasted exactly from the narration, not paraphrased.`,
        });
      }

      if (!anchor.propPath.startsWith("props.")) {
        issues.push({
          check: "anchor",
          sceneId: scene.sceneId,
          message:
            `Scene "${scene.sceneId}" narrationAnchor propPath "${anchor.propPath}" must start ` +
            `with "props." (e.g. "props.urlText").`,
        });
        continue;
      }

      const topLevelKey = anchor.propPath.slice("props.".length).split(".")[0];
      if (!topLevelKey) continue;

      // REAL BUG (found via a real end-to-end render, 2026-09): a narrationAnchor's whole
      // purpose is to time a REVEAL, so its propPath must always name a "..._at" timing
      // variable -- never a content/style prop. This check used to only flag a propPath
      // whose top-level key was MISSING from scene.props entirely, which meant a key that
      // happened to ALREADY exist as real Gemini-authored content (e.g. "props.edges" on a
      // node-graph-diagram scene, or "props.items" on a checklist-progress scene) passed
      // validation cleanly. Downstream, generate-video.js's real prop merge
      // (`{...scene.props, ...timingProps}`) then overwrote that entire content value with
      // a bare resolved-seconds NUMBER -- confirmed in a real generated composition:
      // `"edges":4.385` (a number, not the real edges array) and `"items":9.986` (same for
      // checklist-progress), silently destroying that scene's real content. This is almost
      // certainly the TRUE root cause of the "node-graph-diagram missing an edge" bug this
      // project chased earlier with a prompt hint alone -- the edges array wasn't omitted by
      // Gemini, it was clobbered downstream by this exact gap. A prop key ending in "_at" is
      // this library's own universal timing-prop naming convention (every component's own
      // schema follows it, see promptBuilder.ts / README.md) -- require it unconditionally,
      // never letting "the key happens to already exist" excuse a non-timing target.
      const isTimingKey = topLevelKey.endsWith("_at");
      if (!isTimingKey) {
        issues.push({
          check: "anchor",
          sceneId: scene.sceneId,
          message:
            `Scene "${scene.sceneId}" narrationAnchor propPath "${anchor.propPath}" references ` +
            `prop key "${topLevelKey}", which is not a timing prop (must end in "_at", e.g. ` +
            `"props.reveal_at" or "props.switch_at"). A narrationAnchor times WHEN something ` +
            `reveals -- it must never target a content/style prop like a list, array, or ` +
            `label, since that would overwrite that prop's real content with a timestamp ` +
            `downstream. Choose a real "..._at" timing variable of component "${scene.componentType}" instead.`,
        });
        continue;
      }

      const existsInProps = topLevelKey in scene.props;
      // A propPath that names one of the component's own declared `..._at`
      // timing variables is EXPECTED to be absent from Gemini-authored props
      // -- those are intentionally omitted from authoring (per
      // promptBuilder.ts) and computed downstream from real narration
      // timestamps instead. Only flag a missing key when it isn't a real
      // timing variable of this scene's own component.
      const isRealTimingVar =
        !!component && component.variables.some((v) => v.id === topLevelKey && v.id.endsWith("_at"));

      if (!existsInProps && !isRealTimingVar) {
        issues.push({
          check: "anchor",
          sceneId: scene.sceneId,
          message:
            `Scene "${scene.sceneId}" narrationAnchor propPath "${anchor.propPath}" references ` +
            `prop key "${topLevelKey}" which does not exist in this scene's props (${Object.keys(scene.props).join(", ") || "none"}) ` +
            `and is not a real "..._at" timing variable of component "${scene.componentType}".`,
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// 3. Content variety (vs. local history)
// ---------------------------------------------------------------------------

export function checkVariety(
  script: Script,
  history: ComponentHistory,
  config: ValidationConfig
): StructuralIssue[] {
  const issues: StructuralIssue[] = [];
  const recent = history.getRecent(script.topicCategory, config.varietyHistoryWindow);

  if (recent.length > 0) {
    const recentCounts = new Map<string, number>();
    for (const componentType of recent) {
      recentCounts.set(componentType, (recentCounts.get(componentType) ?? 0) + 1);
    }

    const usedInThisScript = new Set(script.scenes.map((s) => s.componentType));

    for (const componentType of usedInThisScript) {
      const priorCount = recentCounts.get(componentType) ?? 0;
      const priorFraction = priorCount / recent.length;
      if (priorFraction >= config.varietyRepeatThreshold) {
        issues.push({
          check: "variety",
          message:
            `componentType "${componentType}" already makes up ${Math.round(priorFraction * 100)}% ` +
            `of the last ${recent.length} scene(s) used for topicCategory "${script.topicCategory}" ` +
            `(threshold ${Math.round(config.varietyRepeatThreshold * 100)}%). Reusing it again risks a ` +
            `repetitive-looking series -- choose a different component type for this scene.`,
        });
      }
    }
  }

  // Also flag a script that is internally monotonous regardless of history:
  // e.g. every single scene using the same componentType.
  if (script.scenes.length >= 3) {
    const distinctTypes = new Set(script.scenes.map((s) => s.componentType));
    if (distinctTypes.size === 1) {
      issues.push({
        check: "variety",
        message:
          `All ${script.scenes.length} scenes use the same componentType ` +
          `("${script.scenes[0]!.componentType}"). Vary the visual treatment across scenes.`,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// 4. Placeholder-content detection
// ---------------------------------------------------------------------------

export function checkPlaceholders(script: Script): StructuralIssue[] {
  const issues: StructuralIssue[] = [];

  for (const scene of script.scenes) {
    if (words(scene.sceneHeadline).length === 0) {
      issues.push({
        check: "placeholder",
        sceneId: scene.sceneId,
        message: `Scene "${scene.sceneId}" has empty sceneHeadline.`,
      });
    } else {
      for (const pattern of PLACEHOLDER_PATTERNS) {
        if (pattern.test(scene.sceneHeadline)) {
          issues.push({
            check: "placeholder",
            sceneId: scene.sceneId,
            message: `Scene "${scene.sceneId}" sceneHeadline looks like boilerplate/placeholder text: "${scene.sceneHeadline}".`,
          });
          break;
        }
      }
    }

    if (words(scene.narration).length === 0) {
      issues.push({
        check: "placeholder",
        sceneId: scene.sceneId,
        message: `Scene "${scene.sceneId}" has empty narration.`,
      });
    } else {
      for (const pattern of PLACEHOLDER_PATTERNS) {
        if (pattern.test(scene.narration)) {
          issues.push({
            check: "placeholder",
            sceneId: scene.sceneId,
            message: `Scene "${scene.sceneId}" narration looks like boilerplate/placeholder text: "${scene.narration}".`,
          });
          break;
        }
      }
    }

    const propEntries = Object.entries(scene.props);
    if (propEntries.length === 0) {
      issues.push({
        check: "placeholder",
        sceneId: scene.sceneId,
        message: `Scene "${scene.sceneId}" has no authored props at all.`,
      });
    }

    const componentTypeNormalized = normalize(scene.componentType);

    for (const [key, value] of propEntries) {
      const strings = collectStrings(value);
      if (strings.length === 0) continue; // non-string prop (number/bool/etc.) -- nothing to check here

      for (const str of strings) {
        if (str.trim().length === 0) {
          issues.push({
            check: "placeholder",
            sceneId: scene.sceneId,
            message: `Scene "${scene.sceneId}" prop "${key}" is an empty string.`,
          });
          continue;
        }

        for (const pattern of PLACEHOLDER_PATTERNS) {
          if (pattern.test(str)) {
            issues.push({
              check: "placeholder",
              sceneId: scene.sceneId,
              message: `Scene "${scene.sceneId}" prop "${key}" looks like boilerplate/placeholder text: "${str}".`,
            });
            break;
          }
        }

        if (normalize(str) === componentTypeNormalized && componentTypeNormalized.length > 0) {
          issues.push({
            check: "placeholder",
            sceneId: scene.sceneId,
            message:
              `Scene "${scene.sceneId}" prop "${key}" ("${str}") is literally just the component ` +
              `name ("${scene.componentType}") -- author real topic-specific content instead.`,
          });
        }
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// 5. Real component catalog membership
// ---------------------------------------------------------------------------

/**
 * Rejects any scene whose componentType is not one of the REAL registered
 * components (read live from each component folder's registry-item.json
 * via componentCatalog.ts). This is the reconciliation PHASE3-REPORT.md flagged:
 * Gemini used to be free to invent any componentType string with no
 * connection to reality -- this check closes that gap and feeds the specific
 * failure (plus the full list of valid names) back through the existing
 * reject-and-repair loop exactly like the other structural checks.
 */
export function checkComponentCatalog(
  script: Script,
  catalog: ComponentInfo[] = loadComponentCatalog()
): StructuralIssue[] {
  const issues: StructuralIssue[] = [];
  const validNames = new Set(catalog.map((c) => c.name));

  if (validNames.size === 0) {
    issues.push({
      check: "componentCatalog",
      message:
        "The real component catalog is empty or failed to load -- cannot validate any scene's " +
        "componentType against the real component library. This indicates a pipeline configuration " +
        "problem (video-engine/compositions/components/ not found), not a script authoring problem.",
    });
    return issues;
  }

  for (const scene of script.scenes) {
    if (!validNames.has(scene.componentType)) {
      issues.push({
        check: "componentCatalog",
        sceneId: scene.sceneId,
        message:
          `Scene "${scene.sceneId}" uses componentType "${scene.componentType}", which is not a real ` +
          `registered component. Valid componentType values are exactly (case-sensitive): ` +
          `${[...validNames].sort().join(", ")}. Choose one of these exactly for this scene.`,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// 6. Narrative-arc completeness
// ---------------------------------------------------------------------------

/**
 * Generic-throat-clearing openers a real hook should never use. Matched
 * against the START of the first scene's narration only (case-insensitive)
 * -- these are the "In this video we'll..." style intros the reference
 * transcripts researched for this redesign never use.
 */
const HOOK_THROAT_CLEARING_PATTERNS: RegExp[] = [
  /^\s*in this (video|tutorial|episode|short)/i,
  /^\s*today,?\s+we('re| are) going to/i,
  /^\s*today,?\s+we'll/i,
  /^\s*let'?s talk about/i,
  /^\s*welcome (back )?to/i,
  /^\s*so,?\s+today/i,
  /^\s*have you ever wondered/i,
  /\bwe will (discuss|cover|explore|look at)\b/i,
  /\bthis video (is about|will)\b/i,
];

/** Small stopword list for the recap-overlap heuristic below -- excludes
 * common function words so the overlap has to be a real content word. */
const STOPWORDS = new Set([
  "about", "above", "after", "again", "against", "these", "those", "their",
  "there", "which", "while", "would", "could", "should", "still", "every",
  "where", "because", "before", "being", "between", "other", "really",
  "actually", "almost", "always", "never", "something", "someone", "makes",
  "gives", "takes", "comes", "goes", "first", "second", "third",
]);

function significantWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w));
  return new Set(words);
}

/**
 * Flags scripts that don't actually cover the narrative arc the prompt asks
 * for (see promptBuilder.ts): too few (or, less commonly, too many) scenes
 * to plausibly cover hook/naive-approach/why-it-breaks/mechanism/
 * complication/refinement/recap, a first scene that reads like generic
 * throat-clearing instead of a real hook, or a last scene that shares no
 * real vocabulary with anything earlier (i.e. isn't actually a recap/
 * synthesis of the script it's supposedly closing out).
 *
 * The scene-count bounds are config-driven (config.minSceneCount /
 * config.maxSceneCount) and default to a permissive 1..100 so this stays a
 * no-op against short pre-existing test/demo scripts; the hook/recap text
 * heuristics are further gated behind config.requireArcHeuristics (also off
 * by default) since they're inherently fuzzier against real Gemini phrasing
 * variance -- a loose, occasionally-skipped check beats a strict one that
 * causes constant unnecessary retries. Real generation should use
 * NARRATIVE_ARC_VALIDATION_CONFIG (types.ts) to turn both on.
 */
export function checkNarrativeArc(script: Script, config: ValidationConfig): StructuralIssue[] {
  const issues: StructuralIssue[] = [];
  const sceneCount = script.scenes.length;

  if (sceneCount < config.minSceneCount) {
    issues.push({
      check: "narrativeArc",
      message:
        `Script has only ${sceneCount} scene(s); the narrative-arc target is at least ` +
        `${config.minSceneCount} scenes (hook, naive/obvious approach, why it breaks, the real ` +
        `mechanism, a complication or edge case, a refinement, and a recap). A ${sceneCount}-scene ` +
        `script cannot cover that arc with real depth -- add scenes, especially to develop the ` +
        `mechanism and its complication/refinement in more than one beat.`,
    });
  } else if (sceneCount > config.maxSceneCount) {
    issues.push({
      check: "narrativeArc",
      message:
        `Script has ${sceneCount} scenes, more than the narrative-arc target maximum of ` +
        `${config.maxSceneCount}. Tighten the script -- combine or cut scenes rather than padding ` +
        `the arc out further.`,
    });
  }

  if (!config.requireArcHeuristics || sceneCount === 0) {
    return issues;
  }

  const first = script.scenes[0]!;
  for (const pattern of HOOK_THROAT_CLEARING_PATTERNS) {
    if (pattern.test(first.narration)) {
      issues.push({
        check: "narrativeArc",
        sceneId: first.sceneId,
        message:
          `Scene "${first.sceneId}" (the hook) opens with generic throat-clearing: ` +
          `"${first.narration.slice(0, 80)}${first.narration.length > 80 ? "..." : ""}". ` +
          `State the problem or question directly instead of announcing the video.`,
      });
      break;
    }
  }

  if (sceneCount > 1) {
    const last = script.scenes[sceneCount - 1]!;
    const earlierWords = new Set<string>();
    for (const scene of script.scenes.slice(0, -1)) {
      for (const w of significantWords(scene.narration)) earlierWords.add(w);
    }
    const lastWords = significantWords(last.narration);
    const sharesVocabulary = [...lastWords].some((w) => earlierWords.has(w));
    if (!sharesVocabulary) {
      issues.push({
        check: "narrativeArc",
        sceneId: last.sceneId,
        message:
          `Scene "${last.sceneId}" (the recap) shares no notable vocabulary with any earlier scene: ` +
          `"${last.narration.slice(0, 80)}${last.narration.length > 80 ? "..." : ""}". A recap should ` +
          `tie the arc together (ideally with a concrete metaphor) rather than introduce disconnected ` +
          `new material.`,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export function runStructuralChecks(
  script: Script,
  history: ComponentHistory,
  config: ValidationConfig,
  catalog: ComponentInfo[] = loadComponentCatalog()
): StructuralIssue[] {
  return [
    ...checkPacing(script, config),
    ...checkAnchors(script, catalog),
    ...checkVariety(script, history, config),
    ...checkPlaceholders(script),
    ...checkComponentCatalog(script, catalog),
    ...checkNarrativeArc(script, config),
  ];
}

export function formatIssuesForRepairPrompt(issues: StructuralIssue[]): string {
  return issues.map((issue, i) => `${i + 1}. [${issue.check}]${issue.sceneId ? ` (${issue.sceneId})` : ""} ${issue.message}`).join("\n");
}
