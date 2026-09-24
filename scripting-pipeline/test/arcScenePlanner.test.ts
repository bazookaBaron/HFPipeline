import { describe, it, expect } from "vitest";
import { planArcScenes, buildArcBeats, MIN_ARC_SCENES, MAX_ARC_SCENES } from "../src/arcScenePlanner.js";

describe("arcScenePlanner", () => {
  it("exposes a 10-16 scene range matching the narrative-arc target", () => {
    expect(MIN_ARC_SCENES).toBe(10);
    expect(MAX_ARC_SCENES).toBe(16);
  });

  it("plans within [MIN_ARC_SCENES, MAX_ARC_SCENES] scenes for a range of requested lengths", () => {
    for (const seconds of [10, 45, 90, 120, 150, 300]) {
      const scenes = planArcScenes(seconds);
      expect(scenes.length).toBeGreaterThanOrEqual(MIN_ARC_SCENES);
      expect(scenes.length).toBeLessThanOrEqual(MAX_ARC_SCENES);
    }
  });

  it("defaults to a real arc (>=90s, >=10 scenes) even when called with a falsy/short length", () => {
    const scenes = planArcScenes(0);
    expect(scenes.length).toBeGreaterThanOrEqual(MIN_ARC_SCENES);
    const total = scenes.reduce((sum, s) => sum + s.targetDurationSeconds, 0);
    expect(total).toBeGreaterThanOrEqual(90);
  });

  it("produces sceneIds in order and every targetDurationSeconds within a natural speaking-pace band", () => {
    const scenes = planArcScenes(120);
    scenes.forEach((s, i) => {
      expect(s.sceneId).toBe(`scene-${i + 1}`);
      expect(s.targetDurationSeconds).toBeGreaterThanOrEqual(6);
      expect(s.targetDurationSeconds).toBeLessThanOrEqual(26);
    });
  });

  it("orders beats along the fixed arc: hook, naive, breaks, mechanism..., complication..., refinement..., recap", () => {
    const beats = buildArcBeats(12);
    expect(beats[0]).toMatch(/^Hook:/);
    expect(beats[1]).toMatch(/^Naive\/obvious approach:/);
    expect(beats[2]).toMatch(/^Why it breaks:/);
    expect(beats[beats.length - 1]).toMatch(/^Recap:/);
    // Somewhere in the middle, the real mechanism should get more than one
    // scene when there's room (12 scenes has slack beyond the 10-scene min).
    expect(beats.some((b) => /The real mechanism \(part 2 of/.test(b))).toBe(true);
  });

  it("gives every extra scene beyond the minimum to mechanism/complication/refinement, never hook/naive/breaks/recap", () => {
    const beatsAtMin = buildArcBeats(MIN_ARC_SCENES);
    const beatsAtMax = buildArcBeats(MAX_ARC_SCENES);
    // hook/naive/breaks/recap are always exactly 1 scene regardless of total count.
    expect(beatsAtMin.filter((b) => /^Hook:/.test(b))).toHaveLength(1);
    expect(beatsAtMax.filter((b) => /^Hook:/.test(b))).toHaveLength(1);
    expect(beatsAtMin.filter((b) => /^Recap:/.test(b))).toHaveLength(1);
    expect(beatsAtMax.filter((b) => /^Recap:/.test(b))).toHaveLength(1);
    // The max-scene plan must have strictly more scenes than the min-scene plan.
    expect(beatsAtMax.length).toBeGreaterThan(beatsAtMin.length);
  });

  it("clamps an out-of-range scene count request instead of throwing", () => {
    expect(buildArcBeats(1)).toHaveLength(MIN_ARC_SCENES);
    expect(buildArcBeats(100)).toHaveLength(MAX_ARC_SCENES);
  });
});
