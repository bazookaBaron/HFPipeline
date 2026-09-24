"use strict";

/**
 * Carousel content schema — Piece 1.
 *
 * carousel-engine/templates/*.js define 10 real slide kinds, each with its own exact content
 * shape (verified by reading every template file directly, not guessed):
 *
 *   cover      { kicker?, title, subtitle? }
 *   content    { eyebrow?, heading, body: string[] }        (bullets — see note below)
 *   diagram    { heading, steps: [{ label, detail? }] }
 *   screenshot { heading, caption?, codeLines: string[] }   (code-mock path; no imagePath — Gemini can't source real screenshots)
 *   cta        { heading, subtext?, buttonText, handle? }
 *   compare    { heading, columns: [{ title, points: string[] }] }
 *   hub        { heading, hubLabel, spokes: [{ label, detail? }] }
 *   ranked     { heading, items: [{ title, detail? }] }
 *   stat       { eyebrow?, statValue, statLabel, context? }
 *   dsSnapshot { heading, structureType?, cells: [{ value, highlighted? }], pointers?: [{ index, label }], caption? }
 *
 * Note on `content.body`: the template also accepts a plain string (rendered as one paragraph),
 * but we only ever ask Gemini for the bullet-list array form — punchier and easier to
 * length-bound per item than one long paragraph.
 *
 * Because Gemini's `responseSchema` (Google's structured-output JSON-schema subset) has no
 * first-class polymorphic union support we want to rely on, every slide is authored on the wire
 * as ONE flattened object carrying `kind` plus the superset of every kind's possible fields
 * (all optional at the schema level). `validate.js` then enforces, per `kind`, which of those
 * fields are actually required/non-empty/well-formed, and `mapSlideContent` below strips
 * everything irrelevant to the chosen kind before building the final `{ kind, content }` pair
 * render.js expects. This mirrors the same "wire shape vs. internal shape" split
 * scripting-pipeline/src/wireSchema.ts already uses for its own free-form props.
 */

const KNOWN_KINDS = [
  "cover",
  "content",
  "diagram",
  "screenshot",
  "cta",
  "compare",
  "hub",
  "ranked",
  "stat",
  "dsSnapshot",
];

const MIN_SLIDES = 6;
const MAX_SLIDES = 10;

/**
 * Rough per-field length ceilings, informed by each template's real fit-box pixel budget
 * (`data-fit-max` font size x `data-fit-lines` x the ~928px content width at 1080x1350).
 * text-fit.js's shrink-and-truncate fallback means overflow can never break rendering, but a
 * ceiling here keeps authored copy punchy instead of relying on that fallback to bail us out.
 * Both a word count and a character count are enforced (character count matters more for dense
 * technical text like code lines or stat values; word count matters more for prose).
 */
const FIELD_LIMITS = {
  kicker: { words: 6, chars: 40 },
  title: { words: 14, chars: 90 },
  subtitle: { words: 24, chars: 150 },
  eyebrow: { words: 6, chars: 40 },
  heading: { words: 12, chars: 80 },
  bodyItem: { words: 24, chars: 150 },
  stepLabel: { words: 8, chars: 45 },
  stepDetail: { words: 12, chars: 70 },
  codeLine: { words: 14, chars: 64 },
  caption: { words: 22, chars: 140 },
  subtext: { words: 22, chars: 140 },
  buttonText: { words: 5, chars: 28 },
  handle: { words: 4, chars: 30 },
  columnTitle: { words: 6, chars: 40 },
  point: { words: 14, chars: 90 },
  hubLabel: { words: 6, chars: 40 },
  spokeLabel: { words: 5, chars: 30 },
  spokeDetail: { words: 8, chars: 45 },
  itemTitle: { words: 8, chars: 55 },
  itemDetail: { words: 12, chars: 75 },
  statValue: { words: 3, chars: 14 },
  statLabel: { words: 10, chars: 65 },
  context: { words: 26, chars: 180 },
  structureType: { words: 6, chars: 40 },
  cellValue: { words: 3, chars: 12 },
  pointerLabel: { words: 2, chars: 12 },
};

/** Per-kind array-length bounds (min/max items), informed by each template's layout math
 * (e.g. hub spokes are laid out radially and get cramped past ~6; dsSnapshot cells are
 * 108px+gap wide against a 928px content area, so more than ~7 overlaps). */
const ARRAY_BOUNDS = {
  "content.body": { min: 2, max: 5 },
  "diagram.steps": { min: 3, max: 5 },
  "screenshot.codeLines": { min: 3, max: 7 },
  "compare.columns": { min: 2, max: 3 },
  "compare.columns[].points": { min: 2, max: 4 },
  "hub.spokes": { min: 3, max: 6 },
  "ranked.items": { min: 3, max: 6 },
  "dsSnapshot.cells": { min: 3, max: 8 },
};

/** Common generic-boilerplate / placeholder patterns to reject outright, regardless of kind.
 * Matched against the *trimmed* field value. Deliberately includes both "obviously templated"
 * forms ("Your headline here", "Lorem ipsum...") and lazy stand-ins an LLM might still emit
 * ("TBD", "Coming soon", "[Insert stat]"). */
const PLACEHOLDER_PATTERNS = [
  /^your .*here$/i,
  /^\[.*\]$/,
  /^\{.*\}$/,
  /^<.*>$/,
  /lorem ipsum/i,
  /placeholder/i,
  /^insert\b/i,
  /^add (a |your )?.*here$/i,
  /^(title|headline|heading|subtitle|text|description|caption|label|detail)s?\s*(goes\s*)?here$/i,
  /^sample\s*(text|title|heading|copy)?$/i,
  /^coming soon$/i,
  /^to\s*be\s*(determined|announced|decided)$/i,
  /^tbd$/i,
  /^tba$/i,
  /^n\/?a$/i,
  /^todo\b/i,
  /^x{3,}$/i,
  /^example\s*(text|title|heading|copy)?$/i,
  /^some\s+.*(text|copy|content)$/i,
  /^this\s+is\s+(a|the)\s+(title|heading|placeholder|example)/i,
];

/** Gemini structured-output responseSchema (Google's OpenAPI-3.0-ish subset — lowercase
 * `type`, explicit `properties`/`required`/`items`, no `$ref`/unions). Deliberately kept flat
 * per the note above: every possible field across all 10 kinds is declared optional here, and
 * per-kind requiredness is enforced by our own validator after parsing, not by this schema. */
const CAROUSEL_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    topic: { type: "string", description: "The carousel topic, restated verbatim." },
    slides: {
      type: "array",
      description: `Ordered carousel slides, ${MIN_SLIDES}-${MAX_SLIDES} total. First slide must have kind "cover", last must have kind "cta".`,
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: KNOWN_KINDS,
            description: "Which of the 10 real slide templates to render this slide with.",
          },
          kicker: { type: "string", description: "cover: short label above the title, e.g. a category." },
          title: { type: "string", description: "cover: the big headline." },
          subtitle: { type: "string", description: "cover: supporting line under the title." },
          eyebrow: { type: "string", description: "content/stat: small label above the heading." },
          heading: {
            type: "string",
            description: "content/diagram/screenshot/cta/compare/hub/ranked/dsSnapshot: the slide's main heading.",
          },
          body: {
            type: "array",
            items: { type: "string" },
            description: "content: 2-5 short bullet points (each a complete, specific sentence or fragment).",
          },
          steps: {
            type: "array",
            description: "diagram: 3-5 ordered steps.",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                detail: { type: "string" },
              },
              required: ["label"],
            },
          },
          caption: { type: "string", description: "screenshot/dsSnapshot: short caption under the frame." },
          codeLines: {
            type: "array",
            items: { type: "string" },
            description: "screenshot: 3-7 short lines of real code/terminal/HTTP output (monospace).",
          },
          subtext: { type: "string", description: "cta: supporting line under the CTA heading." },
          buttonText: { type: "string", description: "cta: short button label, e.g. 'Save this post'." },
          handle: { type: "string", description: "cta: the brand handle shown near the button." },
          columns: {
            type: "array",
            description: "compare: 2-3 columns.",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                points: { type: "array", items: { type: "string" } },
              },
              required: ["title", "points"],
            },
          },
          hubLabel: { type: "string", description: "hub: the short label inside the central hub circle." },
          spokes: {
            type: "array",
            description: "hub: 3-6 spokes radiating from the hub.",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                detail: { type: "string" },
              },
              required: ["label"],
            },
          },
          items: {
            type: "array",
            description: "ranked: 3-6 ranked items, in priority/rank order.",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                detail: { type: "string" },
              },
              required: ["title"],
            },
          },
          statValue: { type: "string", description: "stat: the big number/short value, e.g. '68%'." },
          statLabel: { type: "string", description: "stat: what the number means." },
          context: { type: "string", description: "stat: short supporting context for the stat." },
          structureType: { type: "string", description: "dsSnapshot: e.g. 'LRU Cache — capacity 4'." },
          cells: {
            type: "array",
            description: "dsSnapshot: 3-8 cells representing the data structure's state.",
            items: {
              type: "object",
              properties: {
                value: { type: "string" },
                highlighted: { type: "boolean" },
              },
              required: ["value"],
            },
          },
          pointers: {
            type: "array",
            description: "dsSnapshot: optional pointer callouts referencing a cell index.",
            items: {
              type: "object",
              properties: {
                index: { type: "number" },
                label: { type: "string" },
              },
              required: ["index", "label"],
            },
          },
        },
        required: ["kind"],
      },
    },
  },
  required: ["topic", "slides"],
};

module.exports = {
  KNOWN_KINDS,
  MIN_SLIDES,
  MAX_SLIDES,
  FIELD_LIMITS,
  ARRAY_BOUNDS,
  PLACEHOLDER_PATTERNS,
  CAROUSEL_RESPONSE_SCHEMA,
};
