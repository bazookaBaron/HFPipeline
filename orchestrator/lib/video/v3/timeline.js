"use strict";

/**
 * v2 timeline: turns per-sentence voice clips + a validated storyboard into ONE continuous
 * final-output timeline -- sentence placements, globally indexed words, host windows, and
 * every event resolved to a host-local time at its exact spoken word.
 *
 * Measured targets this encodes (analysis/pacing-audit-20260924):
 *   - references never drop to digital silence and pause ~200 ms between sentences (median,
 *     p90 ~320 ms); ours had 0.60-1.66 s of TTS lead silence per scene and 420 ms median gaps.
 *   - a host's content is on screen from its first frame; events land at their spoken word.
 * Pure functions only (no I/O) so it is unit-testable; audio assembly lives in narration.js.
 */

const DEFAULTS = {
  sentenceGap: 0.2, // seconds of silence inserted between sentences (reference median)
  leadPad: 0.06, // keep this much audio before a clip's first word (onset consonants)
  tailPad: 0.08, // and after its last word (release)
  eventLead: 0.0, // seconds an event fires before its word onset (0 = on the word)
};

function tokenize(text) {
  return String(text).split(/\s+/).filter(Boolean);
}

function normalizeWord(w) {
  return String(w)
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/** Same matcher as scripting-pipeline/src/v2/storyboard.ts findAnchorIndex (kept in lockstep by tests). */
function findAnchorIndex(sentenceText, anchor) {
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
    if (ok && ++seen === (anchor.occurrence || 1)) return i;
  }
  return -1;
}

/**
 * @param {{id:string,text:string}[]} sentences storyboard sentences, in order
 * @param {{audioPath:string, durationSeconds:number, words:{word:string,start:number,end:number}[]}[]} clips
 *   one synthesized clip per sentence (same order); words are clip-local seconds
 * @returns {{segments, sentenceTimes, words, totalSeconds}}
 *   segments: [{audioPath, trimStart, trimEnd, at}] -- what to cut from each clip and where it lands
 */
function planNarration(sentences, clips, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (sentences.length !== clips.length) throw new Error(`planNarration: ${sentences.length} sentences but ${clips.length} clips`);
  const segments = [];
  const sentenceTimes = [];
  const words = [];
  let cursor = 0;
  sentences.forEach((s, si) => {
    const clip = clips[si];
    const toks = tokenize(s.text);
    if (!clip.words.length) throw new Error(`sentence ${s.id}: voice alignment returned no words`);
    if (clip.words.length !== toks.length) {
      throw new Error(`sentence ${s.id}: ${toks.length} text tokens but ${clip.words.length} aligned words -- refusing to guess the mapping`);
    }
    const first = clip.words[0].start;
    const last = clip.words[clip.words.length - 1].end;
    const trimStart = Math.max(0, first - o.leadPad);
    const trimEnd = Math.min(clip.durationSeconds, last + o.tailPad);
    const at = cursor;
    segments.push({ audioPath: clip.audioPath, trimStart: round(trimStart), trimEnd: round(trimEnd), at: round(at) });
    const offset = at - trimStart;
    clip.words.forEach((w, wi) => {
      words.push({ i: words.length, sentenceId: s.id, wi, text: toks[wi], start: round(w.start + offset), end: round(w.end + offset) });
    });
    sentenceTimes.push({ id: s.id, start: round(at), end: round(at + (trimEnd - trimStart)), speechStart: round(first + offset), speechEnd: round(last + offset) });
    // gaps: o.gaps[si] (authored seconds, per sentence) when given, else the uniform sentenceGap
    const gap = Array.isArray(o.gaps) ? Number(o.gaps[si]) || 0 : o.sentenceGap;
    cursor = at + (trimEnd - trimStart) + (si < sentences.length - 1 ? gap : 0);
  });
  return { segments, sentenceTimes, words, totalSeconds: round(cursor) };
}

/**
 * Host windows: a host starts where its first sentence starts (the first host at 0) and ends
 * where the next host starts (the last at totalSeconds), so hosts tile the video with no gap
 * -- the empty-frame intervals measured in our render (13.5% of runtime) cannot occur.
 */
function hostWindows(storyboard, sentenceTimes, totalSeconds) {
  const tIndex = new Map(sentenceTimes.map((t) => [t.id, t]));
  const wins = storyboard.hosts.map((h, i) => ({ id: h.id, start: i === 0 ? 0 : tIndex.get(h.fromSentence).start }));
  wins.forEach((w, i) => {
    w.end = i + 1 < wins.length ? wins[i + 1].start : totalSeconds;
    w.duration = round(w.end - w.start);
  });
  return wins;
}

/**
 * Resolves each event to {abs, t (host-local), wordIndex}. Throws on an unresolvable anchor
 * rather than guessing (the storyboard validator should already have rejected it).
 */
function resolveEvents(storyboard, words, windows, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const win = new Map(windows.map((w) => [w.id, w]));
  const sentText = new Map(storyboard.sentences.map((s) => [s.id, s.text]));
  const bySentence = new Map();
  words.forEach((w) => {
    if (!bySentence.has(w.sentenceId)) bySentence.set(w.sentenceId, []);
    bySentence.get(w.sentenceId).push(w);
  });
  return storyboard.events.map((ev) => {
    const idx = findAnchorIndex(sentText.get(ev.sentence) || "", ev.anchor);
    const sw = bySentence.get(ev.sentence) || [];
    if (idx < 0 || !sw[idx]) throw new Error(`event ${ev.id}: anchor "${ev.anchor.text}" not found in ${ev.sentence}`);
    const w = win.get(ev.host);
    const abs = Math.max(w.start, sw[idx].start - o.eventLead);
    return { ...ev, abs: round(abs), t: round(abs - w.start), wordIndex: sw[idx].i, word: sw[idx].text };
  });
}

function round(x) {
  return Math.round(x * 1000) / 1000;
}

module.exports = { planNarration, hostWindows, resolveEvents, findAnchorIndex, tokenize, normalizeWord, DEFAULTS };
