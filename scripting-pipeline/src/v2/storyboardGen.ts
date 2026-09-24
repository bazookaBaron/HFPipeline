import type { GenerateFn } from "../geminiClient.js";
import type { ComponentInfo } from "../componentCatalog.js";
import { STYLE_PROFILES, validateStoryboard, type Storyboard, type StoryboardIssue } from "./storyboard.js";

/**
 * Gemini storyboard v2 generation: prompt + wire schema + reject-and-repair loop.
 *
 * The prompt rules are the reference grammar measured in analysis/pacing-audit-20260924
 * (SCRIPT_VISUAL_ATLAS.md, MOTION_GRAPHICS_ATLAS.md, the five visual logs). Each rule cites the
 * evidence it came from so a later reader can check it against the frames.
 */

/** Gemini structured output cannot express free-form objects: props/values travel as JSON strings. */
export const GEMINI_STORYBOARD_SCHEMA = {
  type: "object",
  properties: {
    topic: { type: "string" },
    styleProfile: {
      type: "object",
      properties: { id: { type: "string", enum: [...STYLE_PROFILES] }, reason: { type: "string" } },
      required: ["id", "reason"],
    },
    palette: {
      type: "array",
      items: {
        type: "object",
        properties: { entity: { type: "string" }, accent: { type: "string", enum: ["brand", "accent", "accent-2", "accent-3", "accent-4"] } },
        required: ["entity", "accent"],
      },
    },
    sentences: {
      type: "array",
      items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" } }, required: ["id", "text"] },
    },
    hosts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          component: { type: "string" },
          enter: { type: "string", enum: ["cut", "fade"] },
          fromSentence: { type: "string" },
          toSentence: { type: "string" },
          props: {
            type: "array",
            items: { type: "object", properties: { key: { type: "string" }, valueJson: { type: "string" } }, required: ["key", "valueJson"] },
          },
        },
        required: ["id", "component", "enter", "fromSentence", "toSentence", "props"],
      },
    },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          host: { type: "string" },
          sentence: { type: "string" },
          anchorText: { type: "string" },
          anchorOccurrence: { type: "integer" },
          op: { type: "string" },
          target: { type: "string", description: "Entity id; empty string for ops that take no target." },
          valueJson: { type: "string", description: "JSON-encoded value; empty string when the op takes no value." },
        },
        required: ["id", "host", "sentence", "anchorText", "anchorOccurrence", "op", "target", "valueJson"],
      },
    },
  },
  required: ["topic", "styleProfile", "palette", "sentences", "hosts", "events"],
} as const;

function parseJsonish(s: unknown): unknown {
  if (typeof s !== "string") return s;
  const t = s.trim();
  if (t === "") return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return t; // a bare string value, e.g. v2.1.0
  }
}

/** Wire -> internal storyboard. Host props that are arrays/objects are kept as JSON strings, which is what components expect. */
export function wireToStoryboard(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const w = raw as Record<string, any>;
  return {
    version: "storyboard.v2",
    topic: w.topic,
    styleProfile: w.styleProfile,
    palette: w.palette ?? [],
    sentences: w.sentences,
    hosts: (w.hosts ?? []).map((h: any) => ({
      id: h.id,
      component: h.component,
      enter: h.enter,
      fromSentence: h.fromSentence,
      toSentence: h.toSentence,
      props: Object.fromEntries(
        (h.props ?? []).map((p: any) => {
          const v = parseJsonish(p.valueJson);
          return [p.key, v !== null && typeof v === "object" ? JSON.stringify(v) : v];
        })
      ),
    })),
    events: (w.events ?? []).map((e: any) => ({
      id: e.id,
      host: e.host,
      sentence: e.sentence,
      anchor: { text: e.anchorText, occurrence: e.anchorOccurrence || 1 },
      op: e.op,
      target: e.target ? e.target : null,
      value: parseJsonish(e.valueJson),
    })),
  };
}

export interface StoryboardInput {
  topic: string;
  /** Target FINAL video length in seconds (after post speed). */
  targetSeconds: number;
  /** Measured delivered words per second of FINAL video (voice rate x post speed). */
  finalWordsPerSecond: number;
  audienceNote?: string;
}

function hostCatalog(catalog: ComponentInfo[]): string {
  return catalog
    .filter((c) => c.v2?.host)
    .map((c) => {
      const content = c.variables
        .filter((v) => !/(^|_)at$/.test(v.id) && !["duration", "events", "timeScale"].includes(v.id))
        .map((v) => `      - ${v.id} (${v.type}) default=${JSON.stringify(v.default)}`)
        .join("\n");
      const ops = Object.entries(c.v2!.operations)
        .map(([op, spec]) => `      - ${op}: targets=${JSON.stringify(spec.targets)}${spec.value ? ` value=${JSON.stringify(spec.value)}` : ""}`)
        .join("\n");
      const ents = c.v2!.entities;
      return (
        `  * ${c.name}: ${c.description}\n` +
        `    content props:\n${content}\n` +
        `    entities: static=${JSON.stringify(ents?.static ?? [])}${ents?.fromProps?.length ? ` + ids from props ${JSON.stringify(ents.fromProps)}` : ""}\n` +
        `    operations:\n${ops}`
      );
    })
    .join("\n");
}

export function buildStoryboardPrompt(input: StoryboardInput, catalog: ComponentInfo[]): string {
  const words = Math.round(input.targetSeconds * input.finalWordsPerSecond);
  return `You are the writer AND storyboard artist of a fast, dense vertical tech-explainer short (1080x1920).
Topic: ${input.topic}
${input.audienceNote ? `Audience: ${input.audienceNote}\n` : ""}
LENGTH: the final video is ${input.targetSeconds} seconds. Write ${Math.round(words * 0.93)}-${Math.round(words * 1.07)} spoken words in total
(measured delivery is ${input.finalWordsPerSecond.toFixed(2)} words/second of final video). This budget is binding.

OUTPUT: narration as ordered sentences; visual HOSTS that each span a contiguous run of sentences; and typed EVENTS that
mutate a host at a specific spoken word. There are no timestamps anywhere: every event is anchored to a word.

NARRATION RULES (measured on 5 reference reels, 315 sentences):
- Short spoken sentences: median 7-9 words, rarely over 15 (refs: medians 7/7/8/9/9 words). Second person ("you") is fine.
- Concrete over abstract: named systems, real-looking numbers, specific failure cases. Every sentence must say something new.
- Open with a concrete system or object and a changing state in the first sentence (every reference does this within 1-3 s).
  Never open with throat-clearing ("In this video", "Let's talk about").
- End on the consequence or the resolved state, spoken as the final claim; the last events should visibly deliver it.
- An analogy is allowed only if a host can show it; never narrate a picture that no event draws.

HOST RULES:
- A host is ONE persistent visual system, reused and mutated while the story stays on that system (R2 keeps one
  router + two environment cards for ~125 s; R4 reuses one diagram ~10x). Switch host only when the story moves to a
  different system or view. Do NOT make one host per sentence by default.
- Hosts must cover the sentences contiguously in order: host 1 starts at the first sentence, each next host starts right
  after the previous one's last sentence, the last host ends at the final sentence.
- Host props are CONTENT ONLY (labels, versions, ids, items, percentages). Never author any key ending in "_at".
  Use realistic concrete data (ids like i-0a3f8c21, versions like v2.1.0, real-looking ports and metrics), never
  placeholders, never lorem ipsum. Props must be consistent with what the narration says.
- enter: "cut" (one-frame swap, the default in R1/R3/R5) or "fade" (~150 ms, R4 style).

EVENT RULES (the reference grammar -- this is what makes the video feel fast):
- Target density: about one event per 2.5-3.5 spoken words overall, and at least one event in nearly every sentence
  (refs: 0.26-0.42 visual beats per word; 2.3-4.6 per sentence). Enumerations get one event PER ITEM, each anchored on
  that item's own word (R1 "computers, routers, cameras" = three pops).
- Anchor each event on the exact word that names the change: the thing shown is the thing said (refs: 46-78% of beats
  within 0.3 s of their word). anchorText must be copied verbatim from that sentence (punctuation may be included or
  not); anchorOccurrence is 1 unless the phrase repeats in that sentence.
- State changes are events: statuses flip, numbers move, versions change, wrong things get struck through, then
  corrected with an update. Prefer a real state change over a decorative highlight/pulse; use highlight/pulse to point
  at what is being named when nothing changes.
- Only use operations, targets and value shapes the host's component declares below. Targets must be real entity ids
  of THAT host, including ids that come from its props (e.g. an instance id you put in its instance list).
- valueJson is JSON: a string value is written with quotes ("\\"v2.1.0\\""), an object like {"right":10}, a number like 1.2.
  Use an empty string when the op takes no value; target is an empty string when the op takes no target.

STYLE PROFILE: pick one and say why in one sentence:
  persistent-system (R2: one system mutated through the story), cut-heavy-procedural (R3: numbered steps, new view per
  step), redrawn-diagram (R4: the same diagram redrawn per stage), chaptered-substates (R5: chapters with sub-state swaps).
PALETTE: give each recurring story entity one accent for the whole video (semantic identity, e.g. blue env = brand,
  attacker = accent-4). Do not assign colours to items that have fixed meaning (errors stay red, healthy stays green).

HOST-CAPABLE COMPONENTS (the only ones you may use):
${hostCatalog(catalog)}

Return JSON only, matching the response schema. Sentence ids s1..sN, host ids h1..hN, event ids e1..eN.`;
}

export function buildStoryboardRepairPrompt(input: StoryboardInput, catalog: ComponentInfo[], lastRaw: unknown, issues: StoryboardIssue[]): string {
  return (
    buildStoryboardPrompt(input, catalog) +
    `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED. Fix every issue below and return the complete corrected storyboard.\n` +
    issues.map((i) => `- [${i.check}] ${i.ref ?? ""}: ${i.message}`).join("\n") +
    `\n\nPrevious attempt:\n${JSON.stringify(lastRaw).slice(0, 30000)}`
  );
}

export interface StoryboardAttempt {
  attempt: number;
  issues: StoryboardIssue[];
  raw: unknown;
}

export class StoryboardGenerationError extends Error {
  constructor(message: string, public readonly attempts: StoryboardAttempt[]) {
    super(message);
    this.name = "StoryboardGenerationError";
  }
}

/** Word-budget check the validator can't do (it has no length target). */
export function checkBudget(sb: Storyboard, input: StoryboardInput): StoryboardIssue[] {
  const words = sb.sentences.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
  const target = input.targetSeconds * input.finalWordsPerSecond;
  if (words < target * 0.85 || words > target * 1.15) {
    return [{ check: "coverage", severity: "error", ref: "sentences", message: `narration has ${words} words; the length budget is ${Math.round(target)} (+/-15%)` }];
  }
  return [];
}

export async function generateStoryboard(
  input: StoryboardInput,
  generate: GenerateFn,
  catalog: ComponentInfo[],
  maxAttempts = 3
): Promise<{ storyboard: Storyboard; attempts: StoryboardAttempt[] }> {
  const attempts: StoryboardAttempt[] = [];
  let lastRaw: unknown;
  let lastIssues: StoryboardIssue[] = [];
  for (let a = 0; a < maxAttempts; a++) {
    const prompt = a === 0 ? buildStoryboardPrompt(input, catalog) : buildStoryboardRepairPrompt(input, catalog, lastRaw, lastIssues);
    const raw = await generate(prompt);
    lastRaw = raw;
    const { storyboard, issues } = validateStoryboard(wireToStoryboard(raw), catalog);
    const all = storyboard ? [...issues, ...checkBudget(storyboard, input)] : issues;
    attempts.push({ attempt: a, issues: all, raw });
    const errors = all.filter((i) => i.severity === "error");
    if (storyboard && errors.length === 0) return { storyboard, attempts };
    lastIssues = errors;
  }
  throw new StoryboardGenerationError(
    `storyboard rejected after ${maxAttempts} attempts:\n${lastIssues.map((i) => `- [${i.check}] ${i.ref ?? ""} ${i.message}`).join("\n")}`,
    attempts
  );
}
