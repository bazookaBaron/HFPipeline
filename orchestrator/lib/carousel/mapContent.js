"use strict";

/**
 * Maps a validated, flattened wire slide (schema.js's CAROUSEL_RESPONSE_SCHEMA shape) down to
 * the exact `{ kind, content }` pair carousel-engine/render.js and templates/*.js expect —
 * stripping every field that doesn't belong to the chosen kind. This is the inverse of the
 * "flatten everything into one optional-fields object" trick we use to keep Gemini's
 * responseSchema union-free.
 */
function mapSlideContent(slide, { defaultHandle } = {}) {
  const kind = slide.kind;
  switch (kind) {
    case "cover":
      return {
        kind,
        content: strip({
          kicker: slide.kicker,
          title: slide.title,
          subtitle: slide.subtitle,
        }),
      };
    case "content":
      return {
        kind,
        content: strip({
          eyebrow: slide.eyebrow,
          heading: slide.heading,
          body: slide.body,
        }),
      };
    case "diagram":
      return {
        kind,
        content: strip({
          heading: slide.heading,
          steps: (slide.steps || []).map((s) => strip({ label: s.label, detail: s.detail })),
        }),
      };
    case "screenshot":
      return {
        kind,
        content: strip({
          heading: slide.heading,
          caption: slide.caption,
          codeLines: slide.codeLines,
        }),
      };
    case "cta":
      return {
        kind,
        content: strip({
          heading: slide.heading,
          subtext: slide.subtext,
          buttonText: slide.buttonText,
          handle: slide.handle || defaultHandle,
        }),
      };
    case "compare":
      return {
        kind,
        content: strip({
          heading: slide.heading,
          columns: (slide.columns || []).map((c) => strip({ title: c.title, points: c.points })),
        }),
      };
    case "hub":
      return {
        kind,
        content: strip({
          heading: slide.heading,
          hubLabel: slide.hubLabel,
          spokes: (slide.spokes || []).map((s) => strip({ label: s.label, detail: s.detail })),
        }),
      };
    case "ranked":
      return {
        kind,
        content: strip({
          heading: slide.heading,
          items: (slide.items || []).map((i) => strip({ title: i.title, detail: i.detail })),
        }),
      };
    case "stat":
      return {
        kind,
        content: strip({
          eyebrow: slide.eyebrow,
          statValue: slide.statValue != null ? String(slide.statValue) : undefined,
          statLabel: slide.statLabel,
          context: slide.context,
        }),
      };
    case "dsSnapshot":
      return {
        kind,
        content: strip({
          heading: slide.heading,
          structureType: slide.structureType,
          cells: (slide.cells || []).map((c) =>
            strip({ value: c.value != null ? String(c.value) : undefined, highlighted: c.highlighted })
          ),
          pointers: (slide.pointers || []).map((p) => strip({ index: p.index, label: p.label })),
          caption: slide.caption,
        }),
      };
    default:
      throw new Error(`mapSlideContent: unknown kind "${kind}"`);
  }
}

/** Drops undefined/empty-string keys so the emitted content.json is clean (templates already
 * default missing optional fields themselves, but this keeps the payload honest about what was
 * actually authored vs. omitted). */
function strip(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

function mapCarousel(raw, { brandHandle, accentColor } = {}) {
  const slides = raw.slides.map((s) => mapSlideContent(s, { defaultHandle: brandHandle }));
  const payload = { slides };
  if (brandHandle) payload.brandHandle = brandHandle;
  if (accentColor) payload.brandAccent = accentColor;
  return payload;
}

module.exports = { mapSlideContent, mapCarousel };
