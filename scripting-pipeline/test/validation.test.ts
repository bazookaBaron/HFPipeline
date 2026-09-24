import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkPacing,
  checkAnchors,
  checkVariety,
  checkPlaceholders,
  checkComponentCatalog,
  checkNarrativeArc,
  runStructuralChecks,
} from "../src/validation.js";
import { ComponentHistory } from "../src/history.js";
import { ScriptSchema, DEFAULT_VALIDATION_CONFIG, NARRATIVE_ARC_VALIDATION_CONFIG } from "../src/types.js";
import type { Script } from "../src/types.js";
import type { ComponentInfo } from "../src/componentCatalog.js";

function loadFixture(name: string): Script {
  const raw = JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf-8"));
  return ScriptSchema.parse(raw);
}

let tmpDir: string;
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "scripting-pipeline-test-"));
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function emptyHistory(): ComponentHistory {
  return new ComponentHistory(join(tmpDir, "history.json"));
}

// A small fake catalog for tests that shouldn't depend on the real
// video-engine directory layout -- exercises checkComponentCatalog and the
// checkAnchors timing-variable relaxation in isolation.
const FAKE_CATALOG: ComponentInfo[] = [
  {
    name: "browser-window",
    description: "A browser chrome card.",
    category: "software-mockups",
    variables: [
      { id: "url", type: "string", default: "https://example.com" },
      { id: "heading", type: "string", default: "Welcome" },
      { id: "type_at", type: "number", default: 0.3 },
      { id: "content_at", type: "number", default: 2.2 },
      { id: "duration", type: "number", default: 6 },
    ],
  },
  {
    name: "kpi-cluster",
    description: "A row of animated KPI cards.",
    category: "data-metrics",
    variables: [
      { id: "statLabel", type: "string", default: "Metric" },
      { id: "reveal_at", type: "number", default: 0.3 },
      { id: "duration", type: "number", default: 6 },
    ],
  },
  {
    name: "terminal-session",
    description: "A simulated terminal with a typed command and output.",
    category: "software-mockups",
    variables: [
      { id: "commandText", type: "string", default: "ls -la" },
      { id: "type_at", type: "number", default: 0.3 },
      { id: "duration", type: "number", default: 6 },
    ],
  },
];

describe("valid fixture", () => {
  it("passes every structural check with no history", () => {
    const script = loadFixture("valid.json");
    const issues = runStructuralChecks(script, emptyHistory(), DEFAULT_VALIDATION_CONFIG);
    expect(issues).toEqual([]);
  });
});

describe("checkPacing", () => {
  it("flags a scene whose narration is far too short for its allotted duration", () => {
    const script = loadFixture("pacingViolation.json");
    const issues = checkPacing(script, DEFAULT_VALIDATION_CONFIG);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.check).toBe("pacing");
    expect(issues[0]!.sceneId).toBe("scene-1");
    expect(issues[0]!.message).toMatch(/under-paced/i);
  });

  it("does not flag the valid fixture", () => {
    const script = loadFixture("valid.json");
    expect(checkPacing(script, DEFAULT_VALIDATION_CONFIG)).toEqual([]);
  });

  it("flags an over-long narration for a short scene", () => {
    const script: Script = {
      topic: "test",
      topicCategory: "cs-fundamentals",
      scenes: [
        {
          sceneId: "scene-1",
          componentType: "browser-window",
          durationSeconds: 3,
          narration:
            "This narration has way more words crammed into it than a mere three seconds of natural speech at a normal spoken pace could ever comfortably fit for a viewer to follow along with clearly.",
          sceneHeadline: "Test headline",
          sceneSubtitle: "Test subtitle",
          props: { urlText: "www.example-real-site.dev" },
          narrationAnchors: [],
        },
      ],
    };
    const issues = checkPacing(script, DEFAULT_VALIDATION_CONFIG);
    expect(issues.length).toBe(1);
    expect(issues[0]!.message).toMatch(/over-paced/i);
  });
});

describe("checkAnchors", () => {
  it("rejects an anchorText that is not a verbatim substring of the narration", () => {
    const script = loadFixture("nonLiteralAnchor.json");
    const issues = checkAnchors(script);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.check).toBe("anchor");
    expect(issues[0]!.message).toMatch(/not a verbatim substring/i);
  });

  it("does not flag the valid fixture", () => {
    const script = loadFixture("valid.json");
    expect(checkAnchors(script)).toEqual([]);
  });

  it("rejects a propPath that does not start with 'props.'", () => {
    const script: Script = {
      topic: "test",
      topicCategory: "cs-fundamentals",
      scenes: [
        {
          sceneId: "scene-1",
          componentType: "browser-window",
          durationSeconds: 8,
          narration: "The narrator says the word address right here in this sentence for anchoring purposes today.",
          sceneHeadline: "Test headline",
          sceneSubtitle: "Test subtitle",
          props: { urlText: "www.example-real-site.dev" },
          narrationAnchors: [{ anchorText: "address", propPath: "urlText" }],
        },
      ],
    };
    const issues = checkAnchors(script);
    expect(issues.some((i) => i.message.includes('must start'))).toBe(true);
  });

  it("rejects a propPath referencing a prop key that does not exist and isn't a real timing variable", () => {
    const script: Script = {
      topic: "test",
      topicCategory: "cs-fundamentals",
      scenes: [
        {
          sceneId: "scene-1",
          componentType: "browser-window",
          durationSeconds: 8,
          narration: "The narrator says the word address right here in this sentence for anchoring purposes today.",
          sceneHeadline: "Test headline",
          sceneSubtitle: "Test subtitle",
          props: { urlText: "www.example-real-site.dev" },
          narrationAnchors: [{ anchorText: "address", propPath: "props.doesNotExist_at" }],
        },
      ],
    };
    const issues = checkAnchors(script, FAKE_CATALOG);
    expect(issues.some((i) => i.message.includes("does not exist"))).toBe(true);
  });

  it("rejects a propPath naming a real content prop instead of a timing prop, even if that prop already exists", () => {
    // Real bug found via a real end-to-end render: Gemini picked "props.edges" (a
    // node-graph-diagram content prop that already existed with a real array value) as an
    // anchor target. The old check only looked at whether the key existed in props, so this
    // passed cleanly -- then generate-video.js's real prop merge overwrote that whole array
    // with a bare resolved-seconds number. A propPath must always end in "_at", regardless
    // of whether the key happens to already exist in props.
    const script: Script = {
      topic: "test",
      topicCategory: "cs-fundamentals",
      scenes: [
        {
          sceneId: "scene-1",
          componentType: "browser-window",
          durationSeconds: 8,
          narration: "The narrator says the word address right here in this sentence for anchoring purposes today.",
          sceneHeadline: "Test headline",
          sceneSubtitle: "Test subtitle",
          props: { urlText: "www.example-real-site.dev" },
          narrationAnchors: [{ anchorText: "address", propPath: "props.urlText" }],
        },
      ],
    };
    const issues = checkAnchors(script, FAKE_CATALOG);
    expect(issues.some((i) => i.message.includes("is not a timing prop"))).toBe(true);
  });

  it("does NOT reject a propPath naming a real '_at' timing variable that was intentionally omitted from props", () => {
    // Per promptBuilder.ts's contract, Gemini never authors "..._at" props
    // itself -- the orchestrator computes them later from real narration
    // timestamps. A narrationAnchor pointing at one of those variables is
    // therefore expected to reference a key that is NOT in scene.props.
    const script: Script = {
      topic: "test",
      topicCategory: "cs-fundamentals",
      scenes: [
        {
          sceneId: "scene-1",
          componentType: "browser-window",
          durationSeconds: 8,
          narration: "The narrator says the word address right here in this sentence for anchoring purposes today.",
          sceneHeadline: "Test headline",
          sceneSubtitle: "Test subtitle",
          props: { url: "www.example-real-site.dev" }, // note: no "type_at" key authored
          narrationAnchors: [{ anchorText: "address", propPath: "props.type_at" }],
        },
      ],
    };
    const issues = checkAnchors(script, FAKE_CATALOG);
    expect(issues).toEqual([]);
  });

  it("still rejects a propPath naming a fake '_at'-looking key that isn't a real variable of the component", () => {
    const script: Script = {
      topic: "test",
      topicCategory: "cs-fundamentals",
      scenes: [
        {
          sceneId: "scene-1",
          componentType: "browser-window",
          durationSeconds: 8,
          narration: "The narrator says the word address right here in this sentence for anchoring purposes today.",
          sceneHeadline: "Test headline",
          sceneSubtitle: "Test subtitle",
          props: { url: "www.example-real-site.dev" },
          narrationAnchors: [{ anchorText: "address", propPath: "props.madeUp_at" }],
        },
      ],
    };
    const issues = checkAnchors(script, FAKE_CATALOG);
    expect(issues.some((i) => i.message.includes("does not exist"))).toBe(true);
  });
});

describe("checkComponentCatalog", () => {
  it("rejects a componentType that is not a real registered component", () => {
    const script = loadFixture("componentCatalogViolation.json");
    const issues = checkComponentCatalog(script, FAKE_CATALOG);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.check).toBe("componentCatalog");
    expect(issues[0]!.message).toContain("fancyImaginaryWidget");
    expect(issues[0]!.message).toContain("browser-window");
  });

  it("accepts componentType values that are in the catalog", () => {
    const script = loadFixture("valid.json");
    expect(checkComponentCatalog(script, FAKE_CATALOG)).toEqual([]);
  });

  it("flags every scene, not just the first, when multiple use fake componentTypes", () => {
    const script: Script = {
      topic: "test",
      topicCategory: "cs-fundamentals",
      scenes: [
        {
          sceneId: "scene-1",
          componentType: "totallyFake1",
          durationSeconds: 8,
          narration: "This is a real sentence describing scene one with specific topic detail included.",
          sceneHeadline: "Test headline",
          sceneSubtitle: "Test subtitle",
          props: { a: "b" },
          narrationAnchors: [],
        },
        {
          sceneId: "scene-2",
          componentType: "kpi-cluster",
          durationSeconds: 8,
          narration: "This is a real sentence describing scene two with specific topic detail included.",
          sceneHeadline: "Test headline",
          sceneSubtitle: "Test subtitle",
          props: { statLabel: "42ms" },
          narrationAnchors: [],
        },
      ],
    };
    const issues = checkComponentCatalog(script, FAKE_CATALOG);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.sceneId).toBe("scene-1");
  });

  it("surfaces a clear error instead of silently passing when the catalog itself is empty", () => {
    const script = loadFixture("valid.json");
    const issues = checkComponentCatalog(script, []);
    expect(issues.length).toBe(1);
    expect(issues[0]!.check).toBe("componentCatalog");
    expect(issues[0]!.message).toMatch(/catalog is empty|failed to load/i);
  });

  it("validates against the REAL video-engine component catalog by default (integration check)", () => {
    // No catalog argument -- exercises the real loadComponentCatalog() default,
    // proving the wiring actually reaches the real 23-component directory,
    // not just a fake test double.
    const script = loadFixture("valid.json"); // uses browser-window / terminal-session / kpi-cluster, all real
    expect(checkComponentCatalog(script)).toEqual([]);

    const badScript = loadFixture("componentCatalogViolation.json");
    const issues = checkComponentCatalog(badScript);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.message).toContain("fancyImaginaryWidget");
  });
});

describe("checkVariety", () => {
  it("flags a componentType that dominates recent history for the same topicCategory", () => {
    const history = emptyHistory();
    const seed = JSON.parse(readFileSync(join(__dirname, "fixtures", "varietyHistorySeed.json"), "utf-8"));
    writeFileSync(join(tmpDir, "history.json"), JSON.stringify(seed));
    const seededHistory = new ComponentHistory(join(tmpDir, "history.json"));

    const script = loadFixture("varietyViolation.json");
    const issues = checkVariety(script, seededHistory, DEFAULT_VALIDATION_CONFIG);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.check).toBe("variety");
    expect(issues[0]!.message).toMatch(/browser-window/);

    void history; // unused placeholder to keep beforeEach symmetry readable
  });

  it("does not flag anything when there is no prior history", () => {
    const script = loadFixture("varietyViolation.json");
    const issues = checkVariety(script, emptyHistory(), DEFAULT_VALIDATION_CONFIG);
    expect(issues).toEqual([]);
  });

  it("flags a script where every scene uses the same componentType", () => {
    const script: Script = {
      topic: "test",
      topicCategory: "fresh-category-no-history",
      scenes: [1, 2, 3].map((n) => ({
        sceneId: `scene-${n}`,
        componentType: "browser-window",
        durationSeconds: 8,
        narration: "This is scene number " + n + " describing a real and specific detail about the topic at hand.",
        sceneHeadline: "Test headline",
        sceneSubtitle: "Test subtitle",
        props: { urlText: "www.example-real-site.dev" },
        narrationAnchors: [],
      })),
    };
    const issues = checkVariety(script, emptyHistory(), DEFAULT_VALIDATION_CONFIG);
    expect(issues.some((i) => i.message.includes("same componentType"))).toBe(true);
  });
});

describe("checkPlaceholders", () => {
  it("rejects Lorem-ipsum narration and a prop equal to the component name", () => {
    const script = loadFixture("placeholderViolation.json");
    const issues = checkPlaceholders(script);
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.some((i) => i.message.includes("Lorem ipsum"))).toBe(true);
    expect(issues.some((i) => i.message.includes("literally just the component"))).toBe(true);
  });

  it("does not flag the valid fixture", () => {
    const script = loadFixture("valid.json");
    expect(checkPlaceholders(script)).toEqual([]);
  });

  it("rejects an empty narration", () => {
    const script: Script = {
      topic: "test",
      topicCategory: "cs-fundamentals",
      scenes: [
        {
          sceneId: "scene-1",
          componentType: "browser-window",
          durationSeconds: 8,
          narration: "   ",
          sceneHeadline: "Test headline",
          sceneSubtitle: "Test subtitle",
          props: { urlText: "www.example-real-site.dev" },
          narrationAnchors: [],
        },
      ],
    };
    const issues = checkPlaceholders(script);
    expect(issues.some((i) => i.message.includes("empty narration"))).toBe(true);
  });

  it("rejects an empty props object", () => {
    const script: Script = {
      topic: "test",
      topicCategory: "cs-fundamentals",
      scenes: [
        {
          sceneId: "scene-1",
          componentType: "browser-window",
          durationSeconds: 8,
          narration: "This scene has real narration text but nobody bothered to author any props for it at all.",
          sceneHeadline: "Test headline",
          sceneSubtitle: "Test subtitle",
          props: {},
          narrationAnchors: [],
        },
      ],
    };
    const issues = checkPlaceholders(script);
    expect(issues.some((i) => i.message.includes("no authored props"))).toBe(true);
  });
});

describe("valid arc fixture", () => {
  it("passes every structural check, including checkNarrativeArc under the strict config, against the REAL catalog", () => {
    const script = loadFixture("validArc.json");
    const issues = runStructuralChecks(script, emptyHistory(), NARRATIVE_ARC_VALIDATION_CONFIG);
    expect(issues).toEqual([]);
  });
});

describe("checkNarrativeArc", () => {
  it("does not flag a short script under the default (permissive) config", () => {
    const script = loadFixture("valid.json"); // only 3 scenes
    expect(checkNarrativeArc(script, DEFAULT_VALIDATION_CONFIG)).toEqual([]);
  });

  it("rejects a script with fewer scenes than the configured minimum", () => {
    const script = loadFixture("valid.json"); // 3 scenes
    const issues = checkNarrativeArc(script, NARRATIVE_ARC_VALIDATION_CONFIG);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.check).toBe("narrativeArc");
    expect(issues[0]!.message).toMatch(/only 3 scene/i);
    expect(issues[0]!.message).toMatch(/at least 10 scenes/i);
  });

  it("rejects a script with more scenes than the configured maximum", () => {
    const base = loadFixture("validArc.json");
    const script: Script = {
      ...base,
      scenes: [...base.scenes, ...base.scenes.slice(0, 8).map((s, i) => ({ ...s, sceneId: `extra-${i}` }))],
    };
    const issues = checkNarrativeArc(script, NARRATIVE_ARC_VALIDATION_CONFIG);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.message).toMatch(/more than the narrative-arc target maximum of 16/i);
  });

  it("accepts a well-formed 10-scene arc script under the strict config", () => {
    const script = loadFixture("validArc.json");
    expect(checkNarrativeArc(script, NARRATIVE_ARC_VALIDATION_CONFIG)).toEqual([]);
  });

  it("does not run the hook/recap text heuristics when requireArcHeuristics is off, even with enough scenes", () => {
    const script = loadFixture("validArc.json");
    const badHook: Script = {
      ...script,
      scenes: [
        { ...script.scenes[0]!, narration: "In this video we will discuss database indexes." },
        ...script.scenes.slice(1),
      ],
    };
    const laxConfig = { ...NARRATIVE_ARC_VALIDATION_CONFIG, requireArcHeuristics: false };
    expect(checkNarrativeArc(badHook, laxConfig)).toEqual([]);
  });

  it("flags a first scene that reads like generic throat-clearing instead of a real hook", () => {
    const script = loadFixture("validArc.json");
    const badHook: Script = {
      ...script,
      scenes: [
        { ...script.scenes[0]!, narration: "In this video we will discuss why database indexes speed up lookups." },
        ...script.scenes.slice(1),
      ],
    };
    const issues = checkNarrativeArc(badHook, NARRATIVE_ARC_VALIDATION_CONFIG);
    expect(issues.some((i) => i.message.includes("generic throat-clearing"))).toBe(true);
  });

  it("flags a last scene that shares no vocabulary with any earlier scene (not a real recap)", () => {
    const script = loadFixture("validArc.json");
    const disconnectedRecap: Script = {
      ...script,
      scenes: [
        ...script.scenes.slice(0, -1),
        {
          ...script.scenes[script.scenes.length - 1]!,
          narration: "Octopuses can taste light using photoreceptors spread across their skin, completely unrelated to anything said earlier.",
        },
      ],
    };
    const issues = checkNarrativeArc(disconnectedRecap, NARRATIVE_ARC_VALIDATION_CONFIG);
    expect(issues.some((i) => i.message.includes("shares no notable vocabulary"))).toBe(true);
  });

  it("does not flag a short script's hook/recap when requireArcHeuristics is on but minSceneCount is relaxed", () => {
    // Isolates the text heuristics from the scene-count check: a short
    // (2-scene) script whose hook is a real hook and whose recap genuinely
    // calls back to the hook's vocabulary should pass both heuristics even
    // though it's nowhere near the 10-scene target.
    const script: Script = {
      topic: "test",
      topicCategory: "cs-fundamentals",
      scenes: [
        {
          sceneId: "scene-1",
          componentType: "browser-window",
          durationSeconds: 8,
          narration: "Why does a cold cache make your first page load feel so much slower than every load after it?",
          sceneHeadline: "Test headline",
          sceneSubtitle: "Test subtitle",
          props: { urlText: "www.example-real-site.dev" },
          narrationAnchors: [],
        },
        {
          sceneId: "scene-2",
          componentType: "kpi-cluster",
          durationSeconds: 8,
          narration: "So a cold cache costs you one slow load, and every request after that reuses the same cache for free.",
          sceneHeadline: "Test headline",
          sceneSubtitle: "Test subtitle",
          props: { statLabel: "cache reused" },
          narrationAnchors: [],
        },
      ],
    };
    const relaxedConfig = { ...NARRATIVE_ARC_VALIDATION_CONFIG, minSceneCount: 1 };
    expect(checkNarrativeArc(script, relaxedConfig)).toEqual([]);
  });
});
