import { z } from "zod";

/**
 * Storyboard v2 -- the contract that separates what v1 conflated in one "scene":
 *   - narration: an ordered list of sentences (the voice timeline; word ids are assigned from
 *     whitespace tokens and later bound to aligned audio),
 *   - hosts: persistent visual scaffolds, each spanning a contiguous run of sentences
 *     (R2 keeps one host ~125 s; R3 cuts to a new one almost every sentence -- both valid),
 *   - events: typed mutations of a host entity anchored to a specific spoken word.
 * See analysis/pacing-audit-20260924/{PREIMPLEMENTATION_DECISION,ARCHITECTURE_REVIEW}.md.
 */

export const STYLE_PROFILES = ["persistent-system", "cut-heavy-procedural", "redrawn-diagram", "chaptered-substates"] as const;

export const SentenceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const HostSchema = z.object({
  id: z.string().min(1),
  component: z.string().min(1),
  /** Content props only. Timing props are never authored here; events carry timing. */
  props: z.record(z.string(), z.unknown()),
  fromSentence: z.string(),
  toSentence: z.string(),
  /** How this host replaces the previous one: one-frame cut (R1/R3/R5) or ~150 ms fade (R4). */
  enter: z.enum(["cut", "fade"]).default("cut"),
});

export const AnchorSchema = z.object({
  /** Verbatim word or short phrase inside the event's sentence. */
  text: z.string().min(1),
  /** 1-based occurrence within that sentence when the phrase repeats. */
  occurrence: z.number().int().min(1).default(1),
});

export const EventSchema = z.object({
  id: z.string().min(1),
  host: z.string(),
  sentence: z.string(),
  anchor: AnchorSchema,
  op: z.string().min(1),
  target: z.string().nullable().optional(),
  value: z.unknown().optional(),
});

export const StoryboardSchema = z.object({
  version: z.literal("storyboard.v2"),
  topic: z.string().min(1),
  styleProfile: z.object({ id: z.enum(STYLE_PROFILES), reason: z.string().min(1) }),
  /** Semantic colour identity: one accent per story entity, held for the whole video. */
  palette: z.array(z.object({ entity: z.string(), accent: z.enum(["brand", "accent", "accent-2", "accent-3", "accent-4"]) })).default([]),
  sentences: z.array(SentenceSchema).min(1),
  hosts: z.array(HostSchema).min(1),
  events: z.array(EventSchema),
});

export type Storyboard = z.infer<typeof StoryboardSchema>;
export type StoryEvent = z.infer<typeof EventSchema>;

export interface V2Capabilities {
  host: boolean;
  entities?: { static?: string[]; fromProps?: { prop: string; key: string }[] };
  operations: Record<string, { targets: "*" | string[] | null; value?: unknown }>;
}

export interface CatalogEntryV2 {
  name: string;
  v2?: V2Capabilities;
  variables?: { id: string; default?: unknown }[];
}

/** Props as the component will actually resolve them: registry defaults under authored props. */
export function effectiveProps(cat: CatalogEntryV2 | undefined, props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const v of cat?.variables ?? []) if (v.default !== undefined) out[v.id] = v.default;
  return { ...out, ...props };
}

export interface StoryboardIssue {
  check: "schema" | "coverage" | "host" | "anchor" | "event" | "placeholder" | "density";
  severity: "error" | "warning";
  ref?: string;
  message: string;
}

/** Word tokens exactly as the voice timeline numbers them: whitespace split, in order. */
export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/**
 * Index (0-based, within the sentence's tokens) where the anchor phrase's `occurrence`-th
 * match starts, or -1. Matching is on normalized tokens so punctuation never breaks it, and
 * occurrence-aware so a repeated word can't silently bind to its first instance.
 */
export function findAnchorIndex(sentenceText: string, anchor: { text: string; occurrence?: number }): number {
  const toks = tokenize(sentenceText).map(normalizeWord);
  const needle = tokenize(anchor.text).map(normalizeWord).filter(Boolean);
  if (!needle.length) return -1;
  let seen = 0;
  for (let i = 0; i + needle.length <= toks.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (toks[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok && ++seen === (anchor.occurrence ?? 1)) return i;
  }
  return -1;
}

function parseListProp(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Entity ids a host instance really has, derived from its capability block + actual props. */
export function hostEntities(cap: V2Capabilities, props: Record<string, unknown>): { all: Set<string>; fromProps: Set<string> } {
  const all = new Set<string>(cap.entities?.static ?? []);
  const fromProps = new Set<string>();
  for (const fp of cap.entities?.fromProps ?? []) {
    for (const item of parseListProp(props[fp.prop])) {
      const id = item && typeof item === "object" ? (item as Record<string, unknown>)[fp.key] : undefined;
      if (typeof id === "string" && id) {
        all.add(id);
        fromProps.add(id);
      }
    }
  }
  return { all, fromProps };
}

const PLACEHOLDER = /\b(lorem|ipsum|placeholder|todo|tbd|xxx|sample text|example\.com\/foo)\b/i;

function checkValue(spec: unknown, value: unknown): string | null {
  if (!spec || typeof spec !== "object") return null;
  const s = spec as Record<string, unknown>;
  if (Array.isArray(s.enum)) return s.enum.includes(value) ? null : `value must be one of ${s.enum.join("|")}`;
  if (s.type === "string") {
    if (typeof value !== "string" || !value.trim()) return "value must be a non-empty string";
    if (typeof s.maxLength === "number" && value.length > s.maxLength) return `value longer than ${s.maxLength}`;
    return null;
  }
  if (s.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "value must be an object";
    const fields = (s.fields ?? {}) as Record<string, string>;
    const v = value as Record<string, unknown>;
    const known = Object.keys(fields);
    for (const k of Object.keys(v)) if (!known.includes(k)) return `unknown value field '${k}'`;
    for (const [k, kind] of Object.entries(fields)) {
      if (v[k] === undefined) continue;
      if (typeof v[k] !== "number" || !isFinite(v[k] as number)) return `value.${k} must be a number`;
      if (kind === "number0-100" && ((v[k] as number) < 0 || (v[k] as number) > 100)) return `value.${k} must be 0-100`;
    }
    if (!known.some((k) => v[k] !== undefined)) return "value object has no fields";
    return null;
  }
  return null;
}

/**
 * Structural + capability validation. Errors make the storyboard unusable (reject-and-repair);
 * warnings are reported for QA but do not block.
 */
export function validateStoryboard(raw: unknown, catalog: CatalogEntryV2[]): { storyboard?: Storyboard; issues: StoryboardIssue[] } {
  const issues: StoryboardIssue[] = [];
  const parsed = StoryboardSchema.safeParse(raw);
  if (!parsed.success) {
    for (const e of parsed.error.issues) issues.push({ check: "schema", severity: "error", ref: e.path.join("."), message: e.message });
    return { issues };
  }
  const sb = parsed.data;
  const err = (check: StoryboardIssue["check"], ref: string, message: string) => issues.push({ check, severity: "error", ref, message });
  const warn = (check: StoryboardIssue["check"], ref: string, message: string) => issues.push({ check, severity: "warning", ref, message });

  const sIndex = new Map<string, number>();
  sb.sentences.forEach((s, i) => {
    if (sIndex.has(s.id)) err("schema", s.id, "duplicate sentence id");
    sIndex.set(s.id, i);
    if (PLACEHOLDER.test(s.text)) err("placeholder", s.id, "sentence contains placeholder text");
  });

  // Hosts must tile the sentence list: contiguous, in order, no gaps, no overlaps.
  const byName = new Map(catalog.map((c) => [c.name, c]));
  const hostRange = new Map<string, [number, number]>();
  let expected = 0;
  sb.hosts.forEach((h) => {
    const cat = byName.get(h.component);
    if (!cat) return err("host", h.id, `unknown component '${h.component}'`);
    if (!cat.v2?.host) err("host", h.id, `component '${h.component}' does not support v2 host mode`);
    const a = sIndex.get(h.fromSentence);
    const b = sIndex.get(h.toSentence);
    if (a === undefined || b === undefined) return err("host", h.id, "fromSentence/toSentence not found");
    if (b < a) return err("host", h.id, "toSentence precedes fromSentence");
    if (a !== expected) err("coverage", h.id, `hosts must cover sentences contiguously; expected start at sentence #${expected + 1}, got #${a + 1}`);
    expected = b + 1;
    if (hostRange.has(h.id)) err("schema", h.id, "duplicate host id");
    hostRange.set(h.id, [a, b]);
    for (const [k, v] of Object.entries(h.props)) {
      if (/(^|_)at$/.test(k)) err("host", h.id, `timing prop '${k}' must not be authored; use events`);
      if (typeof v === "string" && PLACEHOLDER.test(v)) err("placeholder", h.id, `prop '${k}' contains placeholder text`);
    }
  });
  if (expected !== sb.sentences.length) err("coverage", "hosts", `hosts cover ${expected} of ${sb.sentences.length} sentences`);

  // Events: host/sentence membership, anchor present, op + target + value allowed by capabilities.
  const eventIds = new Set<string>();
  const eventsPerSentence = new Map<string, number>();
  for (const ev of sb.events) {
    if (eventIds.has(ev.id)) err("event", ev.id, "duplicate event id");
    eventIds.add(ev.id);
    const host = sb.hosts.find((h) => h.id === ev.host);
    const range = hostRange.get(ev.host);
    const si = sIndex.get(ev.sentence);
    if (!host || !range) {
      err("event", ev.id, `unknown host '${ev.host}'`);
      continue;
    }
    if (si === undefined) {
      err("event", ev.id, `unknown sentence '${ev.sentence}'`);
      continue;
    }
    if (si < range[0] || si > range[1]) err("event", ev.id, `sentence '${ev.sentence}' is outside host '${ev.host}'`);
    const sentence = sb.sentences[si]!;
    if (findAnchorIndex(sentence.text, ev.anchor) < 0) {
      err("anchor", ev.id, `anchor "${ev.anchor.text}" (occurrence ${ev.anchor.occurrence}) not found in sentence ${ev.sentence}`);
    }
    eventsPerSentence.set(ev.sentence, (eventsPerSentence.get(ev.sentence) ?? 0) + 1);

    const cap = byName.get(host.component)?.v2;
    if (!cap) continue;
    const opSpec = cap.operations[ev.op];
    if (!opSpec) {
      err("event", ev.id, `op '${ev.op}' not supported by ${host.component}`);
      continue;
    }
    const ents = hostEntities(cap, effectiveProps(byName.get(host.component), host.props));
    if (opSpec.targets === null) {
      if (ev.target) err("event", ev.id, `op '${ev.op}' takes no target`);
    } else if (!ev.target) {
      err("event", ev.id, `op '${ev.op}' needs a target`);
    } else if (opSpec.targets === "*") {
      if (!ents.all.has(ev.target)) err("event", ev.id, `target '${ev.target}' is not an entity of this ${host.component}`);
    } else {
      const ok = opSpec.targets.some((t) => (t === "@fromProps" ? ents.fromProps.has(ev.target!) : t === ev.target));
      if (!ok) err("event", ev.id, `target '${ev.target}' not allowed for op '${ev.op}'`);
    }
    const vErr = checkValue(opSpec.value, ev.value);
    if (vErr) err("event", ev.id, vErr);
  }

  // Density diagnostics (warnings): the references land an event on most sentences
  // (46-78% of beats word-anchored; 2.3-4.6 beats per sentence).
  const silent = sb.sentences.filter((s) => !eventsPerSentence.has(s.id)).map((s) => s.id);
  if (silent.length > sb.sentences.length * 0.25) {
    warn("density", "events", `${silent.length}/${sb.sentences.length} sentences have no visual event: ${silent.join(", ")}`);
  }
  return { storyboard: sb, issues };
}
