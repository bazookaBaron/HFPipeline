"use strict";

/**
 * Cold-open MONTAGE (long-form v2 plan section 2, workstream E): a 25-35 s trailer-style open that plays
 * BEFORE the cold-open chapter. Technique copied from the reference, assets are only our own:
 *
 *   chorus   3-5 short narrator lines, each on a kinetic text slam (paper background, our type, one accent
 *            word) or over one of our licensed photos, with a one-beat "stinger" cut after each line;
 *   run      8-12 shots of ONE beat each, cut on the trailer bed's beat grid, whoosh on every cut, one
 *            flash burst: punch-in crops of the most striking rendered chapter moments (maps, big numbers,
 *            charts, stamps -- picked from each chapter's timeline scaffolds/modules) and licensed photos;
 *   anchor   one authoritative line (a verified dossier quote, else the thesis line) held 5-8 s, impact
 *            on the cut; then the bass drops out for ~1.3 s and the video cuts straight into the cold-open
 *            chapter (no title card).
 *
 * Audio: a trailer bed from the free library (musicPlan.pickTrailer) or a seeded procedural trailer
 * (tools/montage_audio.py), -4 dB under the voice, whooshes/impacts/riser synthesised or from
 * video-engine/assets/sfx. The montage segment carries its OWN premixed audio; the master stage lays the
 * section music only after it (stitch.musicAndMaster head) and masters the whole to -14 LUFS.
 *
 * Pure planning functions are exported for tests; buildMontage() does the I/O (voice, frames, render).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync, execFileSync } = require("child_process");

const VERSION = "montage.1";
const W = 1920;
const H = 1080;
const FPS = 30;
const REPO = path.resolve(__dirname, "..", "..", "..");
const VIDEO_ENGINE = path.join(REPO, "video-engine");
const TOOLS = path.join(__dirname, "..", "..", "tools");

const BAND = { minSeconds: 25, maxSeconds: 35, minCuts: 18, runShots: [8, 12], chorus: [3, 5], anchorHold: [5, 8], beat: [0.45, 0.75] };
const DROP_S = 1.3;
const MIN_REAL = 6; // fewer licensed photos than this -> fal hero shots (draft tier, <= 3) // bass drop-out tail at the end of the anchor
const PROC_BPM = 96;

const r3 = (x) => Math.round(x * 1000) / 1000;
const hash = (v) => crypto.createHash("sha256").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex").slice(0, 16);
const hash01 = (s) => parseInt(crypto.createHash("sha1").update(String(s)).digest("hex").slice(0, 8), 16) / 0xffffffff;

// ------------------------------------------------------------------ lines

const NUMBER_WORDS = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|percent|half|double|triple)\b/i;
const DRAMA = /\b(default|defaults|defaulted|collapse|crash|crashed|crisis|ruin|ruined|never|nobody|debt|bankrupt|broke|disaster|war|dead|died|panic|lost|vanish|vanished|irony|secret|trap|poison|fell|fail|failed|runs? out)\b/i;
const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean);

/** number-ish tokens a line carries (digits and spelled-out numbers), lower-cased */
function numberTokens(text) {
  return words(text)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9.-]/g, "").replace(/[.-]+$/, ""))
    .filter((w) => /\d/.test(w) || NUMBER_WORDS.test(w));
}

/**
 * Deterministic montage lines from a script that has no montageLines (scripts before lf-script.v2):
 * chorus = the punchiest short sentences of the BODY chapters (numbers, drama words, questions; never the
 * cold open, which plays right after the montage), anchor = the dossier's first verified quote, else the
 * cold open's strongest sentence (the thesis) -- all verbatim script text, so no new claims.
 * @returns {{chorus: {text, source}[], anchor: {text, source, quote?}}}
 */
function deriveLines(script, dossier = {}, { chorus = 5 } = {}) {
  const secs = (script && script.sections) || [];
  const body = secs.filter((s) => s.id !== "cold" && s.id !== "recap");
  const pool = [];
  body.forEach((s, si) =>
    (s.sentences || []).forEach((x, i) => {
      const text = String(typeof x === "string" ? x : x.text || "").trim();
      const n = words(text).length;
      if (n < 3 || n > 10 || LOADED.test(text)) return;
      let score = 0;
      if (numberTokens(text).length) score += 3;
      if (DRAMA.test(text)) score += 2;
      if (/\?$/.test(text)) score += 1.5;
      if (n <= 7) score += 1.5;
      if (n <= 5) score += 1;
      if (/^(that|this|these|it|they|he|she)\b/i.test(text)) score -= 3; // needs its previous sentence
      score += 0.3 * hash01(`${s.id}|${i}`);
      pool.push({ text, source: `${s.id}.s${i + 1}`, score, si });
    })
  );
  pool.sort((a, b) => b.score - a.score);
  const picked = [];
  const perSection = {};
  for (const p of pool) {
    if (picked.length >= chorus) break;
    if ((perSection[p.si] || 0) >= 2) continue; // spread over the chapters
    perSection[p.si] = (perSection[p.si] || 0) + 1;
    picked.push({ text: p.text, source: p.source });
  }
  // story order (chapter, sentence): the chorus escalates like the video does
  picked.sort((a, b) => a.source.localeCompare(b.source, "en", { numeric: true }));
  let anchor = null;
  const q = ((dossier && dossier.quotes) || []).find((x) => x && x.text && x.verified !== false && words(x.text).length <= 26);
  if (q) anchor = { text: q.text, source: q.id || "quote", quote: { speaker: q.speaker || q.by || null, source: q.source || q.outlet || null } };
  if (!anchor) {
    // the conclusion (recap) states the thesis; the cold open comes last: it plays seconds later
    const used = new Set(picked.map((p) => p.text));
    const order = [...secs.filter((s) => s.id === "recap"), ...body, ...secs.filter((s) => s.id === "cold")];
    const cands = [];
    order.forEach((s, oi) =>
      (s.sentences || []).forEach((x) => {
        const t = String(typeof x === "string" ? x : x.text || "").trim();
        const n = words(t).length;
        if (n < 7 || n > 16 || used.has(t) || LOADED.test(t) || /\?$/.test(t) || /^(that|this|these|it|they)\b/i.test(t)) return;
        const sc = (/\b(yet|but|irony|while|until|when)\b/i.test(t) ? 2 : 0) + (DRAMA.test(t) ? 2 : 0) + (numberTokens(t).length ? 0.5 : 0) - oi * 0.6 - (s.id === "cold" ? 3 : 0) + 0.2 * hash01(t);
        cands.push({ t, sc, id: s.id });
      })
    );
    const best = cands.sort((a, b) => b.sc - a.sc)[0];
    if (best) anchor = { text: best.t, source: best.id };
  }
  return { chorus: picked, anchor };
}

/** montage lines from an lf-script.v2 script (montageLines + anchorLine), dossier quotes resolved */
function scriptLines(script, dossier = {}) {
  const ml = (script && script.montageLines) || [];
  if (ml.length < BAND.chorus[0] || !(script.anchorLine && script.anchorLine.text)) return null;
  const chorus = ml.slice(0, BAND.chorus[1]).map((l, i) => ({ text: String(l.text || l).trim(), source: `montageLines[${i}]` }));
  const a = script.anchorLine;
  const q = a.quoteId ? ((dossier && dossier.quotes) || []).find((x) => x.id === a.quoteId) : null;
  return { chorus, anchor: { text: String(a.text).trim(), source: a.quoteId || "anchorLine", ...(q ? { quote: { speaker: q.speaker || q.by || null, source: q.source || q.outlet || null } } : {}) } };
}

/** ONE lite call (optional): condense the script into chorus + anchor; numbers must already be in the script */
function linesPrompt(script) {
  const text = (script.sections || []).map((s) => `[${s.id}] ${(s.sentences || []).map((x) => (typeof x === "string" ? x : x.text)).join(" ")}`).join("\n");
  return `You write the 25-second cold-open MONTAGE of a documentary explainer (a trailer: fast cuts, a narrator's short punchy lines, then one line held on screen).
From the script below write:
- "chorus": 5 lines, each 2-6 words, spoken by the narrator over hard cuts. Fragments are fine ("Farm giant. Serial defaulter."). Escalate. Do NOT reuse the cold open's first sentence.
- "anchor": 1 line of 7-12 words that closes the montage: the video's central QUESTION (preferred, e.g. "Why does a country this rich keep going broke?") or its neutral thesis.
Each chorus line MUST be 2-6 words. The anchor MUST be 7-12 words.
Rules: use ONLY facts and numbers that appear in the script; numbers spelled as words; no hashtags, no emojis.
Stay neutral and factual: state what happened, never judge who is to blame. No blame or loaded adjectives (relentless, reckless, greedy, corrupt, incompetent, irresponsible, shameless, wasteful ...).
Return JSON {"chorus": ["...", ...], "anchor": "..."}.

SCRIPT
${text}`;
}

/** editorial / blame wording that a neutral explainer montage must not put on screen */
const LOADED = /\b(relentless(ly)?|reckless(ly)?|greed(y|ily)?|corrupt(ion|ed)?|incompeten(t|ce)|irresponsib(le|ly)|shameless(ly)?|wasteful(ly)?|foolish(ly)?|stupid(ity)?|lazy|arrogan(t|ce)|careless(ly)?|thiev(es|ing)|crooks?|looters?|blame[ds]?)\b/i;

function validateLlmLines(raw, script) {
  const all = (script.sections || []).flatMap((s) => (s.sentences || []).map((x) => (typeof x === "string" ? x : x.text))).join(" ");
  const known = new Set(numberTokens(all));
  const ok = (t, lo, hi) => typeof t === "string" && words(t).length >= lo && words(t).length <= hi && numberTokens(t).every((n) => known.has(n)) && !/[#@]/.test(t) && !LOADED.test(t);
  const chorus = ((raw && raw.chorus) || []).map((t) => String(t).trim()).filter((t) => ok(t, 2, 8));
  // cheap grammar guard for the question form: "Why does X keeps ..." (do-support + 3rd-person verb)
  const badDo = (t) => /^(why|how|what|when)\s+(does|do|did)\b/i.test(t) && /\b(keeps|goes|falls|gets|makes|has|runs|ends|borrows|becomes)\b/i.test(t);
  const anchor = raw && ok(String(raw.anchor || "").trim(), 6, 14) && !badDo(String(raw.anchor)) ? String(raw.anchor).trim() : null;
  return { chorus, anchor };
}

// ------------------------------------------------------------------ beat grid

/** montage-time beat grid (seconds, from 0) of a library trailer (track time minus start), extended at bpm */
function montageBeats({ beats = [], bpm = PROC_BPM, start = 0, until = 60 }) {
  const out = beats.map((b) => b - start).filter((b) => b >= -1e-6);
  const period = 60 / (bpm || PROC_BPM);
  if (!out.length) out.push(0);
  while (out[out.length - 1] < until) out.push(out[out.length - 1] + period);
  return out.map(r3);
}

/** first beat >= t (grid assumed sorted); beyond the grid: extrapolate on the last period */
function snapUp(t, grid) {
  for (const b of grid) if (b >= t - 1e-6) return b;
  const p = grid.length > 1 ? grid[grid.length - 1] - grid[grid.length - 2] : 60 / PROC_BPM;
  let b = grid[grid.length - 1];
  while (b < t - 1e-6) b += p;
  return r3(b);
}

/** nearest beat to t */
function snapNearest(t, grid) {
  let best = grid[0];
  for (const b of grid) if (Math.abs(b - t) < Math.abs(best - t)) best = b;
  return best;
}

/** where to start the library track: the phrase whose next ~30 s are loudest (skips quiet intros) */
function trailerStart(track, seconds = 30) {
  const ph = (track.phrases && track.phrases.length ? track.phrases : track.downbeats || []).filter((p) => p >= (track.entry || 0) && p + seconds <= (track.duration || 0) - 2);
  const rms = (track.rms && track.rms.db) || [];
  const hop = (track.rms && track.rms.hop) || 0.5;
  if (!ph.length) return track.entry || 0;
  if (!rms.length) return ph[0];
  const mean = (a, b) => {
    const xs = rms.slice(Math.floor(a / hop), Math.ceil(b / hop));
    return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : -99;
  };
  let best = ph[0];
  for (const p of ph) if (mean(p, p + seconds) > mean(best, best + seconds) + 0.5) best = p;
  return best;
}

// ------------------------------------------------------------------ visual candidates

const MODULE_SCORE = [
  [/map|route|choropleth|globe/i, 5],
  [/bigNumber|stat/i, 4.5],
  [/chart|barRace|bars|pictogram/i, 4],
  [/stamp|document/i, 3.8],
  [/quote|timeline|flow|headline/i, 3.2],
  [/compare|split/i, 2.6],
  [/photo|image|video/i, 2.2],
];
const SKIP_MODULE = /^(lfHeader|lfProgress|lfCredit|lfText|callout|chapterCard|endScreen|recapList)$/;

function moduleScore(type) {
  if (!type || SKIP_MODULE.test(type)) return 0;
  for (const [re, s] of MODULE_SCORE) if (re.test(type)) return s;
  return 1.5;
}

/** 16:9 crop around rect (x, y, w, h) with margin; never smaller than minW (limits the upscale) */
function cropFor(rect, { margin = 0.12, minW = 860 } = {}) {
  let [x, y, w, h] = rect;
  const cx = x + w / 2;
  const cy = y + h / 2;
  w *= 1 + 2 * margin;
  h *= 1 + 2 * margin;
  if (w / h > W / H) h = (w * H) / W;
  else w = (h * W) / H;
  if (w < minW) {
    w = minW;
    h = (minW * H) / W;
  }
  if (w > W) {
    w = W;
    h = H;
  }
  const x0 = Math.min(Math.max(0, cx - w / 2), W - w);
  const y0 = Math.min(Math.max(0, cy - h / 2), H - h);
  return [Math.round(x0), Math.round(y0), Math.round(w), Math.round(h)];
}

/**
 * Striking moments of the rendered chapters: per scaffold its best module (map > number > chart > stamp ...),
 * frame time = when the scene is fully built (scaffold end - 0.5 s, and after its last event), crop = that
 * module's rect. Scenes whose photo slot is unusable (fallback / name card) are skipped.
 * @param chapters [{id, mp4, timeline: {spec: {scaffolds, events}}}]
 * @param manifest media manifest ({slots})
 */
function frameCandidates(chapters, manifest = { slots: {} }, { exclude = ["cold"] } = {}) {
  const out = [];
  for (const ch of chapters) {
    if (exclude.includes(ch.id)) continue;
    const spec = (ch.timeline && ch.timeline.spec) || {};
    const events = spec.events || [];
    (spec.scaffolds || []).forEach((sc, k) => {
      if (/^(lfChapter|lfEnd|lfRecap)$/.test(sc.template)) return;
      const mods = sc.modules || [];
      const bad = mods.some((m) => m.props && m.props.slot && (!manifest.slots[m.props.slot] || /fallback|namecard/.test(manifest.slots[m.props.slot].status)));
      if (bad) return;
      let best = null;
      for (const m of mods) {
        const s = moduleScore(m.type);
        if (s && m.rect && (!best || s > best.s || (s === best.s && m.rect[2] * m.rect[3] > best.m.rect[2] * best.m.rect[3]))) best = { m, s };
      }
      if (!best) return;
      const t0 = Number(sc.t0);
      const t1 = Number(sc.t1);
      if (!(t1 - t0 > 1.5)) return;
      const ids = new Set(mods.map((m) => m.id));
      const lastEv = events.filter((e) => ids.has(e.target) && e.t >= t0 && e.t < t1 && e.op !== "credit").reduce((a, e) => Math.max(a, e.t), t0);
      const t = Math.min(t1 - 0.5, Math.max(t0 + 1.4, lastEv + 0.7));
      const photoSlot = mods.find((m) => m.props && m.props.slot);
      out.push({
        kind: "frame",
        id: `${ch.id}.${k + 1}`,
        chapterId: ch.id,
        mp4: ch.mp4,
        t: r3(t),
        module: best.m.type,
        rect: best.m.rect,
        crop: cropFor(best.m.rect),
        score: best.s + 0.2 * Math.min(3, events.filter((e) => ids.has(e.target) && e.t >= t0 && e.t < t1).length) + 0.3 * hash01(`${ch.id}|${k}`),
        slot: photoSlot ? photoSlot.props.slot : null,
      });
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** generic, no-people photoreal scenes for the montage (fal draft tier); the place is the topic's first proper noun */
function heroScenes(topic) {
  const stop = new Set(["How", "Why", "What", "When", "The", "A", "An", "Is", "Did", "Does", "Who"]);
  const place = (String(topic).match(/\b[A-Z][a-z]+\b/g) || []).find((w) => !stop.has(w)) || "the country";
  return [
    `wide establishing shot of the capital city of ${place} at dusk, government buildings, empty streets`,
    `close-up of ${place} banknotes and coins scattered on a dark wooden desk, shallow depth of field`,
    `empty trading room with screens showing a falling red market chart, night`,
  ];
}

/** usable photos of the manifest (licensed first, then our AI illustrations), only slots the video already uses */
function photoCandidates(manifest = { slots: {} }, usedSlots = null) {
  return Object.entries(manifest.slots || {})
    .filter(([k, e]) => e && e.file && (e.status === "ok" || e.status === "illustration" || e.status === "generated") && (!usedSlots || usedSlots.has(k)) && (!e.kind || /image|photo/.test(e.kind)))
    .map(([k, e]) => ({ kind: "photo", id: k, slot: k, file: e.file, focal: e.focal || null, width: e.width, height: e.height, credit: e.credit || null, ai: e.status !== "ok", score: (e.status === "ok" ? 2 : 1) + 0.5 * hash01(k) }))
    .sort((a, b) => b.score - a.score);
}

// ------------------------------------------------------------------ shot plan

/**
 * Start time of every TEXT word from the voice's word timing (WhisperX tokens can differ from the script
 * words, e.g. "fifty-eight" vs "fifty eight"): equal counts map 1:1, otherwise by relative character offset.
 * @returns [{text, start}] one per text word
 */
function alignWords(text, timing, duration) {
  const tw = words(text);
  const vw = (timing || []).filter((w) => Number.isFinite(w.start));
  if (!vw.length) return tw.map((w, k) => ({ text: w, start: r3((k * duration) / Math.max(1, tw.length)) }));
  if (vw.length === tw.length) return tw.map((w, k) => ({ text: w, start: vw[k].start }));
  const frac = (arr) => {
    const tot = arr.reduce((a, x) => a + x.length + 1, 0);
    let acc = 0;
    return arr.map((x) => {
      const f = acc / tot;
      acc += x.length + 1;
      return f;
    });
  };
  const ft = frac(tw);
  const fv = frac(vw.map((w) => w.text));
  let last = 0;
  return tw.map((w, k) => {
    let best = 0;
    fv.forEach((f, j) => {
      if (Math.abs(f - ft[k]) < Math.abs(fv[best] - ft[k])) best = j;
    });
    last = Math.max(last, vw[best].start);
    return { text: w, start: last };
  });
}

// ------------------------------------------------------------------ on-screen text (numerals, beats)

const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALE_WORDS = { million: "MILLION", billion: "BILLION", trillion: "TRILLION" };
const bare = (w) => String(w).toLowerCase().replace(/[^a-z-]/g, "");
const isNumWord = (w) => {
  const b = bare(w);
  return !!b && b.split("-").every((p) => p in UNITS || p in TENS || p === "hundred" || p === "thousand");
};

/** value of a run of number words ("one hundred thirty-two", "eighteen ninety" -> 1890 as a year) */
function numberValue(run) {
  const parts = run.flatMap((w) => bare(w).split("-")).filter((p) => p !== "and");
  // year: a teen or "twenty" followed by tens ("eighteen ninety", "nineteen eighty-three"), no hundred/thousand
  if (parts.length >= 2 && (UNITS[parts[0]] >= 10 || parts[0] === "twenty") && parts[1] in TENS && !parts.includes("hundred") && !parts.includes("thousand")) {
    const hi = UNITS[parts[0]] !== undefined ? UNITS[parts[0]] : 20;
    return hi * 100 + parts.slice(1).reduce((a, p) => a + (TENS[p] || UNITS[p] || 0), 0);
  }
  let total = 0;
  let cur = 0;
  for (const p of parts) {
    if (p in UNITS) cur += UNITS[p];
    else if (p in TENS) cur += TENS[p];
    else if (p === "hundred") cur = (cur || 1) * 100;
    else if (p === "thousand") {
      total += (cur || 1) * 1000;
      cur = 0;
    }
  }
  return total + cur;
}

/**
 * Spoken words -> on-screen tokens with numerals, each carrying the index of its first spoken word:
 * "one hundred thirty-two billion dollars lost" -> ["$132 BILLION", "LOST"]; "two hundred percent" -> "200%";
 * "one point three billion" -> "1.3 BILLION"; "forty-eight million pounds" -> "£48 MILLION".
 * @returns [{text, i}] (upper case, trailing . , ; : dropped; ? ! kept)
 */
function displayTokens(ws) {
  const out = [];
  const tail = (w) => (/[?!]$/.test(w) ? w.slice(-1) : "");
  let i = 0;
  while (i < ws.length) {
    if (isNumWord(ws[i]) && !(bare(ws[i]) === "one" && !(ws[i + 1] && (isNumWord(ws[i + 1]) || bare(ws[i + 1]) === "point" || bare(ws[i + 1]) in SCALE_WORDS)))) {
      const i0 = i;
      const run = [];
      while (i < ws.length && (isNumWord(ws[i]) || (bare(ws[i]) === "and" && ws[i + 1] && isNumWord(ws[i + 1]) && run.length))) {
        run.push(ws[i]);
        if (/[,.;:?!]$/.test(ws[i])) {
          i++;
          break;
        }
        i++;
      }
      let num = String(numberValue(run));
      if (ws[i] && bare(ws[i]) === "point" && ws[i + 1] && isNumWord(ws[i + 1])) {
        num += "." + String(numberValue([ws[i + 1]]));
        i += 2;
      }
      let scale = "";
      if (ws[i] && bare(ws[i]) in SCALE_WORDS) {
        scale = " " + SCALE_WORDS[bare(ws[i])];
        i++;
      }
      let pre = "";
      let post = "";
      const unit = ws[i] ? bare(ws[i]) : "";
      if (unit === "percent") post = "%";
      else if (unit === "dollars" || unit === "dollar") pre = "$";
      else if (unit === "pounds") pre = "£";
      if (pre || post) i++;
      const last = ws[i - 1] || "";
      out.push({ text: `${pre}${num}${post}${scale}${tail(last)}`, i: i0, number: true });
      continue;
    }
    const w = String(ws[i]).replace(/[.,;:]+$/, "");
    if (w) out.push({ text: w.toUpperCase(), i });
    i++;
  }
  return out;
}

/** on-screen tokens -> slam beats of 1-4 tokens (<= ~16 chars), breaking after a comma, no orphan short tail */
function slamBeats(tokens, words = []) {
  const beats = [];
  let cur = [];
  const len = (c) => c.reduce((a, t) => a + t.text.length + 1, 0);
  tokens.forEach((t, k) => {
    cur.push(t);
    const src = words[t.i] ? String(words[t.i].text || words[t.i]) : "";
    const next = tokens[k + 1];
    const comma = /,$/.test(src) || (next && words[next.i - 1] && /,$/.test(String(words[next.i - 1].text || words[next.i - 1])));
    if (cur.length >= 4 || len(cur) >= 16 || (comma && cur.length >= 1) || (next && next.number && cur.length >= 2) || (t.number && next && len(cur) + next.text.length > 16)) {
      beats.push(cur);
      cur = [];
    }
  });
  if (cur.length) beats.push(cur);
  // an orphan tail ("UP") joins the previous beat when that stays short
  if (beats.length > 1) {
    const lastB = beats[beats.length - 1];
    if (lastB.length === 1 && lastB[0].text.length <= 4 && beats[beats.length - 2].length < 4) beats[beats.length - 2].push(...beats.pop());
  }
  return beats;
}

/** anchor line -> 2-3 phrase chunks (break at commas / conjunctions near the balance points) */
function phraseChunks(ws, n = null) {
  const k = n || (ws.length <= 9 ? 2 : 3);
  if (ws.length <= 3) return [ws.map((_, i) => i)];
  const breaks = [];
  for (let j = 1; j < k; j++) {
    const target = Math.round((ws.length * j) / k);
    let best = target;
    // a comma wins over a conjunction; each searched outward from the balance point (+-3 words)
    const tests = [(x) => /,$/.test(ws[x - 1]), (x) => /^(and|but|because|when|while|yet|so|or|into|until|if)$/i.test(bare(ws[x]))];
    search: for (const ok of tests) {
      for (let d = 0; d <= 3; d++) {
        for (const x of [target - d, target + d]) {
          if (x <= (breaks[breaks.length - 1] || 0) + 1 || x >= ws.length - 1) continue;
          if (ok(x)) {
            best = x;
            break search;
          }
        }
      }
    }
    breaks.push(Math.max((breaks[breaks.length - 1] || 0) + 1, Math.min(best, ws.length - 1)));
  }
  const out = [];
  let s = 0;
  for (const b of [...breaks, ws.length]) {
    out.push(Array.from({ length: b - s }, (_, q) => s + q));
    s = b;
  }
  return out.filter((c) => c.length);
}

/** accent word of a line: a number phrase, else a proper noun, else the longest word (index into words) */
function accentIndex(text) {
  const ws = words(text);
  const clean = (w) => w.replace(/[^A-Za-z0-9'-]/g, "");
  let i = ws.findIndex((w) => /\d/.test(w) || NUMBER_WORDS.test(clean(w)));
  if (i >= 0) return i;
  i = ws.findIndex((w, k) => k > 0 && /^[A-Z][a-z]/.test(clean(w)));
  if (i >= 0) return i;
  let best = 0;
  ws.forEach((w, k) => {
    if (clean(w).length > clean(ws[best]).length) best = k;
  });
  return best;
}

/**
 * The shot list, cut on the beat grid.
 * @param o.lines   {chorus: [{text, duration, words: [{text, start, end}]}], anchor: {text, duration, words, quote?}}
 *                  (duration / word times = the voice clip at final speed, from its first word)
 * @param o.grid    montage-time beats (montageBeats)
 * @param o.downbeats montage-time downbeats (optional; the run and the anchor prefer them)
 * @param o.frames  frameCandidates(); o.photos photoCandidates(); o.heroes [{file}] fal shots (optional)
 * @returns {{duration, shots, voice, sfx, sections, dropAt, cuts}}
 */
function planShots({ lines, grid, downbeats = [], frames = [], photos = [], heroes = [], seed = "montage", runShots = 10, stingers = 1 }) {
  const shots = [];
  const voice = [];
  const sfx = [];
  const lead = 0.08; // the voice starts just after the cut
  const usedFrames = new Set();
  const usedPhotos = new Set();
  // visual queues: frames spread over chapters (round-robin by chapter), photos by score
  const byCh = {};
  frames.forEach((f) => (byCh[f.chapterId] = byCh[f.chapterId] || []).push(f));
  const chIds = Object.keys(byCh);
  const frameQ = [];
  for (let k = 0; frameQ.length < frames.length; k++) chIds.forEach((c) => byCh[c][k] && frameQ.push(byCh[c][k]));
  const photoQ = photos.slice();
  const nextFrame = () => {
    const f = frameQ.find((x) => !usedFrames.has(x.id));
    if (f) usedFrames.add(f.id);
    return f || null;
  };
  const nextPhoto = (preferReal = false, realOnly = false) => {
    const p = ((preferReal || realOnly) && photoQ.find((x) => !usedPhotos.has(x.id) && !x.ai)) || (!realOnly && photoQ.find((x) => !usedPhotos.has(x.id)));
    if (p) usedPhotos.add(p.id);
    return p || null;
  };
  const heroQ = heroes.slice();
  const MAX_AI = 2;
  let angles = 0;
  const visual = (k, preferPhoto) => {
    // alternate chapter frames and REAL photos; then whatever is left (our AI illustrations last), then fal heroes
    const a = preferPhoto ? nextPhoto(true, true) : nextFrame();
    if (a) return a;
    const b = preferPhoto ? nextFrame() : nextPhoto(true, true);
    if (b) return b;
    // then at most MAX_AI of our AI illustrations, alternating with "second angles" (tight, panned crops)
    // of real photos already shown -- trailers re-cut the same picture; a cartoon run reads cheap
    const aiUsed = [...usedPhotos].filter((id) => (photoQ.find((x) => x.id === id) || {}).ai).length;
    const reals = photoQ.filter((x) => !x.ai && usedPhotos.has(x.id));
    const angle = () => {
      if (!reals.length) return null;
      const n = (angles = angles + 1);
      const p = reals[(n - 1) % reals.length];
      const offs = [[0.35, -0.2], [-0.35, 0.15], [0.2, 0.3], [-0.25, -0.3]];
      return { ...p, id: `${p.id}~${n}`, angle: { punch: 1.45 + 0.1 * (n % 2), offset: offs[(n - 1) % offs.length] } };
    };
    if (aiUsed < MAX_AI && (angles >= aiUsed || !reals.length)) {
      const c = nextPhoto(true);
      if (c) return c;
    }
    const g = angle();
    if (g) return g;
    const c = nextPhoto(true);
    if (c) return c;
    const h = heroQ.shift();
    if (h) return { kind: "photo", id: `hero${k}`, file: h.file, focal: null, credit: "AI-generated", ai: true, hero: true };
    // last resort: reuse the best frame (a different crop scale keeps it from looking identical)
    return frames.length ? { ...frames[k % frames.length], reuse: true } : photos.length ? { ...photos[k % photos.length], reuse: true } : null;
  };
  const push = (s) => {
    shots.push({ i: shots.length, ...s, t0: r3(s.t0), t1: r3(s.t1) });
    return shots[shots.length - 1];
  };

  // --- chorus: line shot (slam / over photo) + one-beat stinger after each line
  let t = 0;
  sfx.push({ t: 0, kind: "impact", gainDb: -3 });
  const chorus = lines.chorus.slice(0, BAND.chorus[1]);
  chorus.forEach((ln, i) => {
    const overPhoto = i % 2 === 1 && photoQ.some((p) => !usedPhotos.has(p.id));
    const bg = overPhoto ? nextPhoto(true) : null;
    const end = snapUp(t + lead + ln.duration + 0.18, grid);
    const ai = accentIndex(ln.text);
    const ws = alignWords(ln.text, ln.words, ln.duration).map((w) => ({ text: w.text, t: r3(t + lead + w.start) }));
    // on screen: numerals, 1-4 token beats; each beat = its own hard cut (slam) or a text swap over the photo
    const toks = displayTokens(ws.map((w) => w.text));
    const accTok = Math.max(0, toks.findIndex((x) => x.number) >= 0 ? toks.findIndex((x) => x.number) : toks.findIndex((x) => x.i >= ai) >= 0 ? toks.findIndex((x) => x.i >= ai) : 0);
    const beats = slamBeats(toks, ws).map((b) => b.map((x) => ({ text: x.text, t: ws[x.i].t, accent: toks.indexOf(x) === accTok })));
    if (bg) {
      push({ section: "chorus", line: i, kind: "photoText", t0: t, t1: end, text: ln.text, beats, src: bg.file, focal: bg.focal, credit: bg.credit, ai: bg.ai, slot: bg.slot });
    } else {
      beats.forEach((b, k) => {
        const b0 = k === 0 ? t : Math.max(shots[shots.length - 1].t0 + 0.25, b[0].t - 0.04);
        const b1 = k === beats.length - 1 ? end : Math.max(b0 + 0.25, beats[k + 1][0].t - 0.04);
        push({ section: "chorus", line: i, kind: "slam", t0: b0, t1: b1, text: b.map((x) => x.text).join(" "), tokens: b });
      });
    }
    voice.push({ line: `chorus${i}`, at: r3(t + lead), duration: ln.duration });
    if (i) sfx.push({ t: t, kind: "hit", gainDb: -8 });
    t = end;
    // stinger: one beat (two on the last chorus line, leading into the run)
    const n = Math.max(1, stingers) + (i === chorus.length - 1 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const v = visual(shots.length, (i + k) % 2 === 0);
      if (!v) break;
      const e = snapUp(t + 0.3, grid);
      push({ section: "stinger", ...shotOf(v, t, e) });
      sfx.push({ t, kind: "whoosh", gainDb: -6 });
      t = e;
    }
  });

  // --- beat run: start on a downbeat when one is within a beat, then one beat per shot
  const db = downbeats.filter((d) => d >= t - 1e-6);
  if (db.length && db[0] - t < 0.8 && db[0] > t + 1e-6) {
    // hold the last stinger to the downbeat
    shots[shots.length - 1].t1 = db[0];
    t = db[0];
  }
  const nRun = Math.max(BAND.runShots[0], Math.min(BAND.runShots[1], runShots));
  const flashAt = Math.floor(nRun / 2);
  const runStart = t;
  for (let k = 0; k < nRun; k++) {
    const v = visual(shots.length, k % 2 === 1);
    if (!v) break;
    let e = snapUp(t + 0.3, grid);
    const s = push({ section: "run", ...shotOf(v, t, e), flash: k === flashAt });
    sfx.push({ t, kind: k === flashAt ? "hit" : "whoosh", gainDb: k === flashAt ? -4 : -7 });
    t = e;
    if (!s) break;
  }
  const runEnd = t;
  // riser over the last 2 beats of the run into the anchor impact
  sfx.push({ t: r3(Math.max(runStart, runEnd - 2 * (grid[1] - grid[0] || 0.6))), kind: "riser", until: runEnd, gainDb: -8 });

  // --- anchor: on the next downbeat-or-beat, held 5-8 s, bass drop at the end
  const a = lines.anchor;
  const aStart = t;
  const vAt = aStart + 0.35;
  const hold = Math.min(BAND.anchorHold[1], Math.max(BAND.anchorHold[0], 0.35 + a.duration + 0.9 + DROP_S));
  const snapped = snapNearest(aStart + hold, grid);
  const aEnd = r3(snapped - aStart >= BAND.anchorHold[0] && snapped - aStart <= BAND.anchorHold[1] ? snapped : aStart + hold);
  const aws = alignWords(a.text, a.words, a.duration).map((w) => ({ text: w.text, t: r3(vAt + w.start) }));
  // 2-3 phrase chunks, each appearing on its first spoken word; the key phrase (accent word + its number run) gets the marker
  const chunks = phraseChunks(aws.map((w) => w.text)).map((c) => ({ from: c[0], to: c[c.length - 1], t: aws[c[0]].t }));
  const acc = accentIndex(a.text);
  let k0 = acc;
  let k1 = acc;
  while (k0 > 0 && isNumWord(aws[k0 - 1].text)) k0--;
  while (k1 + 1 < aws.length && (isNumWord(aws[k1 + 1].text) || bare(aws[k1 + 1].text) in SCALE_WORDS) && isNumWord(aws[k1].text)) k1++;
  if (!isNumWord(aws[acc] ? aws[acc].text : "")) {
    // no number: the punchline = the last two words (e.g. "going broke?")
    k0 = Math.max(0, aws.length - 2);
    k1 = aws.length - 1;
  }
  push({ section: "anchor", kind: "anchor", t0: aStart, t1: aEnd, text: a.text, accent: acc, keySpan: [k0, k1], chunks, words: aws, quote: a.quote || null });
  voice.push({ line: "anchor", at: r3(vAt), duration: a.duration });
  sfx.push({ t: aStart, kind: "impact", gainDb: 0 });
  const dropAt = r3(Math.max(vAt + a.duration + 0.2, aEnd - DROP_S));
  const duration = aEnd;
  return {
    duration,
    shots,
    voice,
    sfx: sfx.sort((x, y) => x.t - y.t),
    sections: { chorus: [0, r3(runStart)], run: [r3(runStart), r3(runEnd)], anchor: [r3(aStart), r3(aEnd)] },
    dropAt,
    cuts: shots.length - 1,
    seed,
  };
}

/**
 * planShots() over a few run lengths / stingers-per-line: the first plan without duration / cut-density
 * problems wins (fewest problems otherwise). Deterministic.
 */
function bestPlan(o) {
  let best = null;
  for (const stingers of [1, 2]) {
    for (const runShots of [10, 12, 11, 9, 8]) {
      const plan = planShots({ ...o, runShots, stingers });
      const p = planProblems(plan).length;
      if (!p) return plan;
      if (!best || p < best.p) best = { plan, p };
    }
  }
  return best.plan;
}

/** one visual shot (frame crop / photo) between t0 and t1 with a punch-in */
function shotOf(v, t0, t1) {
  if (v.kind === "frame") {
    const zoomOut = v.reuse ? 1.12 : 1.0;
    return { kind: "frame", t0, t1, src: v.mp4, at: v.t, crop: v.crop, module: v.module, ref: v.id, punch: [1.08 * zoomOut, 1.0 * zoomOut] };
  }
  if (v.angle) return { kind: "photo", t0, t1, src: v.file, focal: v.focal, credit: v.credit, ai: !!v.ai, slot: v.slot || null, ref: v.id, punch: [v.angle.punch, v.angle.punch + 0.1], offset: v.angle.offset };
  return { kind: "photo", t0, t1, src: v.file, focal: v.focal, credit: v.credit, ai: !!v.ai, slot: v.slot || null, ref: v.id, punch: [1.0, 1.1] };
}

/** gate problems of a plan (hard): duration band, cut density, run shot lengths, anchor hold, blank shots */
function planProblems(plan) {
  const p = [];
  if (!(plan.duration >= BAND.minSeconds && plan.duration <= BAND.maxSeconds)) p.push(`duration ${plan.duration.toFixed(2)} s outside ${BAND.minSeconds}-${BAND.maxSeconds}`);
  if (plan.cuts < BAND.minCuts) p.push(`${plan.cuts} cuts < ${BAND.minCuts}`);
  const run = plan.shots.filter((s) => s.section === "run");
  if (run.length < BAND.runShots[0]) p.push(`beat run has ${run.length} shots < ${BAND.runShots[0]}`);
  run.forEach((s) => {
    const d = s.t1 - s.t0;
    if (d < BAND.beat[0] - 0.02 || d > BAND.beat[1] + 0.02) p.push(`run shot ${s.i} lasts ${d.toFixed(2)} s (band ${BAND.beat.join("-")})`);
  });
  const chorus = [...new Set(plan.shots.filter((s) => s.section === "chorus").map((s) => s.line))];
  if (chorus.length < BAND.chorus[0]) p.push(`${chorus.length} chorus lines < ${BAND.chorus[0]}`);
  const an = plan.shots.find((s) => s.section === "anchor");
  if (!an) p.push("no anchor shot");
  else if (an.t1 - an.t0 < BAND.anchorHold[0] - 0.05 || an.t1 - an.t0 > BAND.anchorHold[1] + 0.05) p.push(`anchor held ${(an.t1 - an.t0).toFixed(2)} s (band ${BAND.anchorHold.join("-")})`);
  plan.shots.forEach((s, i) => {
    if (!(s.t1 > s.t0)) p.push(`shot ${i} is empty`);
    if (i && Math.abs(s.t0 - plan.shots[i - 1].t1) > 1e-3) p.push(`gap before shot ${i}`);
    if ((s.kind === "frame" || s.kind === "photo" || s.kind === "photoText") && !s.src) p.push(`shot ${i} has no source`);
  });
  return p;
}

// ------------------------------------------------------------------ package helpers (captions, chapters)

/** montage words (montage time) as a buildCues() chapter: {start: 0, words: [{text, start, end, sentenceId}]} */
function captionChapter(plan, lineWords) {
  const ws = [];
  for (const v of plan.voice) {
    (lineWords[v.line] || []).forEach((w) => ws.push({ text: w.text, start: r3(v.at + w.start), end: r3(v.at + w.end), sentenceId: `montage-${v.line}` }));
  }
  return { start: 0, words: ws };
}

/**
 * YouTube chapters with a montage of `head` s in front: every chapter start shifts by head except the
 * first ("Intro"), which stays at 0:00 and now covers the montage too (YouTube needs 0:00).
 */
function shiftChapters(chapters, head) {
  return chapters.map((c, i) => ({ ...c, start: i === 0 ? 0 : r3(c.start + head) }));
}

// ------------------------------------------------------------------ I/O

function ff(args, log) {
  return new Promise((resolve, reject) => {
    if (log) log(`ffmpeg ${args.join(" ").slice(0, 220)}`);
    const c = spawn("ffmpeg", args, { windowsHide: true });
    let err = "";
    c.stderr.on("data", (d) => (err += d.toString()));
    c.on("error", reject);
    c.on("close", (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-600)}`))));
  });
}
const probeDur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf-8", windowsHide: true }).trim());

/** integrated loudness (LUFS) of a media file's audio, optionally a [ss, ss+t] window */
function integratedLufs(file, { ss = null, t = null } = {}) {
  const args = ["-hide_banner", "-nostats"];
  if (ss !== null) args.push("-ss", String(ss));
  if (t !== null) args.push("-t", String(t));
  args.push("-i", file, "-af", "ebur128", "-f", "null", "-");
  const r = spawnSync("ffmpeg", args, { encoding: "utf-8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  const tail = String(r.stderr || "").split("Summary:").pop();
  const I = /I:\s*(-?[\d.]+) LUFS/.exec(tail);
  const LRA = /LRA:\s*(-?[\d.]+) LU/.exec(tail);
  return { I: I ? Number(I[1]) : null, LRA: LRA ? Number(LRA[1]) : null };
}

/** simple mkdir lock shared with generate-video-v3 --voice-lock (one F5 worker at a time) */
async function withLock(dir, fn, log) {
  if (!dir) return fn();
  for (let i = 0; ; i++) {
    try {
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, "owner.json"), JSON.stringify({ pid: process.pid, at: Date.now(), who: "montage" }));
      break;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      let stale = false;
      try {
        const o = JSON.parse(fs.readFileSync(path.join(dir, "owner.json"), "utf-8"));
        try {
          process.kill(o.pid, 0);
        } catch (_) {
          stale = true;
        }
      } catch (_) {
        stale = i > 20;
      }
      if (stale) fs.rmSync(dir, { recursive: true, force: true });
      else {
        if (i === 0 && log) log("montage: waiting for the voice lock");
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  try {
    return await fn();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** narrator profile (same default as generate-video-v3.js) */
function narratorRef() {
  const dir = path.join(REPO, "voice-pipeline", "voices", "narrator");
  try {
    const prof = JSON.parse(fs.readFileSync(path.join(dir, "profile.json"), "utf-8"));
    if (prof.status === "active" && prof.consent_confirmed && fs.existsSync(path.join(dir, prof.reference_audio))) return { refAudio: path.join(dir, prof.reference_audio), refText: prof.reference_text };
  } catch (_) {}
  return null;
}

/**
 * Voice for each montage line at the chapters' speed: an identical sentence the chapters already voiced is
 * reused (same take, zero TTS); anything else goes through the narrator clone (voice worker, cached by text).
 * @returns {[line]: {file (48 kHz trimmed, final speed), duration, words: [{text, start, end}] (from 0)}}
 */
async function voiceLines({ lines, chapters, speed, dir, lockDir, log }) {
  fs.mkdirSync(dir, { recursive: true });
  const ref = narratorRef();
  const voiceKey = ref ? ref.refAudio : "default";
  // existing chapter takes by exact text
  const takes = {};
  for (const ch of chapters) {
    const runId = ch.timeline && ch.timeline.runId;
    if (!runId) continue;
    const ad = path.join(VIDEO_ENGINE, "assets", "generated", runId);
    if (!fs.existsSync(ad)) continue;
    for (const f of fs.readdirSync(ad).filter((x) => /^s\d+\.txt$/.test(x))) {
      try {
        const k = JSON.parse(fs.readFileSync(path.join(ad, f), "utf-8"));
        const base = path.join(ad, f.replace(/\.txt$/, ""));
        if (k && k.text && fs.existsSync(`${base}.wav`) && fs.existsSync(`${base}.timing.json`) && (k.ttsSpeed === undefined || Number(k.ttsSpeed) === 1)) takes[k.text.trim()] = { wav: `${base}.wav`, timing: `${base}.timing.json` };
      } catch (_) {}
    }
  }
  const out = {};
  const todo = [];
  for (const [id, text] of Object.entries(lines)) {
    const take = takes[text.trim()];
    if (take) out[id] = { raw: take.wav, timing: take.timing, reused: true };
    else {
      const h = hash({ text, voiceKey, v: 1 });
      const wav = path.join(dir, `tts-${h}.wav`);
      const timing = path.join(dir, `tts-${h}.timing.json`);
      out[id] = { raw: wav, timing, reused: false };
      if (!fs.existsSync(wav) || !fs.existsSync(timing)) todo.push({ id, text, wav, timing });
    }
  }
  if (todo.length) {
    log(`montage: synthesising ${todo.length} line(s) with the narrator voice`);
    await withLock(lockDir, async () => {
      const { createVoiceService } = require("../video/voiceService");
      const svc = createVoiceService({ log: () => {} });
      try {
        for (const j of todo) {
          const req = { genText: j.text, outAudio: j.wav, outTiming: j.timing, speed: 1 };
          if (ref) Object.assign(req, ref);
          await svc.synthesize(req);
        }
      } finally {
        await svc.close().catch(() => {});
      }
    }, log);
  }
  // trim to the words + tempo to the chapters' speed, 48 kHz mono
  for (const [id, o] of Object.entries(out)) {
    const tw = JSON.parse(fs.readFileSync(o.timing, "utf-8"));
    const ws = (Array.isArray(tw) ? tw : tw.words || []).map((w) => ({ text: String(w.word || w.text || "").trim(), start: Number(w.start), end: Number(w.end) })).filter((w) => w.text);
    const dur = probeDur(o.raw);
    const a = Math.max(0, (ws.length ? ws[0].start : 0) - 0.04);
    const b = Math.min(dur, (ws.length ? ws[ws.length - 1].end : dur) + 0.14);
    const file = path.join(dir, `${id}.wav`);
    await ff(["-y", "-v", "error", "-i", o.raw, "-af", `atrim=start=${a.toFixed(3)}:end=${b.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${Math.max(0, b - a - 0.03).toFixed(3)}:d=0.03,atempo=${speed},aresample=48000`, "-ac", "1", "-c:a", "pcm_s16le", file]);
    o.file = file;
    o.duration = r3((b - a) / speed);
    o.words = ws.map((w) => ({ text: w.text, start: r3((w.start - a) / speed), end: r3((w.end - a) / speed) }));
  }
  return out;
}

/** trailer bed: library track (pickTrailer) or procedural; returns {music, grid, downbeats} in montage time */
function trailerBed({ index, videoId, MP }) {
  const pick = index && index.tracks && index.tracks.length ? MP.pickTrailer(index, { videoId, seed: videoId, history: MP.readHistory() }) : null;
  if (pick && pick.track && pick.track.mood === "trailer" && pick.beats.length > 16) {
    const start = trailerStart(pick.track, 34);
    const grid = montageBeats({ beats: pick.beats, bpm: pick.bpm, start, until: 60 });
    const downbeats = montageBeats({ beats: pick.downbeats, bpm: pick.bpm / 4, start, until: 60 });
    return { music: { source: "library", id: pick.track.id, path: pick.track.path, start: r3(start), bpm: pick.bpm, credit: pick.track.credit || null }, grid, downbeats };
  }
  const grid = montageBeats({ beats: [], bpm: PROC_BPM, start: 0, until: 60 });
  return { music: { source: "procedural", bpm: PROC_BPM, seed: 7 + Math.floor(hash01(videoId) * 1000) }, grid, downbeats: grid.filter((_, i) => i % 4 === 0) };
}

/**
 * The montage stage. Writes <out>/montage/{montage.json, montage.mp4, ...}; cached by content key.
 * @returns {{file, duration, key, plan, lineWords, credits, problems, stats, reused}}
 */
async function buildMontage({ out, script, dossier, chapters, manifest, usedSlots, index, MP, gemini = null, lockDir = null, force = false, log = () => {}, python = process.env.SFX_PYTHON || "python", videoId = "video", fal = null }) {
  const dir = path.join(out, "montage");
  fs.mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, "montage.json");
  const file = path.join(dir, "montage.mp4");

  // 1. lines: script (lf-script.v2) > saved lines > one lite call > deterministic
  const linesPath = path.join(dir, "lines.json");
  let lines = scriptLines(script, dossier);
  let linesSource = "script";
  if (!lines && fs.existsSync(linesPath)) {
    const saved = JSON.parse(fs.readFileSync(linesPath, "utf-8"));
    if (saved.scriptHash === hash(script.sections)) ({ lines, source: linesSource } = saved);
  }
  if (!lines) {
    const det = deriveLines(script, dossier);
    lines = det;
    linesSource = "deterministic";
    if (gemini) {
      try {
        const raw = await gemini.json(linesPrompt(script), { task: "longform.montage", temperature: 0.4 });
        const v = validateLlmLines(raw, script);
        fs.writeFileSync(path.join(dir, "lines.lite.json"), JSON.stringify({ raw, valid: v }, null, 1));
        if (v.chorus.length >= 2) {
          // top up with the shortest deterministic lines when the model's lines fail the checks
          const chorusL = v.chorus.slice(0, BAND.chorus[1]).map((t, i) => ({ text: t, source: `lite${i}` }));
          const extra = det.chorus.filter((d) => !chorusL.some((c) => c.text === d.text)).sort((a, b) => words(a.text).length - words(b.text).length);
          while (chorusL.length < 4 && extra.length) chorusL.push(extra.shift());
          lines = { chorus: chorusL, anchor: v.anchor ? { text: v.anchor, source: "lite" } : det.anchor };
          linesSource = "lite";
        } else log(`montage: lite lines rejected (${v.chorus.length} valid chorus lines); deterministic lines`);
      } catch (err) {
        log(`montage: lite line call failed (${String(err.message).slice(0, 120)}); deterministic lines`);
      }
    }
    fs.writeFileSync(linesPath, JSON.stringify({ scriptHash: hash(script.sections), source: linesSource, lines }, null, 1));
  }
  if (!lines.anchor || lines.chorus.length < BAND.chorus[0]) throw new Error(`montage: not enough lines (${lines.chorus.length} chorus, anchor ${lines.anchor ? "yes" : "no"})`);

  // 2. bed + beat grid
  const bed = trailerBed({ index, videoId, MP });
  let frames = frameCandidates(chapters, manifest);
  const photos = photoCandidates(manifest, usedSlots);
  const speed = (chapters.find((c) => c.id === "cold") || chapters[0] || {}).timeline?.speed || 1;
  const toolsHash = hash(["montage_render.py", "montage_audio.py"].map((f) => fs.existsSync(path.join(TOOLS, f)) ? fs.readFileSync(path.join(TOOLS, f), "utf-8") : ""));
  const key = hash({ v: VERSION, lines, bed: bed.music, frames: frames.map((f) => [f.id, f.t, f.crop, fs.existsSync(f.mp4) ? fs.statSync(f.mp4).size : 0]), photos: photos.map((p) => [p.id, p.file]), speed, toolsHash });
  if (!force && fs.existsSync(file) && fs.existsSync(jsonPath)) {
    const prev = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    if (prev.key === key && prev.ok) return { ...prev, file, reused: true };
  }

  // 2b. look at the candidate moments: a crop that is mostly empty paper (a chart caught before its bars
  // draw, a card between states) is dropped; busy crops rank higher
  const stills = path.join(dir, "stills");
  fs.mkdirSync(stills, { recursive: true });
  const stillOf = (f) => path.join(stills, `${String(f.id).replace(/[^\w.-]/g, "_")}@${f.t}.png`);
  frames = frames.slice(0, 40);
  for (const f of frames) if (!fs.existsSync(stillOf(f))) await ff(["-y", "-v", "error", "-ss", String(f.t), "-i", f.mp4, "-frames:v", "1", stillOf(f)]);
  const scoreList = path.join(dir, "score-list.json");
  fs.writeFileSync(scoreList, JSON.stringify(frames.map((f) => ({ id: f.id, image: stillOf(f), crop: f.crop }))));
  const sc = spawnSync(python, [path.join(TOOLS, "montage_render.py"), "--score", scoreList], { encoding: "utf-8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (sc.status === 0) {
    const m = JSON.parse(String(sc.stdout).trim().split(/\r?\n/).pop());
    const before = frames.length;
    frames = frames
      .map((f) => ({ ...f, look: m[f.id] || null }))
      .filter((f) => !f.look || f.look.error || (f.look.ink >= 0.14 && !(f.look.halfPaper >= 0.99)))
      .map((f) => ({ ...f, score: f.score + (f.look && f.look.ink ? Math.min(1.5, f.look.ink * 3) : 0) }))
      .sort((a, b) => b.score - a.score);
    if (frames.length < before) log(`montage: dropped ${before - frames.length} near-empty chapter moment(s)`);
  } else log(`montage: crop scoring failed (${(sc.stderr || "").slice(-200)}); using the timeline ranking`);

  // 3. voice
  const lineText = {};
  lines.chorus.forEach((l, i) => (lineText[`chorus${i}`] = l.text));
  lineText.anchor = lines.anchor.text;
  const voiced = await voiceLines({ lines: lineText, chapters, speed, dir: path.join(dir, "voice"), lockDir, log });
  const lineWords = Object.fromEntries(Object.entries(voiced).map(([k, v]) => [k, v.words]));
  log(`montage: lines (${linesSource}) ${Object.entries(voiced).map(([k, v]) => `${k} ${v.duration.toFixed(2)} s${v.reused ? " (reused take)" : ""}`).join(", ")}`);

  // 4. heroes (fal draft tier) only when our own media is thin
  // (fewer than MIN_REAL licensed photos: up to 3 generic, no-people photoreal scenes; they rank after
  // the real photos and before our illustrations, credited as AI-generated)
  let heroes = [];
  let photoList = photos;
  const real = photos.filter((p) => !p.ai).length;
  if (real < MIN_REAL && fal) {
    try {
      heroes = await fal({ count: Math.min(3, MIN_REAL - real), prompts: heroScenes(script.topic || videoId).slice(0, Math.min(3, MIN_REAL - real)), dir: path.join(dir, "heroes") });
      const hp = heroes.map((h, k) => ({ kind: "photo", id: `hero${k}`, slot: null, file: h.file, focal: null, credit: "Image: AI-generated", ai: false, hero: true, score: 1.5 }));
      photoList = [...photos.filter((p) => !p.ai), ...hp, ...photos.filter((p) => p.ai)];
      log(`montage: ${heroes.length} fal hero shot(s) (only ${real} licensed photo(s)), $${heroes.reduce((a, h) => a + (h.cost || 0), 0).toFixed(3)}`);
    } catch (err) {
      log(`montage: fal hero shots failed (${String(err.message).slice(0, 120)})`);
    }
  }

  // 5. plan (planner lines carry voice durations + word times)
  const planLines = {
    chorus: lines.chorus.map((l, i) => ({ text: l.text, duration: voiced[`chorus${i}`].duration, words: voiced[`chorus${i}`].words })),
    anchor: { text: lines.anchor.text, duration: voiced.anchor.duration, words: voiced.anchor.words, quote: lines.anchor.quote || null },
  };
  const plan = bestPlan({ lines: planLines, grid: bed.grid, downbeats: bed.downbeats, frames, photos: photoList, heroes: [], seed: videoId });
  plan.music = bed.music;
  plan.grid = bed.grid.filter((b) => b <= plan.duration + 1);
  plan.voice = plan.voice.map((v) => ({ ...v, file: voiced[v.line].file }));
  plan.fps = FPS;
  plan.size = [W, H];
  const problems = planProblems(plan);

  // 6. frames: extract every chapter moment the plan uses (full frame png; the renderer crops/punches)
  for (const s of plan.shots.filter((x) => x.kind === "frame")) {
    const png = stillOf({ id: s.ref, t: s.at });
    if (!fs.existsSync(png)) await ff(["-y", "-v", "error", "-ss", String(s.at), "-i", s.src, "-frames:v", "1", png]);
    s.image = png;
  }
  for (const s of plan.shots.filter((x) => x.kind === "photo" || x.kind === "photoText")) s.image = path.isAbsolute(s.src) ? s.src : path.join(VIDEO_ENGINE, s.src);
  const planPath = path.join(dir, "plan.json");
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 1));

  // 7. render picture (PIL frames -> ffmpeg) and audio (bed + sfx + voice), then mux at the loudness target
  const vid = path.join(dir, "montage-video.mp4");
  const r1 = spawnSync(python, [path.join(TOOLS, "montage_render.py"), planPath, vid], { encoding: "utf-8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r1.status !== 0) throw new Error(`montage render failed: ${(r1.stderr || "").slice(-800)}`);
  const renderStats = JSON.parse(String(r1.stdout).trim().split(/\r?\n/).pop());
  const wav = path.join(dir, "montage-mix.wav");
  const sfxDir = path.join(VIDEO_ENGINE, "assets", "sfx");
  const r2 = spawnSync(python, [path.join(TOOLS, "montage_audio.py"), planPath, wav, "--sfx-dir", sfxDir], { encoding: "utf-8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r2.status !== 0) throw new Error(`montage audio failed: ${(r2.stderr || "").slice(-800)}`);
  const audioStats = JSON.parse(String(r2.stdout).trim().split(/\r?\n/).pop());
  // loudness: the montage sits ~1 LU above the cold-open chapter (music under the voice), before the master
  const coldMp4 = (chapters.find((c) => c.id === "cold") || chapters[0]).mp4;
  const ref = integratedLufs(coldMp4).I;
  const target = (ref !== null ? ref : -14) + 1;
  const mixI = integratedLufs(wav).I;
  const gainDb = mixI !== null ? Math.max(-20, Math.min(20, target - mixI)) : 0;
  const { VIDEO_ARGS, AUDIO_ARGS } = require("./stitch");
  await ff(["-y", "-v", "error", "-i", vid, "-i", wav, "-map", "0:v:0", "-map", "1:a:0", "-af", `volume=${gainDb.toFixed(2)}dB,alimiter=limit=0.89:level=false`, ...VIDEO_ARGS, ...AUDIO_ARGS, "-t", plan.duration.toFixed(4), "-movflags", "+faststart", file], log);
  const outI = integratedLufs(file);
  const dur = probeDur(file);
  if (Math.abs(dur - plan.duration) > 0.1) problems.push(`rendered ${dur.toFixed(2)} s vs planned ${plan.duration.toFixed(2)} s`);
  (renderStats.blank || []).forEach((b) => problems.push(`blank frame in shot ${b.shot} (luma std ${b.std})`));
  const credits = [...new Set(plan.shots.filter((s) => s.credit).map((s) => s.credit))];
  const result = {
    key,
    ok: true,
    version: VERSION,
    duration: r3(dur),
    linesSource,
    lines,
    music: bed.music,
    plan: { duration: plan.duration, cuts: plan.cuts, sections: plan.sections, dropAt: plan.dropAt, shots: plan.shots.map((s) => ({ i: s.i, section: s.section, kind: s.kind, t0: s.t0, t1: s.t1, ref: s.ref || null, text: s.text || null })) },
    voice: plan.voice.map((v) => ({ line: v.line, at: v.at, duration: v.duration, reused: voiced[v.line].reused })),
    lineWords,
    captionChapter: captionChapter(plan, lineWords),
    credits,
    musicCredits: bed.music.credit ? [bed.music.credit] : [],
    problems,
    stats: { render: renderStats, audio: audioStats, loudness: { coldChapterI: ref, targetI: target, mixI, gainDb: r3(gainDb), montageI: outI.I, montageLRA: outI.LRA } },
  };
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 1));
  return { ...result, file, reused: false };
}

module.exports = {
  VERSION,
  BAND,
  DROP_S,
  PROC_BPM,
  numberTokens,
  deriveLines,
  scriptLines,
  linesPrompt,
  validateLlmLines,
  montageBeats,
  snapUp,
  snapNearest,
  trailerStart,
  moduleScore,
  cropFor,
  frameCandidates,
  photoCandidates,
  heroScenes,
  MIN_REAL,
  alignWords,
  numberValue,
  displayTokens,
  slamBeats,
  phraseChunks,
  LOADED,
  accentIndex,
  planShots,
  bestPlan,
  planProblems,
  captionChapter,
  shiftChapters,
  integratedLufs,
  buildMontage,
};
