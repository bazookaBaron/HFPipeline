import { describe, it, expect } from "vitest";
import { generateStoryboard, wireToStoryboard, buildStoryboardPrompt, StoryboardGenerationError } from "../src/v2/storyboardGen.js";
import { loadComponentCatalog } from "../src/componentCatalog.js";

const catalog = loadComponentCatalog();
const input = { topic: "Blue-green deployment", targetSeconds: 6, finalWordsPerSecond: 3.3 };

function wire(extraWords = "") {
  return {
    topic: "Blue-green deployment",
    styleProfile: { id: "persistent-system", reason: "one system throughout" },
    palette: [{ entity: "green", accent: "accent" }],
    sentences: [
      { id: "s1", text: "Blue serves every user right now." },
      { id: "s2", text: "We shift ten percent of traffic to green." + extraWords },
      { id: "s3", text: "One green instance starts throwing errors." },
    ],
    hosts: [
      { id: "h1", component: "deployment-dashboard", enter: "cut", fromSentence: "s1", toSentence: "s3",
        props: [{ key: "rightVersion", valueJson: "\"v2.1.0\"" }, { key: "leftTrafficPct", valueJson: "100" }] },
    ],
    events: [
      { id: "e1", host: "h1", sentence: "s1", anchorText: "Blue", anchorOccurrence: 1, op: "highlight", target: "left", valueJson: "1" },
      { id: "e2", host: "h1", sentence: "s2", anchorText: "ten percent", anchorOccurrence: 1, op: "traffic", target: "", valueJson: "{\"right\":10}" },
      { id: "e3", host: "h1", sentence: "s3", anchorText: "errors.", anchorOccurrence: 1, op: "health", target: "i-52dd881c", valueJson: "\"error\"" },
    ],
  };
}

describe("storyboard generation", () => {
  it("converts wire values (JSON strings) to typed values", () => {
    const sb: any = wireToStoryboard(wire());
    expect(sb.hosts[0].props.rightVersion).toBe("v2.1.0");
    expect(sb.hosts[0].props.leftTrafficPct).toBe(100);
    expect(sb.events[1].target).toBeNull();
    expect(sb.events[1].value).toEqual({ right: 10 });
    expect(sb.events[2].value).toBe("error");
  });

  it("lists only host-capable components with their declared operations", () => {
    const p = buildStoryboardPrompt(input, catalog);
    expect(p).toContain("deployment-dashboard");
    expect(p).toContain("health: targets=");
    expect(p).not.toContain("* kpi-cluster:"); // not host-capable yet
  });

  it("repairs: rejects a bad anchor, accepts the fixed attempt", async () => {
    const bad = wire();
    bad.events[0]!.anchorText = "Purple";
    const replies = [bad, wire()];
    const prompts: string[] = [];
    const { storyboard, attempts } = await generateStoryboard(input, async (p) => (prompts.push(p), replies.shift()), catalog);
    expect(attempts.length).toBe(2);
    expect(prompts[1]).toContain("PREVIOUS ATTEMPT WAS REJECTED");
    expect(prompts[1]).toContain("Purple");
    expect(storyboard.events.length).toBe(3);
  });

  it("enforces the word budget and gives up after the bounded attempts", async () => {
    const long = wire(" " + "and then more words keep coming ".repeat(6).trim());
    await expect(generateStoryboard(input, async () => long, catalog, 2)).rejects.toBeInstanceOf(StoryboardGenerationError);
  });
});
