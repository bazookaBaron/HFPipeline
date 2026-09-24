import { z } from "zod";
import type { Script } from "./types.js";

/**
 * "Wire" shape: what we actually ask Gemini's structured-output
 * (`responseSchema`) to produce.
 *
 * Gemini's structured-output schema is a constrained OpenAPI-ish subset: it
 * has no first-class support for an open string-keyed map like
 * `Record<string, unknown>` (every OBJECT node needs enumerated
 * `properties`). Since `props` is intentionally free-form/component-specific
 * (owned by whatever Phase 2 component the scene instantiates), we encode it
 * on the wire as an array of `{ key, value }` pairs with a *string* value,
 * and decode it back into `Record<string, unknown>` immediately after
 * parsing (see `toInternalScript` below), before anything else touches it.
 * Numbers/booleans/JSON objects authored by Gemini into `value` are
 * JSON.parse'd back into real types on decode; anything that isn't valid
 * JSON is kept as a plain string.
 *
 * This is purely a wire-format concern. `validation.ts`, `history.ts`, and
 * every downstream consumer operate on the internal `Script`/`Scene` shape
 * from types.ts, never on this wire shape.
 */

export const WirePropEntrySchema = z.object({
  key: z.string(),
  value: z.string(),
});

export const WireNarrationAnchorSchema = z.object({
  anchorText: z.string(),
  propPath: z.string(),
});

export const WireSceneSchema = z.object({
  sceneId: z.string(),
  componentType: z.string(),
  durationSeconds: z.number(),
  narration: z.string(),
  sceneHeadline: z.string(),
  sceneSubtitle: z.string(),
  props: z.array(WirePropEntrySchema),
  narrationAnchors: z.array(WireNarrationAnchorSchema),
});

export const WireScriptSchema = z.object({
  topic: z.string(),
  topicCategory: z.string(),
  scenes: z.array(WireSceneSchema),
});

export type WireScript = z.infer<typeof WireScriptSchema>;

/**
 * Hand-authored Gemini `responseSchema` (Google's structured-output JSON
 * schema subset: uppercase-free "type" strings "object"/"array"/"string"/
 * "number", explicit `properties`/`required`/`items`, no `$ref`, no unions).
 *
 * Kept in a 1:1, manually-verified correspondence with WireScriptSchema
 * above. If you add/remove/rename a field in WireScriptSchema, update this
 * object to match -- there is a structural-shape test in
 * test/wireSchema.test.ts that will fail loudly if the two drift apart in
 * field names.
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    topic: { type: "string", description: "The video topic, restated verbatim." },
    topicCategory: {
      type: "string",
      description:
        "Coarse topical bucket for this script, e.g. 'cs-fundamentals', 'web-security', 'devtools'. Used for variety tracking across runs.",
    },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sceneId: { type: "string", description: "Stable id, e.g. 'scene-1'." },
          componentType: {
            type: "string",
            description:
              "Name of the visual component to instantiate for this scene (e.g. browserWindow, kpiCluster). Exact catalog TBD -- choose the closest descriptive name.",
          },
          durationSeconds: {
            type: "number",
            description: "How long this scene runs, in seconds.",
          },
          narration: {
            type: "string",
            description: "The exact words spoken during this scene. Must be specific to the topic, never boilerplate.",
          },
          sceneHeadline: {
            type: "string",
            description:
              "A short (3-6 word) on-screen headline summarizing this scene's beat, e.g. 'Why the naive fix breaks'. Written independently of componentType/props -- used as persistent chrome above the scene in some render themes.",
          },
          sceneSubtitle: {
            type: "string",
            description:
              "An optional one-line subtitle under sceneHeadline, e.g. 'A single dropped column, a live outage.' Can be a short empty-ish clause but never literally empty.",
          },
          props: {
            type: "array",
            description:
              "Component-specific authored content as key/value pairs. Values must be JSON-encodable as plain strings (numbers/booleans as their literal text, nested objects as a JSON string).",
            items: {
              type: "object",
              properties: {
                key: { type: "string" },
                value: { type: "string" },
              },
              required: ["key", "value"],
            },
          },
          narrationAnchors: {
            type: "array",
            description:
              "Points in the narration where a visual reveal should be timed. `anchorText` MUST be an exact, verbatim, case-sensitive substring copy-pasted from this scene's `narration` field -- never a paraphrase.",
            items: {
              type: "object",
              properties: {
                anchorText: {
                  type: "string",
                  description: "A verbatim substring of this scene's narration.",
                },
                propPath: {
                  type: "string",
                  description: "Which prop this anchor times, formatted as 'props.<key>'.",
                },
              },
              required: ["anchorText", "propPath"],
            },
          },
        },
        required: [
          "sceneId",
          "componentType",
          "durationSeconds",
          "narration",
          "sceneHeadline",
          "sceneSubtitle",
          "props",
          "narrationAnchors",
        ],
      },
    },
  },
  required: ["topic", "topicCategory", "scenes"],
} as const;

/** Best-effort decode of a wire prop value back into a real JS value. */
function decodePropValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Convert the Gemini wire shape into the internal Script shape used everywhere else. */
export function toInternalScript(wire: WireScript): Script {
  return {
    topic: wire.topic,
    topicCategory: wire.topicCategory,
    scenes: wire.scenes.map((scene) => ({
      sceneId: scene.sceneId,
      componentType: scene.componentType,
      durationSeconds: scene.durationSeconds,
      narration: scene.narration,
      sceneHeadline: scene.sceneHeadline,
      sceneSubtitle: scene.sceneSubtitle,
      props: Object.fromEntries(scene.props.map((p) => [p.key, decodePropValue(p.value)])),
      narrationAnchors: scene.narrationAnchors.map((a) => ({
        anchorText: a.anchorText,
        propPath: a.propPath,
      })),
    })),
  };
}
