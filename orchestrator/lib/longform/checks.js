"use strict";

/**
 * Deterministic script checks for long-form chapters (plan §4.3):
 * readability (syllable-based Flesch-Kincaid grade <= 8 per chapter), sentence length <= 22 words,
 * the dossier number gate, glossary jargon explained within two sentences, no channel CTA /
 * throat-clearing / absolute claims (narrativeGuide.js), no investment advice, no loaded
 * geopolitical labels.
 */

const { syllables } = require("../video/v3/pace");
const { narrativeProblems } = require("../video/v3/narrativeGuide");
const { checkSentenceNumbers, isExempt } = require("./numbers");
const { stripVerifiedQuotes } = require("./style");

const FK_MAX = 8;
const MAX_WORDS = 22;
const MAX_FIGURES_PER_SENTENCE = 2;
const MAX_FIGURES_PER_100_WORDS = 4.5;

const words = (text) => (String(text || "").match(/[A-Za-zÀ-ɏ]+(?:['’][A-Za-z]+)?/g) || []);

/** Flesch-Kincaid grade over a list of sentence strings. */
function fkGrade(sentences) {
  const list = sentences.map((s) => (typeof s === "string" ? s : s.text)).filter((t) => words(t).length);
  if (!list.length) return 0;
  const w = list.flatMap(words);
  const syl = w.reduce((a, x) => a + syllables(x), 0);
  return 0.39 * (w.length / list.length) + 11.8 * (syl / w.length) - 15.59;
}

// ---------- jargon ----------
const STOP = new Set("a an the of to in on for and or but is are was were be been being it its this that these those with as by at from into than then so such which who whom what when where how why not no you your we our they their he she his her them us i me my can could will would should may might must do does did done have has had having just only very more most less much many any some each other also about over under between after before up down out off".split(" "));
const stem = (w) => {
  let x = w.toLowerCase();
  for (let k = 0; k < 2; k++) x = x.replace(/(?:ies|es|s|ing|ed|ly)$/, "") || x;
  return x.slice(0, 6);
};
const EXPLAIN = /\b(?:means|refers to|stands for|is called|that'?s called|which means|that means|this means|meaning|in (?:simple|plain|other) words|basically|simply put|is (?:just|basically|simply|when|like)|are (?:just|basically|simply|when|like)|think of|imagine|like a|sort of|kind of|a fancy (?:word|name|term)|fancy way|is what you get|that is,|i\.e\.)/i;

function termRegex(term) {
  const esc = String(term).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+");
  return new RegExp(`\\b${esc}(?:e?s)?\\b`, "i");
}

/**
 * First use of each glossary term in the script must come with its plain meaning in the same or
 * the next sentence: either half of the plain phrase's content words appear there, or an
 * explanation marker ("which means", "think of", "basically"...) plus at least one of them.
 * sentences: flat list [{id, text}] in script order.
 */
function jargonProblems(sentences, glossary) {
  const problems = [];
  for (const g of glossary || []) {
    if (!g || !g.term) continue;
    const re = termRegex(g.term);
    const idx = sentences.findIndex((s) => re.test(s.text));
    if (idx < 0) continue;
    const plainWords = [...new Set(words(g.plain).map((w) => w.toLowerCase()).filter((w) => !STOP.has(w) && w.length > 2).map(stem))];
    const termStems = new Set(words(g.term).map(stem));
    const want = plainWords.filter((w) => !termStems.has(w));
    const windowText = [sentences[idx], sentences[idx + 1]].filter(Boolean).map((s) => s.text.replace(re, " ")).join(" ");
    const have = new Set(words(windowText).map(stem));
    const hits = want.filter((w) => have.has(w)).length;
    const ratio = want.length ? hits / want.length : 1;
    // "EBITDA is ...", "A current account deficit means ..." also introduce a definition
    const defines = new RegExp(`${termRegex(g.term).source}\\s+(?:is|are|means|refers)\\b`, "i");
    const next = sentences[idx + 1];
    const marker = EXPLAIN.test(windowText) || [sentences[idx], next].filter(Boolean).some((s) => defines.test(s.text)) ||
      Boolean(next && /^(?:that|this|it)(?:'s|’s| is| means)\b/i.test(next.text.trim()));
    if (!(ratio >= 0.5 || (marker && hits >= 1) || (marker && want.length <= 1))) {
      problems.push(`jargon "${g.term}" first appears in ${sentences[idx].id} without its plain meaning ("${g.plain}") in the same or next sentence`);
    }
  }
  return problems;
}

// ---------- tone / policy ----------
const ADVICE = /\b(?:you should (?:buy|sell|invest|avoid)|(?:buy|sell) (?:this|the|these) (?:stock|share|bond|commodit)|good (?:time|moment) to (?:buy|sell|invest)|guaranteed returns?|can'?t lose|sure-?shot|multibagger|target price)\b/i;
const LOADED = /\b(?:failed state|rogue state|terrorist (?:state|nation)|beggar(?:s|ly)?|bankrupt nation|evil|traitors?|enemy nation|backward country|third[- ]world)\b/i;

/**
 * Keep a cited fact id only when the sentence actually uses it: a number matched it, or the
 * sentence shares 2+ content words with the fact's claim. Number-gate matches are always kept.
 */
function relevantFactIds(sentence, matched, dossier) {
  const facts = Object.fromEntries(((dossier && dossier.facts) || []).map((f) => [f.id, f]));
  const content = (t) => words(t).filter((w) => !STOP.has(w.toLowerCase()) && w.length > 2).map(stem);
  const have = new Set(content(sentence.text));
  const keep = new Set(matched.filter((id) => facts[id]));
  for (const id of sentence.factIds || []) {
    const f = facts[id];
    if (!f || keep.has(id)) continue;
    if (new Set(content(f.claim).filter((w) => have.has(w))).size >= 2) keep.add(id);
  }
  return [...keep];
}

/**
 * Check one section's sentences. Mutates each sentence's factIds (adds ids the number gate matched).
 * opts: {dossier, glossary, allSentences (script order, for jargon), wordBudget?, isFirst?}
 */
function sectionProblems(section, opts = {}) {
  const sents = section.sentences || [];
  const problems = [];
  if (!sents.length) return ["section has no sentences"];
  const quotesForLen = (opts.dossier && opts.dossier.quotes) || [];
  const factIdSet = new Set(((opts.dossier && opts.dossier.facts) || []).map((f) => f.id));
  const ids = new Set();
  let figureCount = 0;
  sents.forEach((s, i) => {
    if (!s.id) s.id = `${section.id || "s"}-${i + 1}`;
    if (ids.has(s.id)) problems.push(`duplicate sentence id ${s.id}`);
    ids.add(s.id);
    // a verified verbatim quote counts as one unit: its length is the speaker's, not ours
    const n = words(quotesForLen.length ? stripVerifiedQuotes(s.text, quotesForLen) : s.text).length + (quotesForLen.length && stripVerifiedQuotes(s.text, quotesForLen) !== s.text ? 1 : 0);
    if (n > MAX_WORDS) problems.push(`${s.id} has ${n} words (max ${MAX_WORDS}); split it: "${s.text.slice(0, 70)}..."`);
    // verified verbatim quotes (style.js) are the speaker's words: their numbers are not ours to gate
    const quotes = (opts.dossier && opts.dossier.quotes) || [];
    const r = checkSentenceNumbers(quotes.length ? { ...s, text: stripVerifiedQuotes(s.text, quotes) } : s, opts.dossier);
    r.problems.forEach((p) => problems.push(`${s.id}: ${p}`));
    s.factIds = relevantFactIds(s, r.factIds.filter((id) => factIdSet.has(id)), opts.dossier);
    const figures = r.numbers.filter((x) => !isExempt(x) && !x.year);
    figures.forEach((x) => {
      const dec = (x.text.match(/\bpoint((?: [a-z]+)+)/) || [])[1];
      const decDigits = dec ? dec.trim().split(" ").filter((w) => !/^(percent|per|cent|billion|million|trillion|crore|lakh|thousand)$/.test(w)) : [];
      if (decDigits.length > 1) problems.push(`${s.id}: "${x.text}" is too precise to hear; round it (e.g. "about ${x.text.replace(/ point.*/, "")}...")`);
    });
    if (figures.length > MAX_FIGURES_PER_SENTENCE) problems.push(`${s.id} packs ${figures.length} figures into one sentence (max ${MAX_FIGURES_PER_SENTENCE}); spread them out or drop the least important`);
    figureCount += figures.length;
    if (ADVICE.test(s.text)) problems.push(`${s.id} reads as investment advice; explain, do not recommend`);
    if (LOADED.test(s.text)) problems.push(`${s.id} uses a loaded label; describe decisions and numbers neutrally`);
  });
  const totalWords = sents.reduce((a, s) => a + words(s.text).length, 0);
  if (totalWords && (figureCount / totalWords) * 100 > MAX_FIGURES_PER_100_WORDS) {
    problems.push(`section says ${figureCount} figures in ${totalWords} words; keep the few that drive the story (max about ${Math.floor((totalWords * MAX_FIGURES_PER_100_WORDS) / 100)}) and say the rest qualitatively`);
  }
  const grade = fkGrade(sents);
  if (grade > FK_MAX) {
    const cost = (t) => { const w = words(t); return (w.reduce((a, x) => a + syllables(x), 0) / Math.max(1, w.length)) * Math.sqrt(w.length); };
    const hardest = [...sents].sort((a, b) => cost(b.text) - cost(a.text)).slice(0, 3).map((x) => x.id);
    problems.push(`Flesch-Kincaid grade ${grade.toFixed(1)} > ${FK_MAX}: use shorter sentences and everyday words; hardest: ${hardest.join(", ")}`);
  }
  narrativeProblems(opts.isFirst ? sents : [{ id: "_", text: "x" }, ...sents])
    .filter((p) => !/sentence _ /.test(p))
    // finance uses "guarantee" as a noun (personal / sovereign guarantee, a guaranteed return as a contract term)
    .filter((p) => {
      const m = p.match(/^sentence (\S+) makes an absolute outcome claim/);
      if (!m) return true;
      const t = (sents.find((x) => x.id === m[1]) || {}).text || "";
      return !/guarantee/i.test(t) || /\b(?:eliminat|will always|never (?:fail|happen))/i.test(t);
    })
    .forEach((p) => problems.push(p));
  if (opts.wordBudget) {
    const n = sents.reduce((a, s) => a + words(s.text).length, 0);
    const [loF, hiF] = opts.wordSlack || [0.8, 1.2];
    const lo = Math.round(opts.wordBudget * loF), hi = Math.round(opts.wordBudget * hiF);
    if (n < lo || n > hi) problems.push(`section has ${n} words; target ${opts.wordBudget} (${lo}-${hi})`);
  }
  if (opts.glossary && opts.allSentences) {
    // only report jargon whose first use lies in this section
    const mine = new Set(sents.map((s) => s.id));
    jargonProblems(opts.allSentences, opts.glossary)
      .filter((p) => { const m = p.match(/first appears in (\S+) /); return m && mine.has(m[1]); })
      .forEach((p) => problems.push(p));
  }
  return problems;
}

module.exports = { relevantFactIds, fkGrade, jargonProblems, sectionProblems, words, FK_MAX, MAX_WORDS, termRegex };
