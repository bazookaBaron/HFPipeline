"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const MP = require("./musicPlan");
const PK = require("./package");

const T = (id, mood, energy, extra = {}) => ({ id: `${mood}/${id}.mp3`, file: `${mood}/${id}.mp3`, kind: "music", mood, energy, duration: 150, usable: [0, 150], entry: 2, loop: { start: 2, end: 130 }, usableFromEntry: 128, bpm: 100, beats: [2, 2.6], downbeats: [2], phrases: [2], licensed: true, credit: `Music: ${id}`, license: { license: "CC BY 4.0", source: "incompetech" }, ...extra });
const index = (tracks) => MP.parseIndex({ tracks }, "/lib", () => true);
const chapters = [
  { id: "cold", start: 0, duration: 25, scenes: [5, 12] },
  { id: "ch1", start: 25, duration: 130, scenes: [40, 60, 72, 90, 105, 120, 140] },
  { id: "ch2", start: 155, duration: 50, scenes: [170, 190] },
  { id: "recap", start: 205, duration: 25, scenes: [] },
];

test("sectionTags: script mood/energy win, heuristics otherwise", () => {
  const t = MP.sectionTags([{ id: "cold" }, { id: "ch1", mood: "Dread", energy: 2 }, { id: "ch2", mood: "sleepy", energy: 9 }, { id: "ch3" }, { id: "recap" }]);
  assert.deepEqual(t.cold, { mood: "tension", energy: 4, from: "heuristic" });
  assert.deepEqual(t.ch1, { mood: "dread", energy: 2, from: "script" });
  assert.equal(t.ch2.from, "heuristic"); // unknown mood and out-of-range energy fall back
  assert.equal(t.ch2.energy, 3);
  assert.deepEqual(t.ch3, { mood: "tension", energy: 4, from: "heuristic" }); // last body chapter
  assert.equal(t.recap.mood, "hopeful");
});

test("buildSegments: chapter boundaries, long chapters split at a scene boundary ~50 s, contiguous", () => {
  const s = MP.buildSegments(chapters);
  assert.deepEqual(s.map((x) => [x.start, x.end, x.boundary]), [
    [0, 25, "start"],
    [25, 72, "chapter"], // 47 s: the scene boundary nearest 50 s that leaves >= 30 s on both sides
    [72, 120, "scene"],
    [120, 155, "scene"],
    [155, 205, "chapter"],
    [205, 230, "chapter"],
  ]);
  for (let i = 1; i < s.length; i++) assert.equal(s[i].start, s[i - 1].end);
  // every switch is a chapter start or a scene start
  const starts = new Set(chapters.flatMap((c) => [c.start, ...c.scenes]));
  s.slice(1).forEach((x) => assert.ok(starts.has(x.start), `${x.start} is a boundary`));
});

test("buildSegments: a very short chapter shares the previous bed; rounding gaps are closed", () => {
  const s = MP.buildSegments([{ id: "cold", start: 0, duration: 30.0004 }, { id: "ch1", start: 30, duration: 8 }, { id: "ch2", start: 38, duration: 40 }]);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0].chapterIds, ["cold", "ch1"]);
  assert.equal(s[0].end, 38);
});

test("buildSegments: montage regions become their own segments", () => {
  const s = MP.buildSegments([{ id: "cold", start: 0, duration: 60 }, { id: "ch1", start: 60, duration: 50 }], [{ start: 0, end: 30 }]);
  assert.deepEqual(s.map((x) => [x.start, x.end, x.montage]), [[0, 30, true], [30, 60, false], [60, 110, false]]);
});

test("planMusic: no repeats, energy-matched, mood fallback, trailer reserved for the montage", () => {
  const ix = index([T("t-hi", "tension", 5), T("t-mid", "tension", 3), T("inv", "investigative", 3), T("hope", "hopeful", 2), T("trail", "trailer", 5, { montageOk: true })]);
  const tags = { cold: { mood: "tension", energy: 5 }, ch1: { mood: "tension", energy: 3 }, ch2: { mood: "tension", energy: 4 }, recap: { mood: "hopeful", energy: 2 } };
  const p = MP.planMusic({ index: ix, chapters, tags, videoId: "v" });
  assert.deepEqual(MP.planProblems(p, 230), []);
  const ids = p.segments.map((s) => (s.source === "library" ? s.track.id : `proc:${s.preset}`));
  assert.equal(ids[0], "tension/t-hi.mp3"); // energy 5 wants the energy-5 track
  assert.equal(ids[1], "tension/t-mid.mp3");
  assert.equal(ids[2], "investigative/inv.mp3"); // tension exhausted -> fallback chain
  assert.equal(p.segments[2].moodFallback, "investigative");
  assert.ok(!ids.includes("trailer/trail.mp3"), "trailer is reserved");
  assert.match(ids[3], /^proc:/); // nothing left for tension -> procedural
  assert.match(ids[4], /^proc:/);
  assert.notEqual(ids[3], ids[4], "consecutive procedural beds differ");
  assert.equal(ids[5], "hopeful/hope.mp3");
  assert.equal(new Set(ids.filter((x) => !x.startsWith("proc:"))).size, 4);
  assert.deepEqual(p.transitions, [25, 72, 120, 155, 205]);
  assert.deepEqual(p.credits, ["Music: t-hi", "Music: t-mid", "Music: inv", "Music: hope"]);
  assert.deepEqual([p.segments[0].levelDb, p.segments[0].duckDb], [-12, -10]);
});

test("planMusic: empty library -> procedural beds varied by mood, no credits", () => {
  const p = MP.planMusic({ index: index([]), chapters, tags: MP.sectionTags(chapters.map((c) => ({ id: c.id }))), videoId: "v" });
  assert.ok(p.segments.every((s) => s.source === "procedural"));
  assert.equal(p.segments[0].preset, "pulse"); // cold: tension
  assert.equal(p.segments[1].preset, "lofi"); // investigative
  assert.equal(p.segments[5].preset, "ambient"); // recap: hopeful
  assert.deepEqual(p.credits, []);
});

test("planMusic: montage gets a trailer track at -4 dB, no ducking", () => {
  const ix = index([T("trail", "trailer", 5, { montageOk: true }), T("t", "tension", 4)]);
  const p = MP.planMusic({ index: ix, chapters: [{ id: "cold", start: 0, duration: 60 }], tags: { cold: { mood: "tension", energy: 4 } }, montage: [{ start: 0, end: 28 }] });
  assert.equal(p.segments[0].track.id, "trailer/trail.mp3");
  assert.deepEqual([p.segments[0].levelDb, p.segments[0].duckDb], [-4, 0]);
  assert.equal(p.segments[1].track.id, "tension/t.mp3");
  const tr = MP.pickTrailer(ix);
  assert.equal(tr.track.id, "trailer/trail.mp3");
  assert.deepEqual(tr.beats, [2, 2.6]);
  assert.equal(tr.bpm, 100);
});

test("rotation: tracks used by recent other videos are avoided; this video's own entry is ignored", () => {
  const ix = index([T("a", "tension", 4), T("b", "tension", 4)]);
  const one = { chapters: [{ id: "cold", start: 0, duration: 30 }], tags: { cold: { mood: "tension", energy: 4 } } };
  const first = MP.planMusic({ index: ix, ...one, videoId: "x" }).segments[0].track.id;
  const other = first === "tension/a.mp3" ? "tension/b.mp3" : "tension/a.mp3";
  const hist = { videos: [{ id: "prev", tracks: [first] }] };
  assert.equal(MP.planMusic({ index: ix, ...one, videoId: "x", history: hist }).segments[0].track.id, other);
  const own = MP.planMusic({ index: ix, ...one, videoId: "prev" }).segments[0].track.id;
  assert.equal(MP.planMusic({ index: ix, ...one, videoId: "prev", history: hist }).segments[0].track.id, own);
});

test("recordUsage / readHistory round trip, one entry per video", () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "music-usage-")), "u.json");
  const plan = { segments: [{ source: "library", track: { id: "tension/a.mp3" } }, { source: "procedural", preset: "lofi" }] };
  MP.recordUsage(plan, "v1", f);
  MP.recordUsage(plan, "v1", f);
  MP.recordUsage({ segments: [] }, "v2", f);
  const h = MP.readHistory(f);
  assert.deepEqual(h.videos.map((v) => [v.id, v.tracks]), [["v1", ["tension/a.mp3"]], ["v2", []]]);
  assert.deepEqual(MP.readHistory(f + ".missing"), { videos: [] });
});

test("parseIndex: unlicensed, missing, unknown-mood and unanalysed tracks are dropped; sfx split out", () => {
  const ix = MP.parseIndex({
    tracks: [
      T("ok", "calm", 2),
      T("nolic", "calm", 2, { licensed: false }),
      T("gone", "calm", 2),
      T("odd", "jazz", 2),
      T("raw", "calm", 2, { duration: null }),
      { id: "sfx/hit.wav", file: "sfx/hit.wav", kind: "sfx", sfxCategory: "impact", licensed: true },
    ],
  }, "/lib", (p) => !p.includes("gone"));
  assert.deepEqual(ix.tracks.map((t) => t.id), ["calm/ok.mp3"]);
  assert.equal(ix.tracks[0].path, path.join("/lib", "calm/ok.mp3"));
  assert.deepEqual(ix.sfx.map((t) => t.sfxCategory), ["impact"]);
  assert.equal(ix.problems.length, 4);
  assert.ok(ix.problems.some((p) => /licence note/.test(p)));
});

test("chaptersFromStitch: scene starts from lf scaffolds, offset by the chapter start", () => {
  const c = MP.chaptersFromStitch([{ id: "ch1", start: 10, duration: 40 }], [{ spec: { scaffolds: [{ t0: 0 }, { t0: 12.5 }] } }]);
  assert.deepEqual(c, [{ id: "ch1", start: 10, duration: 40, scenes: [10, 22.5] }]);
});

test("descriptionMd: a Music section lists the plan's credit lines", () => {
  const md = PK.descriptionMd({ outline: { title: "X" }, dossier: {}, chapters: [{ start: 0, title: "Intro" }], credits: "", music: ["Music: \"Tense\" Kevin MacLeod (incompetech.com), CC BY 4.0"], topic: "x" });
  assert.match(md, /## Music\n\n- Music: "Tense" Kevin MacLeod/);
  assert.doesNotMatch(PK.descriptionMd({ outline: { title: "X" }, dossier: {}, chapters: [], credits: "", topic: "x" }), /## Music/);
});

test("music_index.py licence parsing: LICENSES.md table, sidecar defaults, classification", () => {
  const py = `
import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(__dirname, "..", "..", "tools"))})
import music_index as m
t = m.parse_licenses_md("| File | Title | Artist | Source | URL | License | Credit |\\n|---|---|---|---|---|---|---|\\n| a.mp3 | Tense | Kevin MacLeod | incompetech | https://incompetech.com | CC BY 4.0 | |\\n| b.mp3 | | | | | | |\\n")
print(json.dumps({"t": t, "a": m.normalise_license(t["a.mp3"]), "none": m.normalise_license({"title": "x"}), "c1": m.classify("tension/x.mp3"), "c2": m.classify("sfx/impacts/boom.wav"), "c3": m.classify("sfx/big-whoosh-01.wav")}))`;
  const r = require("node:child_process").spawnSync(process.env.SFX_PYTHON || "python", ["-c", py], { encoding: "utf-8" });
  assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
  assert.deepEqual(Object.keys(o.t), ["a.mp3"]); // a row with only the file name has no fields
  assert.equal(o.a.licensed, true);
  assert.equal(o.a.credit, 'Music: "Tense" by Kevin MacLeod (incompetech), CC BY 4.0 https://incompetech.com');
  assert.equal(o.none.licensed, false);
  assert.deepEqual(o.c1, ["music", "tension", null]);
  assert.deepEqual(o.c2, ["sfx", null, "impacts"]);
  assert.deepEqual(o.c3, ["sfx", null, "whoosh"]);
});
