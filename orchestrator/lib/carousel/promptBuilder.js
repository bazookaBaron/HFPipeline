"use strict";

const { KNOWN_KINDS, MIN_SLIDES, MAX_SLIDES, FIELD_LIMITS } = require("./schema");

/** Builds the initial generation prompt for a topic. Field ceilings are stated explicitly
 * (not just enforced silently after the fact) so Gemini has a real shot at getting it right on
 * the first try instead of relying on the repair loop to do all the work. */
function buildInitialPrompt({ topic, brandHandle }) {
  const targetCount = Math.floor((MIN_SLIDES + MAX_SLIDES) / 2); // a specific number is easier for the model to satisfy reliably than a range -- see PHASE7 notes on the 1-slide failure mode this replaced.
  return `You are writing the content plan for an Instagram carousel post on the topic:

"${topic}"

The "slides" array in your response MUST contain EXACTLY ${targetCount} slides. Not 1, not 3, not
${targetCount - 1}, not ${targetCount + 1} — EXACTLY ${targetCount} slide objects in the array.
Count them before you finish.

Each slide has a "kind" (one of: ${KNOWN_KINDS.join(", ")}) and only the content fields relevant to
that kind. The FIRST slide must be kind "cover" and the LAST (the ${targetCount}th) slide must be
kind "cta". Use a mix of the other kinds for the ${targetCount - 2} slides in between, chosen to
fit what this specific topic actually needs — don't force a kind that doesn't suit the content.
Use at least 3-4 different kinds across those middle slides for visual variety.

Field shapes and rough length ceilings per kind (stay under these — this is a punchy visual
carousel, not an essay; every field is rendered inside a fixed-size box):
- cover: kicker (<=${FIELD_LIMITS.kicker.words}w), title (<=${FIELD_LIMITS.title.words}w, the big headline), subtitle (<=${FIELD_LIMITS.subtitle.words}w).
- content: eyebrow (<=${FIELD_LIMITS.eyebrow.words}w), heading (<=${FIELD_LIMITS.heading.words}w), body: 2-5 bullet strings, each <=${FIELD_LIMITS.bodyItem.words}w and a complete, specific point (no filler).
- diagram: heading (<=${FIELD_LIMITS.heading.words}w), steps: 3-5 items {label <=${FIELD_LIMITS.stepLabel.words}w, detail <=${FIELD_LIMITS.stepDetail.words}w}, in order.
- screenshot: heading (<=${FIELD_LIMITS.heading.words}w), codeLines: 3-7 short lines (<=${FIELD_LIMITS.codeLine.words}w each) of REAL, plausible code/terminal/HTTP output relevant to the topic (not lorem ipsum), caption (<=${FIELD_LIMITS.caption.words}w).
- cta: heading (<=${FIELD_LIMITS.heading.words}w), subtext (<=${FIELD_LIMITS.subtext.words}w), buttonText (<=${FIELD_LIMITS.buttonText.words}w, e.g. "Save this post"), handle ("${brandHandle}").
- compare: heading (<=${FIELD_LIMITS.heading.words}w), columns: 2-3 items {title <=${FIELD_LIMITS.columnTitle.words}w, points: 2-4 strings <=${FIELD_LIMITS.point.words}w each}.
- hub: heading (<=${FIELD_LIMITS.heading.words}w), hubLabel (<=${FIELD_LIMITS.hubLabel.words}w), spokes: 3-6 items {label <=${FIELD_LIMITS.spokeLabel.words}w, detail <=${FIELD_LIMITS.spokeDetail.words}w}.
- ranked: heading (<=${FIELD_LIMITS.heading.words}w), items: 3-6 items {title <=${FIELD_LIMITS.itemTitle.words}w, detail <=${FIELD_LIMITS.itemDetail.words}w}, in rank/priority order.
- stat: eyebrow (<=${FIELD_LIMITS.eyebrow.words}w), statValue (a short number/value, e.g. "68%", <=${FIELD_LIMITS.statValue.chars} chars), statLabel (<=${FIELD_LIMITS.statLabel.words}w), context (<=${FIELD_LIMITS.context.words}w).
- dsSnapshot: heading (<=${FIELD_LIMITS.heading.words}w), structureType (e.g. "LRU Cache — capacity 4"), cells: 3-8 items {value <=${FIELD_LIMITS.cellValue.chars} chars, highlighted?: boolean}, pointers?: [{index, label}], caption (<=${FIELD_LIMITS.caption.words}w).

Hard rules:
- Every field you fill must be real, specific content about "${topic}" — never generic
  boilerplate, never a placeholder like "Your headline here", "Lorem ipsum", "TBD", or
  "[Insert stat]". If you don't have a real value for an optional field, omit it entirely rather
  than filling it with filler text.
- Do not include fields that don't belong to the chosen "kind" (e.g. don't put "statValue" on a
  "content" slide).
- Keep every field within its stated length ceiling.
- The cta slide's "handle" should be "${brandHandle}" unless the topic itself demands otherwise.
- Before returning, count the objects in your "slides" array. It must be ${targetCount}. If it
  is not, add or remove slides until it is exactly ${targetCount}.

Return only the JSON object matching the response schema.`;
}

/** Builds a repair-turn message listing concrete validation failures from the previous attempt,
 * asking for a corrected FULL replacement (not a diff — simpler and more reliable for a
 * structured-output model to produce correctly). */
function buildRepairPrompt(errors) {
  const targetCount = Math.floor((MIN_SLIDES + MAX_SLIDES) / 2);
  return `Your previous JSON response failed validation for these reasons:

${errors.map((e) => `- ${e}`).join("\n")}

Return a corrected, COMPLETE replacement JSON object (the full "topic" and full "slides" array
again, not just the fixed parts) that resolves every issue above while keeping the rest of the
carousel's real, topic-specific content. The "slides" array must contain EXACTLY ${targetCount}
slide objects — count them before returning. Keep following all the original field-shape and
length-ceiling rules. Return only the JSON object matching the response schema.`;
}

module.exports = { buildInitialPrompt, buildRepairPrompt };
