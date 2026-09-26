"use strict";

/**
 * Delivered narration pace, matched to the reference reels.
 *
 * Measured on nine references (R1-R5, V1/V3/V4/V5; faster-whisper word timings, pauses > 0.25 s
 * removed): the speakers hold a near-constant SYLLABLE rate (5.4-6.1 syl/s, median 5.84) while
 * words/min swings 170-221 with vocabulary (1.42-1.84 syllables per word). A fixed wpm target
 * therefore rushes jargon-heavy scripts (6.95 syl/s measured at 215 wpm) and drags plain ones, so
 * the TTS speed is solved for the syllable rate and wpm is only clamped to the reference range.
 */

const SYL_PER_S = 5.84; // reference median articulation rate
const WPM_RANGE = [170, 222]; // reference gross wpm range (incl. sentence pauses)

function syllables(word) {
  const t = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!t) return 0;
  let n = (t.match(/[aeiouy]+/g) || []).length;
  if (t.endsWith("e") && n > 1 && !t.endsWith("le")) n -= 1;
  return Math.max(1, n);
}

function countSyllables(text) {
  return String(text || "")
    .split(/\s+/)
    .reduce((a, w) => a + syllables(w), 0);
}

/**
 * speech: seconds of trimmed sentence audio at speed 1; gaps: fixed seconds between sentences.
 * Returns the TTS speed factor and the resulting pace.
 */
function solvePace({ speech, gaps, nWords, nSyllables, sylPerS = SYL_PER_S, wpmRange = WPM_RANGE }) {
  let target = nSyllables / sylPerS; // delivered speech seconds
  const total = (t) => t + gaps;
  const wpmAt = (t) => (nWords / total(t)) * 60;
  if (wpmAt(target) > wpmRange[1]) target = (nWords / wpmRange[1]) * 60 - gaps;
  if (wpmAt(target) < wpmRange[0]) target = (nWords / wpmRange[0]) * 60 - gaps;
  const speed = Math.min(2.0, Math.max(0.8, Number((speech / Math.max(1, target)).toFixed(4))));
  const delivered = speech / speed;
  return { speed, sylPerS: nSyllables / delivered, wpm: wpmAt(delivered) };
}

module.exports = { SYL_PER_S, WPM_RANGE, syllables, countSyllables, solvePace };
