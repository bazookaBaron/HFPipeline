"use strict";

/**
 * Piece 2 step 3: resolve each scene's narrationAnchors to real seconds
 * using that scene's own WhisperX word-timing array (voice-pipeline's
 * `[{word, start, end}, ...]` shape -- see PHASE4-REPORT.md).
 *
 * The scripting pipeline's reject-and-repair loop already guarantees
 * `anchorText` is an exact, verbatim substring of that scene's own
 * `narration` (validation.ts's anchor check). Forced alignment
 * (WhisperX aligning against the exact known gen-text) means the Nth word
 * of the narration text and the Nth entry of the timing array refer to the
 * same spoken word -- so we find the anchor's position by WORD INDEX
 * (count whitespace-separated words before the anchor's first character),
 * not by fuzzy text matching against the timing array's own tokens.
 */

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/** 0-based index of the first word of `anchorText` within `narration`. */
function anchorWordIndex(narration, anchorText) {
  const idx = narration.indexOf(anchorText);
  if (idx === -1) return 0; // shouldn't happen -- scripting-pipeline validates this substring already
  const before = narration.slice(0, idx).trim();
  if (!before) return 0;
  return before.split(/\s+/).length;
}

/**
 * @param {{narration: string, narrationAnchors: {anchorText: string, propPath: string}[]}} scene
 * @param {{word: string, start: number, end: number}[]} wordTimings
 * @param {number} durationSeconds real measured audio duration for this scene
 * @returns {Record<string, number>} e.g. { reveal_at: 0.42, answer_at: 1.83 }
 */
function resolveAnchorTimings(scene, wordTimings, durationSeconds) {
  const resolved = {};
  if (!Array.isArray(wordTimings) || wordTimings.length === 0) return resolved;

  const upperBound = Math.max(0, durationSeconds - 0.01);
  // Real bug found via a real end-to-end render + reference-video comparison: Gemini is
  // free to pick ANY verbatim word/phrase from a scene's narration as the anchor for
  // "reveal_at", and nothing constrained it to an EARLY one. A scene whose reveal_at anchor
  // happened to land on a phrase spoken 9-10s into a 16s narration rendered a fully blank
  // frame (chrome only) for that entire stretch -- every component's own schema describes
  // reveal_at as "when the main content starts revealing," which only makes sense early.
  // Every OTHER "_at" prop (switch_at, first_check_at, etc.) legitimately syncs to a
  // mid-scene narration beat and is left uncapped. reveal_at alone is capped to whichever
  // is smaller: 30% of the scene's real duration, or 3s -- generous enough to still land on
  // the real anchor word for a normally-paced sentence, tight enough that nothing is ever
  // left showing pure chrome for more than a few seconds.
  const revealAtCeiling = Math.min(upperBound, durationSeconds * 0.3, 3);

  for (const anchor of scene.narrationAnchors || []) {
    // propPath is "props.<key>" per the reconciled wire schema (e.g. "props.reveal_at").
    const key = anchor.propPath.replace(/^props\./, "");
    // Defense in depth (scripting-pipeline/src/validation.ts's checkAnchors is the primary
    // gate): a REAL generated composition was found with `"edges":4.385` and `"items":9.986`
    // -- Gemini had picked "props.edges"/"props.items" as anchor targets, and the caller
    // (generate-video.js) spreads this function's return value directly over the scene's
    // real content props, so a non-"_at" key here would silently clobber that scene's real
    // array/list content with a bare number. Every legitimate timing prop in this component
    // library ends in "_at" by convention -- skip (never resolve) anything else, so even a
    // script that somehow reaches this function with a bad propPath can't corrupt content.
    if (!key.endsWith("_at")) continue;
    const wordIndex = clamp(anchorWordIndex(scene.narration, anchor.anchorText), 0, wordTimings.length - 1);
    const word = wordTimings[wordIndex];
    let seconds = word ? clamp(Number(word.start) || 0, 0, upperBound) : 0;
    // Matches "reveal_at" and any component-specific variant of it (e.g. kpi-cluster's
    // "title_reveal_at") -- every one of these names the FIRST thing a scene shows, by this
    // library's own naming convention, so the same early-reveal reasoning applies to all of
    // them, not just the literal "reveal_at" key.
    if (/reveal_at$/.test(key)) {
      seconds = Math.min(seconds, revealAtCeiling);
    }
    resolved[key] = Number(seconds.toFixed(3));
  }

  return resolved;
}

module.exports = { resolveAnchorTimings, anchorWordIndex };
