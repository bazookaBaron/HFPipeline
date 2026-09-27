"use strict";

/**
 * style.js (LF v2 §1, workstream F): deterministic script-craft gates and fixes. No LLM calls.
 *
 *   splitLongSentences  - rewrites long sentences at safe boundaries ("; ", ", and ", ", but ", ", which means",
 *                         a single dash, comma splices) BEFORE any LLM repair; fixes sentence length and lowers FK
 *   fillTags            - fills missing/invalid mood, energy and visual tags from cheap heuristics (never a repair)
 *   styleProblems       - per section:
 *                           median sentence <= 12 words and < 5 % of sentences over 20 words;
 *                           >= 1 direct-address phrase and >= 1 pivot word in every ~40 s window;
 *                           chapters: >= 1 metaphor and >= 1 concrete case (script-call `devices` tags),
 *                             an open question up front and (all but the last) a cliffhanger question at the end;
 *                           cold open: every hook-skeleton element present, the irony pivot starts by ~60 s,
 *                             the last question of the stack is about the viewer;
 *                           quotes: quoted spans must be verbatim from dossier.quotes (non-UGC sourced, research.js)
 *                             and the sentence must cite the quote id.
 *   montageProblems     - montageLines (5-7, each <= 10 words, no digits) and anchorLine (verbatim when it quotes).
 */

const { parseSpokenNumbers, isExempt } = require("./numbers");

const MOODS = ["tension", "investigative", "dread", "hopeful", "playful", "calm", "triumphant"];
const VISUALS = ["geo", "number", "trend", "compare", "quote", "person", "event", "concept", "joke"];
const DEVICES = ["chorus", "quote", "myth", "reveal", "stakes", "irony", "stat", "definition", "metaphor", "case", "question", "pivot", "cliffhanger", "joke", "callback"];

const MEDIAN_MAX = 12;
const LONG_WORDS = 20;
const LONG_SHARE_MAX = 0.05;
const WINDOW_SECONDS = 40;
const IRONY_BY_SECONDS = 60;
const MONTAGE_MIN = 5;
const MONTAGE_MAX = 7;
const MONTAGE_WORDS = 10;

const words = (text) => (String(text || "").match(/[A-Za-zÀ-ɏ]+(?:['’][A-Za-z]+)?/g) || []);
const wc = (t) => words(t).length;

// "you", "guys", "look at this", "imagine", "here's the catch"... the narrator talking TO the viewer
const DIRECT = /\b(?:you|your|you['’](?:re|ve|d|ll)|yourself|guys|folks|imagine|picture (?:this|that|it)|look at (?:this|that|it)|let['’]s|here['’]s (?:the|a|where|what|why|how)|think about (?:it|this|that)|ask yourself|right\?)|(?:^|[,.] )people,/i;
// the turns that drive the structure: "but", "the irony is", "so the question is", "what most people don't realise"
const PIVOT = /\b(?:but|yet|however|instead|except|ironically|the irony|turns out|so the (?:real |big )?question|here['’]s the (?:catch|twist|irony|kicker|problem)|the catch|on the other hand|and while|what (?:most )?(?:people|they|we) (?:don['’]t|didn['’]t) (?:realise|realize|know|see))\b/i;

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function lengthStats(sents) {
  const n = sents.map((s) => wc(s.text));
  const long = sents.filter((s, i) => n[i] > LONG_WORDS).map((s) => s.id);
  return { median: median(n), longShare: sents.length ? long.length / sents.length : 0, long };
}

/** Consecutive windows of ~WINDOW_SECONDS of narration; a short tail (< 60 %) joins the previous window. */
function windows(sents, wpm = 160, seconds = WINDOW_SECONDS) {
  const size = Math.round((wpm * seconds) / 60);
  const out = [];
  let cur = [], n = 0;
  sents.forEach((s, i) => {
    cur.push(i);
    n += wc(s.text);
    if (n >= size) { out.push(cur); cur = []; n = 0; }
  });
  if (cur.length) {
    if (out.length && n < size * 0.6) out[out.length - 1].push(...cur);
    else out.push(cur);
  }
  return out;
}

function coverage(sents, re, label, hint, wpm) {
  return windows(sents, wpm).filter((w) => !w.some((i) => re.test(sents[i].text)))
    .map((w) => `${sents[w[0]].id}..${sents[w[w.length - 1]].id} (~${WINDOW_SECONDS} s) has no ${label}; ${hint}`);
}

// ---------- quotes ----------
const normQuote = (s) => String(s || "").toLowerCase().replace(/[‘’‛`´]/g, "'").replace(/[“”„"«»]/g, "").replace(/[–—]/g, "-").replace(/\s+/g, " ").replace(/^[\s'.,;:!?-]+|[\s'.,;:!?-]+$/g, "").trim();

/** Double-quoted spans of 4+ words: [{start, end, inner}] (straight or curly quotes). */
function quotedSpans(text) {
  const out = [];
  const re = /["“]([^"“”]+)["”]/g;
  let m;
  while ((m = re.exec(String(text || "")))) if (wc(m[1]) >= 4) out.push({ start: m.index, end: m.index + m[0].length, inner: m[1] });
  return out;
}

/** Which dossier quote a span reproduces verbatim (an exact excerpt of 4+ words counts), or null. */
function matchQuote(inner, quotes) {
  const n = normQuote(inner);
  if (!n) return null;
  return (quotes || []).find((q) => normQuote(q.text).includes(n)) || null;
}

/** Sentence text with verified verbatim quotes removed (their words are the speaker's, not ours: no number gate). */
function stripVerifiedQuotes(text, quotes) {
  let t = String(text || "");
  quotedSpans(t).reverse().forEach((s) => { if (matchQuote(s.inner, quotes)) t = t.slice(0, s.start) + " " + t.slice(s.end); });
  return t;
}

function quoteProblems(sentence, dossier) {
  const quotes = (dossier && dossier.quotes) || [];
  const p = [];
  const spans = quotedSpans(sentence.text);
  spans.forEach((s) => {
    const q = matchQuote(s.inner, quotes);
    if (!q) p.push(`${sentence.id} quotes "${s.inner.slice(0, 50)}..." which is not a verbatim dossier quote; use only QUOTES word for word, or paraphrase without quotation marks`);
    else if (sentence.quoteId !== q.id) sentence.quoteId = q.id; // deterministic: cite the matched quote
  });
  if ((sentence.devices || []).includes("quote") && !spans.length) p.push(`${sentence.id} is tagged as a quote but has no quoted words; put the verbatim quote in double quotes`);
  return p;
}

// ---------- splitter ----------
const SUBORDINATE = /^(?:if|when|whenever|while|because|although|though|as|since|after|before|unless|once|until|even if|even though)\b/i;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Candidate boundaries in `text`: {at, cut, lead} where text[at..cut) is removed, the left part gets a period and the
 * right part starts with `lead` (+ capitalised rest). Positions inside quoted spans are never used.
 */
function boundaries(text) {
  const spans = quotedSpans(text).concat([...String(text).matchAll(/["“][^"“”]*["”]/g)].map((m) => ({ start: m.index, end: m.index + m[0].length })));
  const inQuote = (i) => spans.some((s) => i > s.start && i < s.end);
  const out = [];
  const add = (re, lead) => {
    for (const m of text.matchAll(re)) {
      if (inQuote(m.index)) continue;
      out.push({ at: m.index, cut: m.index + m[0].length, lead: typeof lead === "function" ? lead(m) : lead, comma: m[0].trim().startsWith(",") || /^\s+(?:and|but)\s+$/i.test(m[0]) });
    }
  };
  add(/;\s+/g, "");
  const dashes = text.match(/\s[—–-]\s|—/g) || [];
  if (dashes.length === 1) add(/\s*—\s*|\s[–-]\s/g, "");
  add(/,\s+(and|but|so|because)\s+/gi, (m) => `${cap(m[1].toLowerCase())} `);
  add(/,\s+which\s+(?=(?:means|meant|is|was|made|makes|left|leaves)\b)/gi, "That ");
  add(/\s+(and|but)\s+(?=(?:it|they|the|he|she|we|you|this|that|its|their|his|her|there|nobody|everyone)\b)/gi, (m) => `${cap(m[1].toLowerCase())} `);
  add(/,\s+(?=(?:it|they|he|she|we|you|there|this|that)\s+(?:is|was|were|are|had|has|did|does|could|would|will|can|kept|got|went|made|said)\b)/gi, "");
  return out;
}

/** Split one sentence until every part is <= maxWords (or no safe boundary is left). Returns an array of strings. */
function splitSentence(text, maxWords = LONG_WORDS) {
  const t = String(text || "").trim();
  if (wc(t) <= maxWords) return [t];
  const total = wc(t);
  let best = null;
  for (const b of boundaries(t)) {
    const left = t.slice(0, b.at).trim().replace(/[,;:\s]+$/, "");
    const rest = t.slice(b.cut).trim();
    const right = b.lead ? b.lead + rest : cap(rest);
    const l = wc(left), r = wc(right);
    if (l < 4 || r < 4) continue;
    if (b.comma && SUBORDINATE.test(left)) continue; // "If X, it was Y" must not become "If X."
    const score = Math.abs(l - total / 2);
    if (!best || score < best.score) best = { left: /[.!?]$/.test(left) ? left : `${left}.`, right, score };
  }
  if (!best) return [t];
  return [...splitSentence(best.left, maxWords), ...splitSentence(best.right, maxWords)];
}

const hasFigure = (text) => parseSpokenNumbers(text).some((n) => !isExempt(n) && !n.year);

/**
 * Split long sentences in a section (in place order preserved). Sentences over LONG_WORDS are always split; when the
 * section median is still above MEDIAN_MAX, sentences over 15 words are split too. Tags and factIds are copied to each
 * part; calc stays only on parts that say a figure. Ids are re-numbered `${sectionId}-sNN` when anything changed.
 * Returns the number of splits made.
 */
function splitLongSentences(section) {
  let splits = 0;
  const pass = (max) => {
    const out = [];
    for (const s of section.sentences) {
      const parts = wc(s.text) > max ? splitSentence(s.text, max) : [s.text];
      if (parts.length === 1) { out.push(s); continue; }
      splits += parts.length - 1;
      parts.forEach((text) => {
        const x = { ...s, text, factIds: [...(s.factIds || [])], ...(s.devices ? { devices: [...s.devices] } : {}) };
        if (s.calc && !hasFigure(text)) delete x.calc;
        out.push(x);
      });
    }
    section.sentences = out;
  };
  pass(LONG_WORDS);
  if (lengthStats(section.sentences).median > MEDIAN_MAX) pass(15);
  if (splits) section.sentences.forEach((s, i) => { s.id = `${section.id}-s${String(i + 1).padStart(2, "0")}`; });
  return splits;
}

// "So the question is." / "But the irony is." left dangling as its own sentence -> merged into the next one
const DANGLING = /^(?:and |but |so,? )?(?:the (?:real |big )?question is|the irony is)[.:,…]*$/i;

/** Merge dangling lead-ins into the following sentence (devices united). Returns the number of merges. */
function mergeDanglingLeads(section) {
  let merges = 0;
  const out = [];
  const sents = section.sentences || [];
  for (let i = 0; i < sents.length; i++) {
    const s = sents[i], next = sents[i + 1];
    if (next && DANGLING.test(String(s.text).trim())) {
      const lead = String(s.text).trim().replace(/[.:,…]+$/, "");
      const rest = String(next.text).trim();
      out.push({ ...next, text: `${lead}, ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`, devices: [...new Set([...(s.devices || []), ...(next.devices || [])])] });
      merges++;
      i++;
    } else out.push(s);
  }
  if (merges) {
    section.sentences = out;
    section.sentences.forEach((s, i) => { s.id = `${section.id}-s${String(i + 1).padStart(2, "0")}`; });
  }
  return merges;
}

// ---------- tags ----------
const DEFAULT_MOOD = (id) => (id === "cold" ? "tension" : id === "recap" ? "calm" : "investigative");

/** Deterministically fill missing/invalid tags (no repair call is ever spent on a tag). Returns the notes made. */
function fillTags(section) {
  const notes = [];
  if (!MOODS.includes(section.mood)) { notes.push(`mood ${section.mood || "(none)"} -> ${DEFAULT_MOOD(section.id)}`); section.mood = DEFAULT_MOOD(section.id); }
  const e = Math.round(Number(section.energy));
  if (!(e >= 1 && e <= 5)) { notes.push(`energy ${section.energy ?? "(none)"} -> 3`); section.energy = 3; } else section.energy = e;
  for (const s of section.sentences || []) {
    s.devices = [...new Set((Array.isArray(s.devices) ? s.devices : []).map((d) => String(d).toLowerCase()).filter((d) => DEVICES.includes(d)))];
    if (quotedSpans(s.text).length && s.visual !== "quote") s.visual = "quote";
    if (!VISUALS.includes(s.visual)) s.visual = s.devices.includes("joke") ? "joke" : hasFigure(s.text) ? "number" : "concept";
  }
  return notes;
}

// ---------- gates ----------
const tagged = (sents, d) => sents.filter((s) => (s.devices || []).includes(d));

function hookScriptProblems(sents, opts = {}) {
  const p = [];
  const wpm = opts.wpm || 160;
  const quotes = (opts.dossier && opts.dossier.quotes) || [];
  const need = [["chorus", "the chorus line (the buzzword / common belief)"], ["myth", "the 'most people think...' belief"], ["reveal", "the 'what they don't realise' reveal"],
    ["irony", "the irony pivot ('But the irony is...')"], ["definition", "the plain-words definition of the key stat or term"], ["metaphor", "the everyday metaphor"],
    ["case", "the concrete case study"]];
  if (quotes.length) need.splice(1, 0, ["quote", "the anchor quote (verbatim, in double quotes)"]);
  need.forEach(([d, what]) => { if (!tagged(sents, d).length) p.push(`cold open lacks ${what}: no sentence tagged "${d}"`); });
  const stakes = tagged(sents, "stakes").filter((s) => hasFigure(s.text));
  if (stakes.length < 3) p.push(`cold open stakes tour has ${stakes.length} stop(s) with a number; need 3 (one place + one number + year each)`);
  const qs = tagged(sents, "question").filter((s) => /\?\s*$/.test(s.text));
  if (qs.length < 3) p.push(`cold open question stack has ${qs.length} question(s); need 3-4 ending on the viewer`);
  else if (!/\b(?:you|your|yours|yourself)\b/i.test(qs[qs.length - 1].text)) p.push(`${qs[qs.length - 1].id}: the last question of the stack must be about the viewer (you / your)`);
  const irony = sents.findIndex((s) => (s.devices || []).includes("irony"));
  if (irony >= 0) {
    const before = sents.slice(0, irony).reduce((a, s) => a + wc(s.text), 0);
    const sec = Math.round((before / wpm) * 60);
    if (sec > IRONY_BY_SECONDS) p.push(`the irony pivot (${sents[irony].id}) starts at ~${sec} s; it must land by ~${IRONY_BY_SECONDS} s: tighten the chorus / quote / stakes before it`);
  }
  return p;
}

/**
 * Style problems for one section (after splitLongSentences + fillTags).
 * opts: {dossier, wpm?, isLastChapter?}
 */
function styleProblems(section, opts = {}) {
  const sents = section.sentences || [];
  if (!sents.length) return [];
  const p = [];
  const wpm = opts.wpm || 160;
  const st = lengthStats(sents);
  if (st.median > MEDIAN_MAX) p.push(`median sentence is ${st.median} words (max ${MEDIAN_MAX}); use shorter sentences and fragments, one idea each`);
  if (st.longShare >= LONG_SHARE_MAX && st.long.length) p.push(`${st.long.length} sentence(s) over ${LONG_WORDS} words (${st.long.join(", ")}); split them`);
  coverage(sents, DIRECT, "direct address", 'talk to the viewer ("you", "imagine", "look at this", "here\'s the thing")', wpm).forEach((x) => p.push(x));
  coverage(sents, PIVOT, "pivot", 'add a turn ("But...", "The irony is...", "So the question is...", "What most people don\'t realise...")', wpm).forEach((x) => p.push(x));
  sents.forEach((s) => quoteProblems(s, opts.dossier).forEach((x) => p.push(x)));
  if (section.id === "cold") hookScriptProblems(sents, { dossier: opts.dossier, wpm }).forEach((x) => p.push(x));
  else if (/^ch\d+/.test(section.id)) {
    if (!tagged(sents, "metaphor").length) p.push('chapter has no everyday metaphor (tag the sentence "metaphor")');
    if (!tagged(sents, "case").length) p.push('chapter has no concrete, named case (tag the sentence "case")');
    if (!sents.slice(0, 2).some((s) => /\?/.test(s.text))) p.push("chapter must open with a question in its first two sentences");
    if (!opts.isLastChapter && !sents.slice(-2).some((s) => /\?/.test(s.text))) p.push("chapter must end on a cliffhanger question (in its last two sentences) that the next chapter answers");
  }
  return p;
}

/** montageLines: [{text, factIds}] 5-7, each <= 10 words, no digits; anchorLine: {text, quoteId|null}. */
function montageProblems(montageLines, anchorLine, dossier) {
  const p = [];
  const lines = montageLines || [];
  if (lines.length < MONTAGE_MIN || lines.length > MONTAGE_MAX) p.push(`montageLines needs ${MONTAGE_MIN}-${MONTAGE_MAX} lines, got ${lines.length}`);
  lines.forEach((l, i) => {
    const n = wc(l && l.text);
    if (!n) p.push(`montageLines[${i}] is empty`);
    else if (n > MONTAGE_WORDS) p.push(`montageLines[${i}] has ${n} words (max ${MONTAGE_WORDS}): "${l.text}"`);
    if (/\d/.test(String(l && l.text))) p.push(`montageLines[${i}] uses digits; spell numbers as words`);
  });
  if (!anchorLine || !anchorLine.text) p.push("missing anchorLine");
  else if (anchorLine.quoteId) {
    const q = ((dossier && dossier.quotes) || []).find((x) => x.id === anchorLine.quoteId);
    if (!q) p.push(`anchorLine cites unknown quote ${anchorLine.quoteId}`);
    else if (!normQuote(q.text).includes(normQuote(anchorLine.text))) p.push(`anchorLine must be verbatim from ${q.id}`);
  }
  return p;
}

module.exports = {
  MOODS, VISUALS, DEVICES, MEDIAN_MAX, LONG_WORDS, LONG_SHARE_MAX, WINDOW_SECONDS, IRONY_BY_SECONDS, MONTAGE_MIN, MONTAGE_MAX, MONTAGE_WORDS,
  DIRECT, PIVOT, lengthStats, windows, splitSentence, splitLongSentences, mergeDanglingLeads, fillTags, styleProblems, hookScriptProblems, montageProblems,
  quotedSpans, matchQuote, stripVerifiedQuotes, quoteProblems, normQuote, median,
};
