import { describe, it, expect } from "vitest";
import { validateStoryboard, findAnchorIndex, type Storyboard } from "../src/v2/storyboard.js";
import { loadComponentCatalog } from "../src/componentCatalog.js";

const catalog = loadComponentCatalog();

function base(): Storyboard {
  return {
    version: "storyboard.v2",
    topic: "Blue-green deployment",
    styleProfile: { id: "persistent-system", reason: "one router + two environments carries the whole mechanism" },
    palette: [{ entity: "blue", accent: "brand" }, { entity: "green", accent: "accent" }],
    sentences: [
      { id: "s1", text: "Blue serves every user right now." },
      { id: "s2", text: "We deploy version two point one to green, and its three instances come up healthy." },
      { id: "s3", text: "Then the router shifts ten percent of traffic to green." },
    ],
    hosts: [
      {
        id: "h1",
        component: "deployment-dashboard",
        enter: "cut",
        fromSentence: "s1",
        toSentence: "s3",
        props: { leftVersion: "v2.0.4", rightVersion: "v2.0.4", leftTrafficPct: 100, rightTrafficPct: 0 },
      },
    ],
    events: [
      { id: "e1", host: "h1", sentence: "s1", anchor: { text: "Blue", occurrence: 1 }, op: "highlight", target: "left", value: 1 },
      { id: "e2", host: "h1", sentence: "s2", anchor: { text: "version two point one", occurrence: 1 }, op: "update", target: "right.version", value: "v2.1.0" },
      { id: "e3", host: "h1", sentence: "s2", anchor: { text: "healthy", occurrence: 1 }, op: "health", target: "i-9f13aa02", value: "healthy" },
      { id: "e4", host: "h1", sentence: "s3", anchor: { text: "ten percent", occurrence: 1 }, op: "traffic", target: null, value: { right: 10 } },
    ],
  };
}

const errors = (sb: unknown) => validateStoryboard(sb, catalog).issues.filter((i) => i.severity === "error");

describe("storyboard v2", () => {
  it("accepts a valid persistent-host chapter against the real registry", () => {
    expect(errors(base())).toEqual([]);
  });

  it("finds anchors occurrence-aware and punctuation-insensitive", () => {
    expect(findAnchorIndex("Green, then green again.", { text: "green", occurrence: 2 })).toBe(2);
    expect(findAnchorIndex("Green, then green again.", { text: "green", occurrence: 3 })).toBe(-1);
    expect(findAnchorIndex("It hits O(N).", { text: "O(N)" })).toBe(2);
  });

  it("rejects an anchor that is not in its sentence", () => {
    const sb = base();
    sb.events[0]!.anchor.text = "purple";
    expect(errors(sb).map((i) => i.check)).toContain("anchor");
  });

  it("rejects targets the host does not have, and ops/values it does not support", () => {
    const sb = base();
    sb.events[2]!.target = "i-doesnotexist";
    sb.events[1]!.op = "teleport";
    sb.events[3]!.value = { right: 140 };
    const msgs = errors(sb).map((i) => i.message).join(" | ");
    expect(msgs).toMatch(/i-doesnotexist/);
    expect(msgs).toMatch(/teleport/);
    expect(msgs).toMatch(/0-100/);
  });

  it("derives instance-row entities from the host's actual props", () => {
    const sb = base();
    sb.hosts[0]!.props.rightInstances = JSON.stringify([{ id: "i-aaa", healthy: false }, { id: "i-bbb", healthy: false }, { id: "i-ccc", healthy: false }]);
    expect(errors(sb).map((i) => i.message).join(" ")).toMatch(/i-9f13aa02/); // default id no longer exists
    sb.events[2]!.target = "i-bbb";
    expect(errors(sb)).toEqual([]);
  });

  it("requires hosts to tile the sentences and forbids authored timing props", () => {
    const sb = base();
    sb.hosts[0]!.toSentence = "s2";
    sb.hosts[0]!.props.reveal_at = 3;
    const checks = errors(sb).map((i) => i.check);
    expect(checks).toContain("coverage");
    expect(checks).toContain("host");
  });

  it("rejects placeholder content", () => {
    const sb = base();
    sb.sentences[0]!.text = "Lorem ipsum serves every user.";
    expect(errors(sb).map((i) => i.check)).toContain("placeholder");
  });
});
