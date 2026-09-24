import { describe, it, expect } from "vitest";
import { WireScriptSchema, GEMINI_RESPONSE_SCHEMA, toInternalScript } from "../src/wireSchema.js";

describe("GEMINI_RESPONSE_SCHEMA shape", () => {
  it("declares the same top-level fields as WireScriptSchema", () => {
    const zodKeys = Object.keys(WireScriptSchema.shape).sort();
    const geminiKeys = Object.keys(GEMINI_RESPONSE_SCHEMA.properties).sort();
    expect(geminiKeys).toEqual(zodKeys);
    expect(GEMINI_RESPONSE_SCHEMA.required.slice().sort()).toEqual(zodKeys);
  });

  it("declares the same per-scene fields as WireSceneSchema", () => {
    const sceneShapeKeys = Object.keys(
      (WireScriptSchema.shape.scenes.element as unknown as { shape: Record<string, unknown> }).shape
    ).sort();
    const geminiSceneKeys = Object.keys(GEMINI_RESPONSE_SCHEMA.properties.scenes.items.properties).sort();
    expect(geminiSceneKeys).toEqual(sceneShapeKeys);
  });

  it("uses only Gemini-structured-output-compatible primitive type strings", () => {
    const allowed = new Set(["object", "array", "string", "number", "boolean", "integer"]);
    function walk(node: any): void {
      expect(allowed.has(node.type)).toBe(true);
      if (node.type === "object" && node.properties) {
        for (const child of Object.values(node.properties)) walk(child);
      }
      if (node.type === "array" && node.items) {
        walk(node.items);
      }
    }
    walk(GEMINI_RESPONSE_SCHEMA);
  });
});

describe("toInternalScript", () => {
  it("converts props key/value pairs into a Record and JSON-decodes non-string values", () => {
    const wire = WireScriptSchema.parse({
      topic: "t",
      topicCategory: "c",
      scenes: [
        {
          sceneId: "s1",
          componentType: "browserWindow",
          durationSeconds: 8,
          narration: "hello world",
          sceneHeadline: "Test headline",
          sceneSubtitle: "Test subtitle",
          props: [
            { key: "urlText", value: "https://example-real-site.dev" },
            { key: "count", value: "42" },
            { key: "isActive", value: "true" },
          ],
          narrationAnchors: [],
        },
      ],
    });

    const script = toInternalScript(wire);
    expect(script.scenes[0]!.props).toEqual({
      urlText: "https://example-real-site.dev",
      count: 42,
      isActive: true,
    });
  });

  it("keeps a value that is not valid JSON as a plain string", () => {
    const wire = WireScriptSchema.parse({
      topic: "t",
      topicCategory: "c",
      scenes: [
        {
          sceneId: "s1",
          componentType: "browserWindow",
          durationSeconds: 8,
          narration: "hello world",
          sceneHeadline: "Test headline",
          sceneSubtitle: "Test subtitle",
          props: [{ key: "label", value: "not-json-just-text" }],
          narrationAnchors: [],
        },
      ],
    });

    const script = toInternalScript(wire);
    expect(script.scenes[0]!.props.label).toBe("not-json-just-text");
  });
});
