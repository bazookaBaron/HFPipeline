"use strict";

/**
 * Structural + content validation for a raw Gemini carousel response — Piece 1's
 * "reject-and-repair" gate. Two layers:
 *
 *   1. `WireCarouselSchema` (zod) — cheap type/shape sanity check (right types, right nesting).
 *      Catches a genuinely malformed response before we waste effort on semantic checks.
 *   2. `validateSemantics()` (plain hand-written checks) — the actual "not just field exists"
 *      gate the brief asks for: per-kind required-field presence, placeholder-boilerplate
 *      rejection, per-field length ceilings, array-length bounds, and carousel-level structure
 *      (slide count, first-is-cover, last-is-cta, every kind recognized).
 *
 * Both layers return a flat list of human-readable error strings (never throw for a bad
 * response) so the caller can feed them straight back to Gemini as repair instructions.
 */

const { z } = require("zod");
const {
  KNOWN_KINDS,
  MIN_SLIDES,
  MAX_SLIDES,
  FIELD_LIMITS,
  ARRAY_BOUNDS,
  PLACEHOLDER_PATTERNS,
} = require("./schema");

const StepSchema = z.object({ label: z.string().optional(), detail: z.string().optional() });
const ColumnSchema = z.object({
  title: z.string().optional(),
  points: z.array(z.string()).optional(),
});
const ItemSchema = z.object({ title: z.string().optional(), detail: z.string().optional() });
const CellSchema = z.object({ value: z.union([z.string(), z.number()]).optional(), highlighted: z.boolean().optional() });
const PointerSchema = z.object({ index: z.number().optional(), label: z.string().optional() });

const WireSlideSchema = z.object({
  kind: z.string(),
  kicker: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  body: z.array(z.string()).optional(),
  steps: z.array(StepSchema).optional(),
  caption: z.string().optional(),
  codeLines: z.array(z.string()).optional(),
  subtext: z.string().optional(),
  buttonText: z.string().optional(),
  handle: z.string().optional(),
  columns: z.array(ColumnSchema).optional(),
  hubLabel: z.string().optional(),
  spokes: z.array(StepSchema).optional(),
  items: z.array(ItemSchema).optional(),
  statValue: z.union([z.string(), z.number()]).optional(),
  statLabel: z.string().optional(),
  context: z.string().optional(),
  structureType: z.string().optional(),
  cells: z.array(CellSchema).optional(),
  pointers: z.array(PointerSchema).optional(),
});

const WireCarouselSchema = z.object({
  topic: z.string().optional(),
  slides: z.array(WireSlideSchema),
});

function checkShape(raw) {
  const result = WireCarouselSchema.safeParse(raw);
  if (result.success) return { ok: true, errors: [] };
  const errors = result.error.issues.map((issue) => `shape: ${issue.path.join(".")}: ${issue.message}`);
  return { ok: false, errors };
}

function wordCount(s) {
  return String(s).trim().split(/\s+/).filter(Boolean).length;
}

function isPlaceholder(value) {
  const s = String(value == null ? "" : value).trim();
  if (!s) return false; // emptiness is checked separately as "missing"
  return PLACEHOLDER_PATTERNS.some((re) => re.test(s));
}

/** Checks a single scalar field against FIELD_LIMITS[limitKey], pushing any violation into
 * `errors` with a descriptive, slide-indexed message. Returns true if the field is
 * present/non-empty (regardless of whether it passed length/placeholder checks). */
function checkField(errors, slideIdx, kind, fieldPath, value, limitKey, { required } = {}) {
  const s = value == null ? "" : String(value).trim();
  const present = s.length > 0;
  if (!present) {
    if (required) errors.push(`slide[${slideIdx}] (${kind}): "${fieldPath}" is required but empty/missing`);
    return present;
  }
  if (isPlaceholder(s)) {
    errors.push(`slide[${slideIdx}] (${kind}): "${fieldPath}" looks like placeholder/boilerplate text: "${s}"`);
  }
  const limit = FIELD_LIMITS[limitKey];
  if (limit) {
    const words = wordCount(s);
    if (words > limit.words || s.length > limit.chars) {
      errors.push(
        `slide[${slideIdx}] (${kind}): "${fieldPath}" is too long (${words} words / ${s.length} chars; ceiling ~${limit.words} words / ${limit.chars} chars): "${s.slice(0, 60)}${s.length > 60 ? "…" : ""}"`
      );
    }
  }
  return present;
}

function checkArrayBounds(errors, slideIdx, kind, fieldPath, arr, boundsKey) {
  const bounds = ARRAY_BOUNDS[boundsKey];
  const n = Array.isArray(arr) ? arr.length : 0;
  if (!bounds) return n;
  if (n < bounds.min || n > bounds.max) {
    errors.push(
      `slide[${slideIdx}] (${kind}): "${fieldPath}" has ${n} item(s); expected between ${bounds.min} and ${bounds.max}`
    );
  }
  return n;
}

function validateSlideSemantics(errors, slide, idx) {
  const kind = slide.kind;
  if (!KNOWN_KINDS.includes(kind)) {
    errors.push(`slide[${idx}]: unknown kind "${kind}" — must be one of ${KNOWN_KINDS.join(", ")}`);
    return;
  }

  switch (kind) {
    case "cover": {
      checkField(errors, idx, kind, "title", slide.title, "title", { required: true });
      if (slide.kicker) checkField(errors, idx, kind, "kicker", slide.kicker, "kicker");
      if (slide.subtitle) checkField(errors, idx, kind, "subtitle", slide.subtitle, "subtitle");
      break;
    }
    case "content": {
      checkField(errors, idx, kind, "heading", slide.heading, "heading", { required: true });
      if (slide.eyebrow) checkField(errors, idx, kind, "eyebrow", slide.eyebrow, "eyebrow");
      const n = checkArrayBounds(errors, idx, kind, "body", slide.body, "content.body");
      (slide.body || []).forEach((b, i) => checkField(errors, idx, kind, `body[${i}]`, b, "bodyItem", { required: true }));
      if (n === 0) errors.push(`slide[${idx}] (${kind}): "body" is required (2-5 bullet strings)`);
      break;
    }
    case "diagram": {
      checkField(errors, idx, kind, "heading", slide.heading, "heading", { required: true });
      const n = checkArrayBounds(errors, idx, kind, "steps", slide.steps, "diagram.steps");
      (slide.steps || []).forEach((s, i) => {
        checkField(errors, idx, kind, `steps[${i}].label`, s.label, "stepLabel", { required: true });
        if (s.detail) checkField(errors, idx, kind, `steps[${i}].detail`, s.detail, "stepDetail");
      });
      if (n === 0) errors.push(`slide[${idx}] (${kind}): "steps" is required (3-5 items)`);
      break;
    }
    case "screenshot": {
      checkField(errors, idx, kind, "heading", slide.heading, "heading", { required: true });
      const n = checkArrayBounds(errors, idx, kind, "codeLines", slide.codeLines, "screenshot.codeLines");
      (slide.codeLines || []).forEach((l, i) => checkField(errors, idx, kind, `codeLines[${i}]`, l, "codeLine", { required: true }));
      if (n === 0) errors.push(`slide[${idx}] (${kind}): "codeLines" is required (3-7 lines)`);
      if (slide.caption) checkField(errors, idx, kind, "caption", slide.caption, "caption");
      break;
    }
    case "cta": {
      checkField(errors, idx, kind, "heading", slide.heading, "heading", { required: true });
      checkField(errors, idx, kind, "buttonText", slide.buttonText, "buttonText", { required: true });
      if (slide.subtext) checkField(errors, idx, kind, "subtext", slide.subtext, "subtext");
      if (slide.handle) checkField(errors, idx, kind, "handle", slide.handle, "handle");
      break;
    }
    case "compare": {
      checkField(errors, idx, kind, "heading", slide.heading, "heading", { required: true });
      const n = checkArrayBounds(errors, idx, kind, "columns", slide.columns, "compare.columns");
      (slide.columns || []).forEach((c, i) => {
        checkField(errors, idx, kind, `columns[${i}].title`, c.title, "columnTitle", { required: true });
        const pn = checkArrayBounds(errors, idx, kind, `columns[${i}].points`, c.points, "compare.columns[].points");
        (c.points || []).forEach((p, j) => checkField(errors, idx, kind, `columns[${i}].points[${j}]`, p, "point", { required: true }));
        if (pn === 0) errors.push(`slide[${idx}] (${kind}): "columns[${i}].points" is required (2-4 items)`);
      });
      if (n === 0) errors.push(`slide[${idx}] (${kind}): "columns" is required (2-3 items)`);
      break;
    }
    case "hub": {
      checkField(errors, idx, kind, "heading", slide.heading, "heading", { required: true });
      checkField(errors, idx, kind, "hubLabel", slide.hubLabel, "hubLabel", { required: true });
      const n = checkArrayBounds(errors, idx, kind, "spokes", slide.spokes, "hub.spokes");
      (slide.spokes || []).forEach((s, i) => {
        checkField(errors, idx, kind, `spokes[${i}].label`, s.label, "spokeLabel", { required: true });
        if (s.detail) checkField(errors, idx, kind, `spokes[${i}].detail`, s.detail, "spokeDetail");
      });
      if (n === 0) errors.push(`slide[${idx}] (${kind}): "spokes" is required (3-6 items)`);
      break;
    }
    case "ranked": {
      checkField(errors, idx, kind, "heading", slide.heading, "heading", { required: true });
      const n = checkArrayBounds(errors, idx, kind, "items", slide.items, "ranked.items");
      (slide.items || []).forEach((it, i) => {
        checkField(errors, idx, kind, `items[${i}].title`, it.title, "itemTitle", { required: true });
        if (it.detail) checkField(errors, idx, kind, `items[${i}].detail`, it.detail, "itemDetail");
      });
      if (n === 0) errors.push(`slide[${idx}] (${kind}): "items" is required (3-6 items)`);
      break;
    }
    case "stat": {
      checkField(errors, idx, kind, "statValue", slide.statValue, "statValue", { required: true });
      checkField(errors, idx, kind, "statLabel", slide.statLabel, "statLabel", { required: true });
      if (slide.eyebrow) checkField(errors, idx, kind, "eyebrow", slide.eyebrow, "eyebrow");
      if (slide.context) checkField(errors, idx, kind, "context", slide.context, "context");
      break;
    }
    case "dsSnapshot": {
      checkField(errors, idx, kind, "heading", slide.heading, "heading", { required: true });
      const n = checkArrayBounds(errors, idx, kind, "cells", slide.cells, "dsSnapshot.cells");
      (slide.cells || []).forEach((c, i) => checkField(errors, idx, kind, `cells[${i}].value`, c.value, "cellValue", { required: true }));
      if (n === 0) errors.push(`slide[${idx}] (${kind}): "cells" is required (3-8 items)`);
      if (slide.structureType) checkField(errors, idx, kind, "structureType", slide.structureType, "structureType");
      if (slide.caption) checkField(errors, idx, kind, "caption", slide.caption, "caption");
      (slide.pointers || []).forEach((p, i) => {
        if (p.label) checkField(errors, idx, kind, `pointers[${i}].label`, p.label, "pointerLabel");
      });
      break;
    }
    default:
      // unreachable — guarded above
      break;
  }
}

function validateSemantics(raw) {
  const errors = [];
  const slides = Array.isArray(raw.slides) ? raw.slides : [];

  if (slides.length < MIN_SLIDES || slides.length > MAX_SLIDES) {
    errors.push(`carousel has ${slides.length} slide(s); expected between ${MIN_SLIDES} and ${MAX_SLIDES}`);
  }
  if (slides.length > 0 && slides[0].kind !== "cover") {
    errors.push(`first slide must have kind "cover", got "${slides[0].kind}"`);
  }
  if (slides.length > 0 && slides[slides.length - 1].kind !== "cta") {
    errors.push(`last slide must have kind "cta", got "${slides[slides.length - 1].kind}"`);
  }

  slides.forEach((slide, idx) => validateSlideSemantics(errors, slide, idx));

  return { ok: errors.length === 0, errors };
}

/** Full validation pass: shape then semantics. If the shape check fails we skip semantics
 * (there's nothing reliable to check yet) and return the shape errors alone. */
function validateCarousel(raw) {
  const shape = checkShape(raw);
  if (!shape.ok) return shape;
  return validateSemantics(raw);
}

module.exports = { validateCarousel, validateSemantics, checkShape, isPlaceholder, WireCarouselSchema };
