import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateScript, ScriptGenerationError } from "../src/pipeline.js";
import { ComponentHistory } from "../src/history.js";
import { DEFAULT_VALIDATION_CONFIG, NARRATIVE_ARC_VALIDATION_CONFIG } from "../src/types.js";
import type { GenerationInput } from "../src/types.js";
import type { GenerateFn } from "../src/geminiClient.js";

const INPUT: GenerationInput = {
  topic: "How browser caching works",
  topicCategory: "cs-fundamentals",
  scenes: [{ sceneId: "scene-1", targetDurationSeconds: 8, beat: "Explain the mechanism." }],
};

// A wire-shape response Gemini's structured output would actually return
// (props as {key,value}[], see src/wireSchema.ts).
const GOOD_WIRE_RESPONSE = {
  topic: "How browser caching works",
  topicCategory: "cs-fundamentals",
  scenes: [
    {
      sceneId: "scene-1",
      componentType: "browser-window",
      durationSeconds: 8,
      narration:
        "Your browser keeps a local copy of files it has already downloaded so it can skip the network next time.",
      sceneHeadline: "Test headline",
      sceneSubtitle: "Test subtitle",
      props: [{ key: "urlText", value: "www.wikipedia.org" }],
      narrationAnchors: [{ anchorText: "local copy", propPath: "props.type_at" }],
    },
  ],
};

// Deliberately broken: narration is only 5 words for an 8s scene (pacing violation).
const PACING_BROKEN_WIRE_RESPONSE = {
  ...GOOD_WIRE_RESPONSE,
  scenes: [
    {
      ...GOOD_WIRE_RESPONSE.scenes[0],
      narration: "Browsers cache files locally sometimes.",
    },
  ],
};

// Deliberately broken: fails zod/responseSchema shape validation (missing required field).
const SCHEMA_BROKEN_RESPONSE = {
  topic: "How browser caching works",
  topicCategory: "cs-fundamentals",
  scenes: [
    {
      sceneId: "scene-1",
      // componentType missing entirely
      durationSeconds: 8,
      narration: "Your browser keeps a local copy of files it has already downloaded to skip the network.",
      sceneHeadline: "Test headline",
      sceneSubtitle: "Test subtitle",
      props: [],
      narrationAnchors: [],
    },
  ],
};

// A real narrative-arc-shaped wire response (10 scenes: hook, naive approach,
// why it breaks, 3 mechanism scenes, 2 complication scenes, a refinement,
// and a recap that calls back to earlier vocabulary) -- same content as
// test/fixtures/validArc.json, wire-encoded (props as {key,value}[]). Used
// to prove generateScript's reject-and-repair loop actually enforces the
// narrative-arc redesign end to end, not just via the standalone
// checkNarrativeArc unit tests in validation.test.ts.
const GOOD_ARC_WIRE_RESPONSE = {
  topic: "why database indexes speed up lookups",
  topicCategory: "cs-fundamentals",
  scenes: [
    {
      sceneId: "scene-1",
      componentType: "problem-solution-pair",
      durationSeconds: 8,
      narration:
        "A million-row table takes eight seconds to search one column. Why does adding a single index turn that into six milliseconds?",
      sceneHeadline: "Test headline",
      sceneSubtitle: "Test subtitle",
      props: [{ key: "statLabel", value: "full table scan" }],
      narrationAnchors: [{ anchorText: "single index", propPath: "props.problem_at" }],
    },
    {
      sceneId: "scene-2",
      componentType: "myth-fact-card",
      durationSeconds: 8,
      narration: "So the obvious fix is to just add more RAM and let the database cache the whole table in memory.",
      sceneHeadline: "Test headline",
      sceneSubtitle: "Test subtitle",
      props: [{ key: "mythLabel", value: "more RAM fixes it" }],
      narrationAnchors: [{ anchorText: "more RAM", propPath: "props.myth_at" }],
    },
    {
      sceneId: "scene-3",
      componentType: "failure-recovery",
      durationSeconds: 8,
      narration:
        "Even cached in memory, the engine still checks every single row against your filter, so the cost barely changes at all.",
      sceneHeadline: "Test headline",
      sceneSubtitle: "Test subtitle",
      props: [{ key: "statLabel", value: "rows scanned" }],
      narrationAnchors: [{ anchorText: "every single row", propPath: "props.fail_at" }],
    },
    {
      sceneId: "scene-4",
      componentType: "definition-card",
      durationSeconds: 10,
      narration:
        "A database index is a separate sorted structure, usually a B-tree, that stores column values alongside pointers back to their rows.",
      sceneHeadline: "Test headline",
      sceneSubtitle: "Test subtitle",
      props: [{ key: "termLabel", value: "B-tree index" }],
      narrationAnchors: [{ anchorText: "B-tree", propPath: "props.term_at" }],
    },
    {
      sceneId: "scene-5",
      componentType: "perspective-grid",
      durationSeconds: 10,
      narration:
        "Because the tree keeps every key in sorted order, the database can binary search it, cutting the million rows down to about twenty comparisons.",
      sceneHeadline: "Test headline",
      sceneSubtitle: "Test subtitle",
      props: [{ key: "statLabel", value: "comparisons needed" }],
      narrationAnchors: [{ anchorText: "binary search", propPath: "props.reveal_at" }],
    },
    {
      sceneId: "scene-6",
      componentType: "latency-waterfall",
      durationSeconds: 8,
      narration:
        "That is why the same lookup that scanned a million rows now touches only twenty nodes on its way down the tree.",
      sceneHeadline: "Test headline",
      sceneSubtitle: "Test subtitle",
      props: [{ key: "statLabel", value: "tree depth" }],
      narrationAnchors: [{ anchorText: "twenty nodes", propPath: "props.reveal_at" }],
    },
    {
      sceneId: "scene-7",
      componentType: "queue-backpressure",
      durationSeconds: 8,
      narration:
        "But what happens when a hundred thousand writes hit that table every minute? Each insert has to update the index too.",
      sceneHeadline: "Test headline",
      sceneSubtitle: "Test subtitle",
      props: [{ key: "statLabel", value: "writes per minute" }],
      narrationAnchors: [{ anchorText: "hundred thousand writes", propPath: "props.start_at" }],
    },
    {
      sceneId: "scene-8",
      componentType: "cost-breakdown",
      durationSeconds: 8,
      narration:
        "So every index you add speeds up reads but slows down every single write, because the tree has to stay balanced.",
      sceneHeadline: "Test headline",
      sceneSubtitle: "Test subtitle",
      props: [{ key: "statLabel", value: "write overhead" }],
      narrationAnchors: [{ anchorText: "slows down every single write", propPath: "props.reveal_at" }],
    },
    {
      sceneId: "scene-9",
      componentType: "load-balancer-cluster",
      durationSeconds: 10,
      narration:
        "That is why real databases let you choose a handful of indexes deliberately, trading a little write cost for a lot of read speed on the columns that matter most.",
      sceneHeadline: "Test headline",
      sceneSubtitle: "Test subtitle",
      props: [{ key: "statLabel", value: "indexes chosen deliberately" }],
      narrationAnchors: [{ anchorText: "a handful of indexes", propPath: "props.start_at" }],
    },
    {
      sceneId: "scene-10",
      componentType: "takeaway-banner",
      durationSeconds: 10,
      narration:
        "So an index is just a sorted shortcut: skip it and the database rereads every row; add the right one and that same lookup drops from seconds to milliseconds.",
      sceneHeadline: "Test headline",
      sceneSubtitle: "Test subtitle",
      props: [{ key: "statLabel", value: "lookup time before vs after" }],
      narrationAnchors: [{ anchorText: "sorted shortcut", propPath: "props.reveal_at" }],
    },
  ],
};

let tmpDir: string;
let history: ComponentHistory;
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "scripting-pipeline-pipeline-test-"));
  history = new ComponentHistory(join(tmpDir, "history.json"));
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("generateScript reject-and-repair loop", () => {
  it("accepts a good response on the first attempt without retrying", async () => {
    let calls = 0;
    const generate: GenerateFn = async () => {
      calls++;
      return GOOD_WIRE_RESPONSE;
    };

    const { script, attempts } = await generateScript(INPUT, generate, history, DEFAULT_VALIDATION_CONFIG);

    expect(calls).toBe(1);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.schemaValid).toBe(true);
    expect(attempts[0]!.issues).toEqual([]);
    expect(script.scenes[0]!.componentType).toBe("browser-window");
  });

  it("retries with the specific failure reason after a pacing violation, then succeeds", async () => {
    let calls = 0;
    const prompts: string[] = [];
    const generate: GenerateFn = async (prompt) => {
      calls++;
      prompts.push(prompt);
      return calls === 1 ? PACING_BROKEN_WIRE_RESPONSE : GOOD_WIRE_RESPONSE;
    };

    const { script, attempts } = await generateScript(INPUT, generate, history, DEFAULT_VALIDATION_CONFIG);

    expect(calls).toBe(2);
    expect(attempts).toHaveLength(2);
    expect(attempts[0]!.schemaValid).toBe(true); // shape was fine, structural pacing check failed
    expect(attempts[0]!.issues.some((i) => i.check === "pacing")).toBe(true);
    expect(attempts[1]!.issues).toEqual([]);
    expect(script.scenes[0]!.narration).toBeTruthy();

    // The repair prompt sent on the second call must reference the SPECIFIC failure reason,
    // not just a generic "try again".
    expect(prompts[1]).toMatch(/under-paced/i);
    expect(prompts[1]).toContain("Browsers cache files locally sometimes.");
  });

  it("retries after a schema-shape failure (missing required field), then succeeds", async () => {
    let calls = 0;
    const prompts: string[] = [];
    const generate: GenerateFn = async (prompt) => {
      calls++;
      prompts.push(prompt);
      return calls === 1 ? SCHEMA_BROKEN_RESPONSE : GOOD_WIRE_RESPONSE;
    };

    const { attempts } = await generateScript(INPUT, generate, history, DEFAULT_VALIDATION_CONFIG);

    expect(calls).toBe(2);
    expect(attempts[0]!.schemaValid).toBe(false);
    expect(attempts[0]!.issues[0]!.check).toBe("schema");
    expect(prompts[1]).toMatch(/componentType/i);
  });

  it("gives up after exhausting retries and reports every attempt's issues", async () => {
    const generate: GenerateFn = async () => PACING_BROKEN_WIRE_RESPONSE;

    await expect(generateScript(INPUT, generate, history, DEFAULT_VALIDATION_CONFIG)).rejects.toThrow(
      ScriptGenerationError
    );

    try {
      await generateScript(INPUT, generate, history, DEFAULT_VALIDATION_CONFIG);
      expect.fail("expected generateScript to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ScriptGenerationError);
      const scriptErr = err as ScriptGenerationError;
      expect(scriptErr.attempts).toHaveLength(DEFAULT_VALIDATION_CONFIG.maxRetries + 1);
      expect(scriptErr.message).toMatch(/pacing/i);
    }
  });

  it("records accepted componentType choices to history so a later variety check can see them", async () => {
    const generate: GenerateFn = async () => GOOD_WIRE_RESPONSE;
    await generateScript(INPUT, generate, history, DEFAULT_VALIDATION_CONFIG);

    const recent = history.getRecent("cs-fundamentals", 10);
    expect(recent).toContain("browser-window");
  });
});

describe("generateScript reject-and-repair loop with NARRATIVE_ARC_VALIDATION_CONFIG", () => {
  it("rejects a too-shallow (1-scene) script for narrative-arc scene count, then accepts a real 10-scene arc script", async () => {
    let calls = 0;
    const prompts: string[] = [];
    const generate: GenerateFn = async (prompt) => {
      calls++;
      prompts.push(prompt);
      return calls === 1 ? GOOD_WIRE_RESPONSE : GOOD_ARC_WIRE_RESPONSE;
    };

    const { script, attempts } = await generateScript(INPUT, generate, history, NARRATIVE_ARC_VALIDATION_CONFIG);

    expect(calls).toBe(2);
    expect(attempts).toHaveLength(2);
    // Attempt 0: schema-valid (it's a perfectly good 1-scene script), but
    // rejected on narrative-arc grounds for being too shallow.
    expect(attempts[0]!.schemaValid).toBe(true);
    expect(attempts[0]!.issues.some((i) => i.check === "narrativeArc")).toBe(true);
    expect(attempts[1]!.issues).toEqual([]);
    expect(script.scenes).toHaveLength(10);
    expect(script.scenes[0]!.componentType).toBe("problem-solution-pair");
    expect(script.scenes[9]!.componentType).toBe("takeaway-banner");

    // The repair prompt must reference the SPECIFIC narrative-arc failure reason.
    expect(prompts[1]).toMatch(/only 1 scene/i);
    expect(prompts[1]).toMatch(/at least 10 scenes/i);
  });
});
