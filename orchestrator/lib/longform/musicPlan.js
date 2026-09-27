"use strict";

/**
 * Per-section music plan for long-form videos (long-form v2 plan section 5).
 *
 * Inputs: the stitched chapter timeline (+ scene boundaries inside each chapter), the script's per-section
 * `mood` / `energy` tags (heuristics by chapter position when absent), the free-music library index
 * (video-engine/assets/music-lib/index.json, written by tools/music_index.py) and a small usage history
 * (orchestrator/output/music-usage.json) so tracks rotate across videos.
 *
 * Rules:
 *   - one bed per segment; segments break at every chapter boundary and, inside chapters longer than
 *     MAX_SEG s, at the scene boundary nearest TARGET_SEG s (each piece >= MIN_PIECE s) -> switches every
 *     ~40-60 s, only at section/scene boundaries;
 *   - no library track repeats within a video; energy-matched; rotation penalty from the history;
 *   - mood fallback chain (e.g. dread -> tension -> investigative), then the procedural bed for that mood
 *     (ambient|lofi|pulse) so everything works with an empty library;
 *   - montage regions (future `montage` stage) get a `trailer` track, -4 dB under the voice, no ducking;
 *     pickTrailer() / beatGrid() expose the library to that stage.
 * The mix itself is tools/sfx_mix.py --music-plan (tools/music_switch.py).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = path.resolve(__dirname, "..", "..", "..");
const DEFAULT_LIB = path.join(REPO, "video-engine", "assets", "music-lib");
const DEFAULT_HISTORY = path.join(REPO, "orchestrator", "output", "music-usage.json");
const MOODS = ["tension", "investigative", "dread", "hopeful", "playful", "calm", "triumphant", "trailer"];
const FALLBACK = {
  tension: ["investigative", "dread", "trailer"],
  investigative: ["tension", "calm"],
  dread: ["tension", "investigative"],
  hopeful: ["calm", "triumphant"],
  playful: ["calm", "hopeful"],
  calm: ["investigative", "hopeful"],
  triumphant: ["hopeful", "trailer"],
  trailer: ["triumphant", "tension"],
};
const PROCEDURAL = { tension: "pulse", investigative: "lofi", dread: "ambient", hopeful: "ambient", playful: "lofi", calm: "ambient", triumphant: "pulse", trailer: "pulse" };
const LEVELS = {
  library: { levelDb: -12, duckDb: -10 }, // pause level vs speech loudness, extra attenuation under speech
  procedural: { levelDb: -12, duckDb: -10 }, // same as library beds: no level step when a plan mixes both
  montage: { levelDb: -4, duckDb: 0 },
};
const MIN_SEG = 12; // chapters shorter than this share the previous bed
const TARGET_SEG = 50;
const MAX_SEG = 62;
const MIN_PIECE = 30;
const TRANSITION_S = 2.5;
const HISTORY_WINDOW = 8; // videos

const r3 = (x) => Math.round(x * 1000) / 1000;
const hash01 = (s) => parseInt(crypto.createHash("sha1").update(String(s)).digest("hex").slice(0, 8), 16) / 0xffffffff;

// ------------------------------------------------------------------ index

/** index.json -> {tracks, sfx, dir, problems}; drops unlicensed/unanalysed tracks (pure apart from `exists`) */
function parseIndex(json, dir, exists = (p) => fs.existsSync(p)) {
  const problems = [];
  const tracks = [];
  const sfx = [];
  for (const t of (json && json.tracks) || []) {
    const p = path.join(dir, t.file || t.id || "");
    if (!t.id || !exists(p)) {
      problems.push(`${t.id || "?"}: file missing`);
      continue;
    }
    if (!t.licensed) {
      problems.push(`${t.id}: no licence note (add ${path.basename(t.id)}.license.json or a LICENSES.md row)`);
      continue;
    }
    if (t.kind === "sfx") {
      sfx.push({ ...t, path: p });
      continue;
    }
    if (!MOODS.includes(t.mood)) {
      problems.push(`${t.id}: folder "${t.mood}" is not a mood (${MOODS.join(", ")})`);
      continue;
    }
    if (!(t.duration > 0) || !Array.isArray(t.usable)) {
      problems.push(`${t.id}: not analysed`);
      continue;
    }
    tracks.push({ ...t, path: p, energy: Math.max(1, Math.min(5, Number(t.energy) || 3)) });
  }
  return { tracks, sfx, dir, problems };
}

function loadIndex(dir = process.env.MUSIC_LIB || DEFAULT_LIB) {
  const f = path.join(dir, "index.json");
  if (!fs.existsSync(f)) return { tracks: [], sfx: [], dir, problems: [`no index at ${f}`] };
  return parseIndex(JSON.parse(fs.readFileSync(f, "utf-8")), dir);
}

/** tools/music_index.py (incremental); returns its summary or {error} -- never throws */
function refreshIndex({ dir = process.env.MUSIC_LIB || DEFAULT_LIB, python = process.env.SFX_PYTHON || "python", log = () => {} } = {}) {
  if (!fs.existsSync(dir)) return { error: `no library folder ${dir}` };
  const { spawnSync } = require("child_process");
  const r = spawnSync(python, [path.join(REPO, "orchestrator", "tools", "music_index.py"), "--lib", dir], { encoding: "utf-8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) {
    const e = `music_index failed: ${String(r.stderr || r.error || "").slice(-300)}`;
    log(e);
    return { error: e };
  }
  try {
    return JSON.parse(String(r.stdout).trim().split(/\r?\n/).pop());
  } catch {
    return { error: "music_index: unreadable summary" };
  }
}

// ------------------------------------------------------------------ history

function readHistory(file = DEFAULT_HISTORY) {
  try {
    const h = JSON.parse(fs.readFileSync(file, "utf-8"));
    return { videos: Array.isArray(h.videos) ? h.videos : [] };
  } catch {
    return { videos: [] };
  }
}

/** replace this video's entry and append it (newest last); keeps the last 200 videos */
function recordUsage(plan, videoId, file = DEFAULT_HISTORY) {
  const h = readHistory(file);
  const tracks = plan.segments.filter((s) => s.source === "library").map((s) => s.track.id);
  const videos = h.videos.filter((v) => v.id !== videoId);
  videos.push({ id: videoId, at: new Date().toISOString(), tracks });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ videos: videos.slice(-200) }, null, 1));
  return tracks;
}

/** penalty per track id from the last HISTORY_WINDOW other videos (1 = used in the previous video) */
function rotationPenalty(history, videoId) {
  const vids = (history.videos || []).filter((v) => v.id !== videoId).slice(-HISTORY_WINDOW);
  const pen = {};
  vids.forEach((v, i) => {
    const age = vids.length - 1 - i; // 0 = most recent
    for (const id of v.tracks || []) pen[id] = (pen[id] || 0) + (1 - age / HISTORY_WINDOW);
  });
  return pen;
}

// ------------------------------------------------------------------ moods

/** heuristic mood/energy when the script has none: cold -> tension 4, first body chapter investigative,
 *  last body chapter tension 4, middles alternate, recap hopeful 2 */
function heuristicTag(id, bodyIndex, bodyCount) {
  if (id === "cold") return { mood: "tension", energy: 4 };
  if (id === "recap") return { mood: "hopeful", energy: 2 };
  if (bodyIndex === 0) return { mood: "investigative", energy: 3 };
  if (bodyIndex === bodyCount - 1 && bodyCount >= 3) return { mood: "tension", energy: 4 };
  return bodyIndex % 2 ? { mood: "tension", energy: 3 } : { mood: "investigative", energy: 3 };
}

/** script.sections -> {id: {mood, energy, from}} */
function sectionTags(sections = []) {
  const body = sections.filter((s) => s.id !== "cold" && s.id !== "recap");
  const out = {};
  for (const s of sections) {
    const h = heuristicTag(s.id, body.indexOf(s), body.length);
    const mood = MOODS.includes(String(s.mood || "").toLowerCase()) ? String(s.mood).toLowerCase() : null;
    const e = Number(s.energy);
    out[s.id] = { mood: mood || h.mood, energy: Number.isFinite(e) && e >= 1 && e <= 5 ? Math.round(e) : h.energy, from: mood ? "script" : "heuristic" };
  }
  return out;
}

// ------------------------------------------------------------------ segments

/**
 * @param chapters [{id, start, duration, scenes: [absolute scene start times]}]
 * @param montage [{start, end}] absolute (optional)
 * @returns [{start, end, chapterId, boundary: "start"|"chapter"|"scene"|"montage", montage: bool}]
 */
function buildSegments(chapters, montage = []) {
  const segs = [];
  chapters.forEach((c, ci) => {
    const c0 = c.start;
    const c1 = ci + 1 < chapters.length ? chapters[ci + 1].start : c.start + c.duration; // no rounding gaps
    if (segs.length && c.duration < MIN_SEG) {
      segs[segs.length - 1].end = r3(c1);
      segs[segs.length - 1].chapterIds.push(c.id);
      return;
    }
    const scenes = (c.scenes || []).filter((t) => t > c0 + 1 && t < c1 - 1).sort((a, b) => a - b);
    let s0 = c0;
    let boundary = segs.length ? "chapter" : "start";
    while (c1 - s0 > MAX_SEG) {
      const ok = scenes.filter((t) => t - s0 >= MIN_PIECE && c1 - t >= MIN_PIECE);
      if (!ok.length) break;
      const cut = ok.reduce((b, t) => (Math.abs(t - s0 - TARGET_SEG) < Math.abs(b - s0 - TARGET_SEG) ? t : b));
      segs.push({ start: r3(s0), end: r3(cut), chapterIds: [c.id], boundary, montage: false });
      s0 = cut;
      boundary = "scene";
    }
    segs.push({ start: r3(s0), end: r3(c1), chapterIds: [c.id], boundary, montage: false });
  });
  // montage regions become their own segments (hard boundaries at both ends)
  for (const m of montage || []) {
    const out = [];
    for (const s of segs) {
      if (m.end <= s.start || m.start >= s.end) {
        out.push(s);
        continue;
      }
      if (m.start > s.start + 0.5) out.push({ ...s, end: r3(m.start) });
      out.push({ start: r3(Math.max(s.start, m.start)), end: r3(Math.min(s.end, m.end)), chapterIds: s.chapterIds, boundary: "montage", montage: true });
      if (m.end < s.end - 0.5) out.push({ ...s, start: r3(m.end), boundary: "montage" });
    }
    segs.splice(0, segs.length, ...out);
  }
  return segs;
}

/** stitch.json chapters + per-chapter render timelines ({spec: {scaffolds}}) -> buildSegments() input */
function chaptersFromStitch(stitchChapters, timelines) {
  return stitchChapters.map((c, i) => {
    const sc = ((timelines[i] && timelines[i].spec && timelines[i].spec.scaffolds) || []).map((x) => c.start + Number(x.t0)).filter(Number.isFinite);
    return { id: c.id, start: c.start, duration: c.duration, scenes: sc };
  });
}

// ------------------------------------------------------------------ picking

function scoreTrack(t, { want, chainLevel, dur, pen, seed }) {
  let s = -3 * chainLevel - Math.abs(t.energy - want);
  s -= 2.5 * (pen[t.id] || 0);
  const avail = t.usableFromEntry || t.duration - (t.entry || 0);
  if (avail < dur) s -= t.loop ? (dur / Math.max(1, avail) > 3 ? 0.6 : 0.2) : 1.5;
  return s + 0.4 * hash01(`${seed}|${t.id}`);
}

/** best unused track for mood (walking the fallback chain) or null */
function pickTrack(index, { mood, energy = 3, duration = 50, used = new Set(), pen = {}, seed = "", montage = false, reserveTrailer = true }) {
  // trailer tracks are reserved for the montage: sections never fall back onto them
  const chain = [mood, ...(FALLBACK[mood] || [])].filter((m) => montage || !reserveTrailer || m !== "trailer" || mood === "trailer");
  let best = null;
  chain.forEach((m, level) => {
    for (const t of index.tracks) {
      if (t.mood !== m || used.has(t.id)) continue;
      if (montage && m === "trailer" && !t.montageOk && index.tracks.some((x) => x.mood === "trailer" && x.montageOk && !used.has(x.id))) continue;
      const sc = scoreTrack(t, { want: energy, chainLevel: level, dur: duration, pen, seed });
      if (!best || sc > best.score) best = { track: t, score: sc, moodFallback: level ? m : null };
    }
  });
  return best;
}

/** trailer track for the montage stage: {track, beats, downbeats, phrases, bpm} or null */
function pickTrailer(index, { used = new Set(), history = { videos: [] }, videoId = "", seed = "", duration = 30 } = {}) {
  const b = pickTrack(index, { mood: "trailer", energy: 5, duration, used, pen: rotationPenalty(history, videoId), seed, montage: true });
  return b ? { track: b.track, ...beatGrid(b.track) } : null;
}

/** beat grid of an indexed track (seconds, track time) */
function beatGrid(t) {
  return { bpm: t.bpm || null, beats: t.beats || [], downbeats: t.downbeats || [], phrases: t.phrases || [], entry: t.entry || 0, loop: t.loop || null };
}

function trackRef(t) {
  return { id: t.id, path: t.path, mood: t.mood, energy: t.energy, bpm: t.bpm, entry: t.entry, loop: t.loop, usable: t.usable, duration: t.duration, credit: t.credit, license: t.license ? t.license.license : null, source: t.license ? t.license.source || null : null };
}

/**
 * @param o.index     loadIndex() result (tracks may be empty -> all procedural)
 * @param o.chapters  [{id, start, duration, scenes}]
 * @param o.tags      sectionTags() result
 * @param o.history   readHistory() result
 * @param o.videoId   id of this video (its own history entry is ignored, so reruns are stable)
 * @param o.montage   [{start, end}]
 */
function planMusic({ index = { tracks: [] }, chapters, tags = {}, history = { videos: [] }, videoId = "", montage = [] }) {
  const segs = buildSegments(chapters, montage);
  const pen = rotationPenalty(history, videoId);
  const used = new Set();
  const seed = videoId;
  let prevPreset = null;
  const out = segs.map((s, i) => {
    const tag = s.montage ? { mood: "trailer", energy: 5 } : tags[s.chapterIds[0]] || { mood: "investigative", energy: 3 };
    const dur = s.end - s.start;
    const base = { i, start: s.start, end: s.end, duration: r3(dur), chapterIds: s.chapterIds, boundary: s.boundary, montage: s.montage, mood: tag.mood, energy: tag.energy };
    const b = pickTrack(index, { mood: tag.mood, energy: tag.energy, duration: dur, used, pen, seed: `${seed}|${i}`, montage: s.montage });
    const lv = s.montage ? LEVELS.montage : null;
    if (b) {
      used.add(b.track.id);
      prevPreset = null;
      return { ...base, source: "library", moodFallback: b.moodFallback, track: trackRef(b.track), ...(lv || LEVELS.library) };
    }
    let preset = PROCEDURAL[tag.mood] || "ambient";
    if (prevPreset === preset) preset = { pulse: "lofi", lofi: "ambient", ambient: "lofi" }[preset]; // audible change at the switch
    prevPreset = preset;
    return { ...base, source: "procedural", preset, seed: 7 + Math.floor(hash01(`${seed}|${i}`) * 1000), ...(lv || LEVELS.procedural) };
  });
  const credits = [...new Set(out.filter((s) => s.source === "library" && s.track.credit).map((s) => s.track.credit))];
  return {
    version: 1,
    transitionSeconds: TRANSITION_S,
    segments: out,
    transitions: out.slice(1).map((s) => s.start),
    credits,
    library: { dir: index.dir || null, tracks: index.tracks.length, problems: (index.problems || []).slice(0, 20) },
  };
}

/** problems with a plan (used by tests and the master stage log) */
function planProblems(plan, duration) {
  const p = [];
  const ids = plan.segments.filter((s) => s.source === "library").map((s) => s.track.id);
  if (new Set(ids).size !== ids.length) p.push("a library track repeats within the video");
  plan.segments.forEach((s, i) => {
    if (i && Math.abs(s.start - plan.segments[i - 1].end) > 1e-6) p.push(`gap/overlap before segment ${i}`);
    if (s.end <= s.start) p.push(`segment ${i} is empty`);
  });
  if (plan.segments.length && plan.segments[0].start > 1e-6) p.push("first segment does not start at 0");
  if (duration && plan.segments.length && Math.abs(plan.segments[plan.segments.length - 1].end - duration) > 0.5) p.push("last segment does not reach the end");
  return p;
}

/** "0:25  ch1  investigative  tension/foo.mp3" lines */
function timelineText(plan) {
  const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}.${String(Math.round((t % 1) * 10) % 10)}`;
  return plan.segments.map((s) => `${mmss(s.start)}-${mmss(s.end)}  [${s.boundary}] ${s.chapterIds.join("+")}  ${s.mood}/${s.energy}${s.moodFallback ? ` (as ${s.moodFallback})` : ""}  ${s.source === "library" ? s.track.id : `procedural:${s.preset}`}`).join("\n");
}

module.exports = {
  MOODS,
  FALLBACK,
  PROCEDURAL,
  LEVELS,
  DEFAULT_LIB,
  DEFAULT_HISTORY,
  parseIndex,
  loadIndex,
  refreshIndex,
  readHistory,
  recordUsage,
  rotationPenalty,
  heuristicTag,
  sectionTags,
  buildSegments,
  chaptersFromStitch,
  pickTrack,
  pickTrailer,
  beatGrid,
  planMusic,
  planProblems,
  timelineText,
};
