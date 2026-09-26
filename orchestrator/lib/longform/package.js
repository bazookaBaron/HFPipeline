"use strict";

/**
 * Long-form packaging (plan §9), pure functions (make-longform.js does the I/O):
 *   captions.srt   from each chapter's timeline words, offset by the chapter's start in the stitch
 *   description.md hook paragraph, YouTube chapter timestamps, sources, image credits, disclaimer
 *   metadata.json  3 title options (+ tags); deterministic variants when Gemini is unavailable
 *   chapter rules  YouTube: first chapter at 0:00, >= 3 chapters, each >= 10 s
 */

const CAPTION = { maxChars: 84, lineChars: 42, maxDur: 6.0, minDur: 0.8, gap: 0.05 };

/** 3.456 -> "00:00:03,456" */
function srtTime(t) {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

/** YouTube chapter timestamp: 0:00, 1:05, 1:02:03 (floored to the second) */
function ytTime(t) {
  const s = Math.max(0, Math.floor(t + 1e-6));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function wrap2(text, n = CAPTION.lineChars) {
  if (text.length <= n) return text;
  const words = text.split(" ");
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const score = Math.max(a.length, b.length);
    if (!best || score < best.score) best = { a, b, score };
  }
  return best ? `${best.a}\n${best.b}` : text;
}

/**
 * Caption cues from word timings. chapters: [{start, words: [{text, start, end, sentenceId}]}] with
 * words in chapter-local seconds. A cue never spans two sentences; a sentence longer than 84 chars
 * (2 x 42) or 6 s is split into balanced parts (no orphaned last word), preferring a break after
 * punctuation near each balance point.
 * @returns {{i, start, end, text}[]}
 */
function buildCues(chapters) {
  const cues = [];
  for (const ch of chapters) {
    const sentences = [];
    for (const w of ch.words || []) {
      const text = String(w.text || "").trim();
      if (!text) continue;
      const last = sentences[sentences.length - 1];
      const word = { text, start: Number(w.start) + ch.start, end: Number(w.end) + ch.start };
      if (last && last.id === w.sentenceId) last.words.push(word);
      else sentences.push({ id: w.sentenceId, words: [word] });
    }
    for (const s of sentences) {
      const len = s.words.map((w) => w.text).join(" ").length;
      const dur = s.words[s.words.length - 1].end - s.words[0].start;
      const k = Math.min(s.words.length, Math.max(1, Math.ceil(len / CAPTION.maxChars), Math.ceil(dur / CAPTION.maxDur)));
      // cumulative char offsets -> k balanced parts; nudge each cut to a nearby punctuation break
      const cum = [];
      let acc = 0;
      s.words.forEach((w) => cum.push((acc += w.text.length + 1)));
      const cuts = [];
      for (let j = 1; j < k; j++) {
        const target = (acc * j) / k;
        let best = cum.findIndex((c) => c >= target);
        for (let d = -3; d <= 3; d++) {
          const x = best + d;
          if (x > (cuts[cuts.length - 1] ?? -1) && x < s.words.length - 1 && /[,;:]$/.test(s.words[x].text)) {
            best = x;
            break;
          }
        }
        best = Math.max((cuts[cuts.length - 1] ?? -1) + 1, Math.min(best, s.words.length - 2));
        cuts.push(best);
      }
      let from = 0;
      for (const c of cuts.concat([s.words.length - 1])) {
        const part = s.words.slice(from, c + 1);
        if (part.length) cues.push({ start: part[0].start, end: part[part.length - 1].end, text: part.map((w) => w.text).join(" ") });
        from = c + 1;
      }
    }
  }
  // tidy: minimum display time without overlapping the next cue
  for (let i = 0; i < cues.length; i++) {
    const next = cues[i + 1];
    const want = Math.max(cues[i].end, cues[i].start + CAPTION.minDur);
    cues[i].end = next ? Math.min(want, next.start - CAPTION.gap) : want;
    if (cues[i].end <= cues[i].start) cues[i].end = cues[i].start + 0.2;
    cues[i].i = i + 1;
  }
  return cues;
}

function srt(cues) {
  return cues.map((c) => `${c.i}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${wrap2(c.text)}\n`).join("\n");
}

/** problems with a cue list: order, overlap, bounds */
function cueProblems(cues, duration) {
  const P = [];
  cues.forEach((c, i) => {
    if (!(c.end > c.start)) P.push(`cue ${c.i}: end <= start`);
    if (i && c.start < cues[i - 1].end - 1e-6) P.push(`cue ${c.i} overlaps cue ${cues[i - 1].i}`);
    if (c.end > duration + 0.05) P.push(`cue ${c.i} ends after the video (${c.end.toFixed(2)} > ${duration.toFixed(2)})`);
    if (c.text.length > CAPTION.maxChars + 20) P.push(`cue ${c.i} is ${c.text.length} chars`);
  });
  return P;
}

/**
 * YouTube chapter rules. list: [{title, start}] in video order.
 * complete = false (a --chapters subset) still reports, the caller decides whether it is hard.
 */
function chapterRules(list, duration) {
  const P = [];
  if (!list.length) return ["no chapters"];
  if (Math.floor(list[0].start + 1e-6) !== 0) P.push(`first chapter starts at ${ytTime(list[0].start)}, must be 0:00`);
  if (list.length < 3) P.push(`${list.length} chapter(s); YouTube needs at least 3`);
  list.forEach((c, i) => {
    const end = i + 1 < list.length ? list[i + 1].start : duration;
    if (end - c.start < 10) P.push(`chapter "${c.title}" is ${(end - c.start).toFixed(1)} s (min 10 s)`);
    if (i && Math.floor(c.start) <= Math.floor(list[i - 1].start)) P.push(`chapter "${c.title}" timestamp is not after the previous one`);
  });
  return P;
}

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

/**
 * @param {{outline, script, dossier, chapters: [{id, title, start}], credits: string, topic}} o
 */
function descriptionMd(o) {
  const { outline, dossier, chapters } = o;
  const cold = (outline && outline.coldOpen) || {};
  const lines = [];
  const title = clean((outline && outline.title) || o.topic);
  lines.push(`# ${title}`, "");
  const hook = [clean(cold.hook), clean(cold.promise)].filter(Boolean).join(" ");
  if (hook) lines.push(hook, "");
  lines.push("## Chapters", "");
  chapters.forEach((c) => lines.push(`${ytTime(c.start)} ${c.title}`));
  lines.push("");
  const sources = (dossier && dossier.sources) || [];
  if (sources.length) {
    lines.push("## Sources", "");
    const seen = new Set();
    sources.forEach((s) => {
      const url = String(s.url || "").trim();
      if (!url || seen.has(url)) return;
      seen.add(url);
      lines.push(`- ${clean(s.title) || url}: ${url}`);
    });
    lines.push("");
  }
  const credits = String(o.credits || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^image credits$/i.test(l));
  if (credits.length) {
    lines.push("## Image credits", "");
    credits.forEach((l) => lines.push(`- ${l.replace(/^\[[^\]]+\]\s*/, "")}`));
    lines.push("");
  }
  lines.push("---", "", "Not financial advice. This video is for education and entertainment only; figures are rounded and come from the public sources listed above. Illustrations marked \"AI-generated\" are not photographs.", "");
  return lines.join("\n");
}

/** deterministic title variants (no model): the outline title + two patterned ones, each <= 100 chars */
function titleOptions(outline, topic) {
  const t = clean((outline && outline.title) || topic);
  const subject = clean(topic).replace(/^(why|how)\s+/i, "").replace(/\?$/, "");
  const opts = [t, `${subject.charAt(0).toUpperCase()}${subject.slice(1)}: The Full Story, Explained Simply`, `The Rise and Fall Nobody Saw Coming | ${subject.replace(/\s+went bankrupt$/i, "")}`];
  const seen = new Set();
  return opts.map((x) => (x.length > 100 ? x.slice(0, 97).replace(/\s+\S*$/, "") + "..." : x)).filter((x) => (seen.has(x.toLowerCase()) ? false : seen.add(x.toLowerCase())));
}

function tagsFor(dossier, topic) {
  const tags = new Set();
  ((dossier && dossier.entities) || []).slice(0, 10).forEach((e) => tags.add(clean(e.name)));
  clean(topic)
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .forEach((w) => tags.add(w.toLowerCase()));
  ["business explained", "finance explained", "india business", "case study"].forEach((t) => tags.add(t));
  return [...tags].slice(0, 20);
}

module.exports = { srtTime, ytTime, buildCues, srt, cueProblems, chapterRules, descriptionMd, titleOptions, tagsFor, wrap2, CAPTION };
