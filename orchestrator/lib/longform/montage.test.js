"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("./montage");
const PK = require("./package");

const grid112 = M.montageBeats({ beats: [], bpm: 112, start: 0, until: 60 });

function fixture(nLines = 5, lineDur = 1.9, anchorDur = 4.2) {
  const lines = {
    chorus: Array.from({ length: nLines }, (_, i) => ({ text: `Line number ${i} hits hard`, duration: lineDur, words: [0, 0.3, 0.8, 1.2, 1.5].map((s, k) => ({ text: "w" + k, start: s, end: s + 0.25 })) })),
    anchor: { text: "When dollars run out, money crashes and defaults follow.", duration: anchorDur, words: [] },
  };
  const frames = Array.from({ length: 12 }, (_, i) => ({ kind: "frame", id: `ch${1 + (i % 3)}.${i}`, chapterId: `ch${1 + (i % 3)}`, mp4: `c${i}.mp4`, t: 3 + i, crop: [0, 0, 960, 540], module: "bigNumber", score: 10 - i }));
  const photos = Array.from({ length: 6 }, (_, i) => ({ kind: "photo", id: `p${i}`, slot: `p${i}`, file: `p${i}.jpg`, ai: i > 3, score: 6 - i }));
  return { lines, frames, photos };
}

test("beat grid: library beats shifted to the chosen start and extended at the bpm", () => {
  const g = M.montageBeats({ beats: [0.2, 0.7, 1.2, 1.7], bpm: 120, start: 0.7, until: 5 });
  assert.deepEqual(g.slice(0, 4), [0, 0.5, 1, 1.5]);
  assert.ok(g[g.length - 1] >= 5);
  assert.ok(g.every((b, i) => !i || Math.abs(b - g[i - 1] - 0.5) < 1e-6));
});

test("snapUp / snapNearest land on the grid (and extrapolate past it)", () => {
  const g = [0, 0.5, 1, 1.5];
  assert.equal(M.snapUp(0.51, g), 1);
  assert.equal(M.snapUp(1, g), 1);
  assert.equal(M.snapUp(2.2, g), 2.5);
  assert.equal(M.snapNearest(1.2, g), 1);
});

test("trailerStart skips a quiet intro", () => {
  const rms = { hop: 0.5, db: [...Array(40).fill(-30), ...Array(200).fill(-12)] };
  const t = { phrases: [0, 10, 20, 30], entry: 0, duration: 120, rms };
  assert.equal(M.trailerStart(t, 30), 20);
});

test("planShots: 20+ cuts in 25-35 s, run cuts on the beat, anchor 5-8 s, voice placed", () => {
  const { lines, frames, photos } = fixture();
  const plan = M.bestPlan({ lines, grid: grid112, frames, photos, seed: "t" });
  assert.deepEqual(M.planProblems(plan), []);
  assert.ok(plan.cuts >= M.BAND.minCuts, `cuts ${plan.cuts}`);
  assert.ok(plan.duration >= 25 && plan.duration <= 35, `duration ${plan.duration}`);
  const onGrid = (t) => grid112.some((b) => Math.abs(b - t) < 2e-3);
  plan.shots.filter((s) => s.section === "run").forEach((s) => assert.ok(onGrid(s.t0) && onGrid(s.t1), `run shot ${s.i} off-grid`));
  const an = plan.shots[plan.shots.length - 1];
  assert.equal(an.kind, "anchor");
  assert.ok(an.t1 - an.t0 >= 5 && an.t1 - an.t0 <= 8);
  assert.ok(plan.dropAt > an.t0 && plan.dropAt < an.t1);
  assert.equal(plan.voice.length, 6);
  // every chorus voice line lies inside its own shot
  plan.voice.filter((v) => v.line.startsWith("chorus")).forEach((v, i) => {
    const ss = plan.shots.filter((x) => x.section === "chorus" && x.line === i);
    assert.ok(v.at >= ss[0].t0 && v.at + v.duration <= ss[ss.length - 1].t1 + 1e-6);
  });
  // whoosh on every run cut, impact on the anchor
  plan.shots.filter((s) => s.section === "run").forEach((s) => assert.ok(plan.sfx.some((x) => Math.abs(x.t - s.t0) < 1e-6)));
  assert.ok(plan.sfx.some((x) => x.kind === "impact" && Math.abs(x.t - an.t0) < 1e-6));
  // no chapter moment repeats while fresh ones are left; exactly one flash
  const refs = plan.shots.filter((s) => s.kind === "frame").map((s) => s.ref);
  assert.equal(new Set(refs).size, refs.length);
  assert.equal(plan.shots.filter((s) => s.flash).length, 1);
});

test("planShots: real photos before our AI illustrations", () => {
  const { lines, frames, photos } = fixture();
  const plan = M.bestPlan({ lines, grid: grid112, frames: frames.slice(0, 3), photos, seed: "t" });
  const used = plan.shots.filter((s) => s.kind === "photo" || s.kind === "photoText").map((s) => s.ref || s.slot);
  const firstAi = used.findIndex((id) => /p[45]/.test(id));
  if (firstAi >= 0) assert.ok(used.slice(0, firstAi).filter((x) => /p[0-3]/.test(x)).length >= 3);
});

test("planProblems flags a short, sparse montage", () => {
  const { lines, frames, photos } = fixture(2, 1.0, 2.0);
  const plan = M.planShots({ lines, grid: grid112, frames, photos, runShots: 8 });
  const p = M.planProblems(plan);
  assert.ok(p.some((x) => /duration/.test(x)));
  assert.ok(p.some((x) => /chorus lines/.test(x)));
});

test("alignWords maps voice tokens onto script words (1:1 or by character offset)", () => {
  assert.deepEqual(M.alignWords("a b", [{ text: "a", start: 0.1 }, { text: "b", start: 0.5 }], 1).map((w) => w.start), [0.1, 0.5]);
  const r = M.alignWords("fifty-eight percent now", [{ text: "fifty", start: 0 }, { text: "eight", start: 0.3 }, { text: "percent", start: 0.6 }, { text: "now", start: 1.0 }], 1.3);
  assert.equal(r.length, 3);
  assert.ok(r[0].start <= r[1].start && r[1].start <= r[2].start);
  assert.equal(r[2].start, 1.0);
});

test("accentIndex prefers numbers, then proper nouns", () => {
  assert.equal(M.accentIndex("Inflation explodes past two hundred percent."), 3);
  assert.equal(M.accentIndex("the peso met Argentina"), 3);
});

test("deriveLines: verbatim body sentences (never the cold open) + an anchor", () => {
  const script = {
    sections: [
      { id: "cold", sentences: [{ text: "Farm goods make up fifty-eight percent of exports." }] },
      { id: "ch1", sentences: [{ text: "By eighteen ninety, they defaulted." }, { text: "That was bad for everyone involved here." }, { text: "Why would anyone lend again?" }] },
      { id: "ch2", sentences: [{ text: "In two thousand one, the economy broke." }, { text: "Banks froze every account." }] },
      { id: "recap", sentences: [{ text: "When dollars run out, money crashes and defaults follow." }] },
    ],
  };
  const r = M.deriveLines(script, {});
  const texts = r.chorus.map((c) => c.text);
  assert.ok(texts.length >= 3);
  assert.ok(!texts.some((t) => /Farm goods/.test(t)));
  assert.ok(!texts.some((t) => /^That was/.test(t)));
  assert.equal(r.anchor.text, "When dollars run out, money crashes and defaults follow.");
  const q = M.deriveLines(script, { quotes: [{ id: "Q1", text: "We will pay what we can.", speaker: "A Minister", source: "Reuters" }] });
  assert.equal(q.anchor.source, "Q1");
  assert.equal(q.anchor.quote.speaker, "A Minister");
});

test("validateLlmLines rejects numbers the script never says", () => {
  const script = { sections: [{ id: "ch1", sentences: [{ text: "Debt hit forty billion dollars." }] }] };
  const v = M.validateLlmLines({ chorus: ["Forty billion gone.", "Ninety billion gone.", "Debt piles up."], anchor: "Debt hit forty billion dollars and nobody noticed at all." }, script);
  assert.deepEqual(v.chorus, ["Forty billion gone.", "Debt piles up."]);
  assert.ok(v.anchor);
});

test("frameCandidates: best module per scene, skips title cards and unusable photo slots", () => {
  const tl = (scaffolds, events = []) => ({ spec: { scaffolds, events } });
  const chapters = [
    { id: "cold", mp4: "cold.mp4", timeline: tl([{ template: "lfNumber", t0: 0, t1: 5, modules: [{ id: "n", type: "bigNumber", rect: [100, 100, 400, 300] }] }]) },
    {
      id: "ch1",
      mp4: "ch1.mp4",
      timeline: tl(
        [
          { template: "lfChapter", t0: 0, t1: 4, modules: [{ id: "c", type: "chapterCard", rect: [0, 0, 1920, 1080] }] },
          { template: "lfChart", t0: 4, t1: 12, modules: [{ id: "h", type: "lfHeader", rect: [96, 48, 1100, 40] }, { id: "b", type: "barChart", rect: [200, 200, 1200, 600] }, { id: "n", type: "bigNumber", rect: [1400, 300, 320, 220] }] },
          { template: "lfStage", t0: 12, t1: 20, modules: [{ id: "p", type: "photo", rect: [400, 200, 1000, 600], props: { slot: "gone" } }] },
        ],
        [{ t: 9.5, op: "draw", target: "b" }]
      ),
    },
  ];
  const c = M.frameCandidates(chapters, { slots: { gone: { status: "fallback" } } });
  assert.equal(c.length, 1);
  assert.equal(c[0].module, "bigNumber");
  assert.ok(c[0].t >= 10.2 && c[0].t <= 11.5, `t ${c[0].t}`);
  const [x, y, w, h] = c[0].crop;
  assert.ok(Math.abs(w / h - 16 / 9) < 0.01 && x >= 0 && y >= 0 && x + w <= 1920 && y + h <= 1080);
});

test("captions + YouTube chapters shift by the montage; Intro stays at 0:00", () => {
  const head = 27.5;
  const plan = { voice: [{ line: "chorus0", at: 0.08, duration: 1 }, { line: "anchor", at: 20, duration: 3 }] };
  const mc = M.captionChapter(plan, { chorus0: [{ text: "Fiscal", start: 0, end: 0.4 }, { text: "deficit.", start: 0.45, end: 0.9 }], anchor: [{ text: "Money", start: 0, end: 0.3 }, { text: "crashes.", start: 0.35, end: 0.9 }] });
  const chapterWords = [{ text: "Farm", start: 0.3, end: 0.6, sentenceId: "s1" }];
  const cues = PK.buildCues([mc, { start: head, words: chapterWords }]);
  assert.deepEqual(PK.cueProblems(cues, head + 30), []);
  assert.equal(cues[0].text, "Fiscal deficit.");
  assert.equal(cues[1].start, 20);
  assert.equal(cues[2].start, head + 0.3);
  const yt = M.shiftChapters([{ id: "cold", title: "Intro", start: 0 }, { id: "ch1", title: "A", start: 25.2 }, { id: "ch2", title: "B", start: 70.5 }], head);
  assert.deepEqual(yt.map((c) => c.start), [0, 52.7, 98]);
  assert.deepEqual(PK.chapterRules(yt, 200), []);
  assert.equal(PK.ytTime(yt[1].start), "0:52");
});

test("displayTokens: numerals, currency, percent, years on screen", () => {
  const d = (t) => M.displayTokens(t.split(" ")).map((x) => x.text).join(" ");
  assert.equal(d("One hundred thirty-two billion lost."), "132 BILLION LOST");
  assert.equal(d("Forty-eight million pounds defaulted."), "£48 MILLION DEFAULTED");
  assert.equal(d("Inflation explodes past two hundred percent."), "INFLATION EXPLODES PAST 200%");
  assert.equal(d("By nineteen eighty-three, debt hit forty-six billion dollars."), "BY 1983 DEBT HIT $46 BILLION");
  assert.equal(d("Pay one point three billion dollars"), "PAY $1.3 BILLION");
  assert.equal(d("In two thousand one, the economy broke."), "IN 2001 THE ECONOMY BROKE");
  assert.equal(d("The one country that pays"), "THE ONE COUNTRY THAT PAYS");
});

test("slamBeats: 1-4 tokens per beat, number phrase kept whole, no orphan tail", () => {
  const b = (t) => {
    const w = t.split(" ");
    return M.slamBeats(M.displayTokens(w), w).map((x) => x.map((y) => y.text).join(" "));
  };
  assert.deepEqual(b("One hundred thirty-two billion lost."), ["132 BILLION LOST"]);
  assert.deepEqual(b("By nineteen eighty-three, foreign debt reached about forty-six billion dollars."), ["BY 1983", "FOREIGN DEBT REACHED", "ABOUT $46 BILLION"]);
  assert.deepEqual(b("Fiscal deficit builds up."), ["FISCAL DEFICIT BUILDS UP"]);
  b("A judge ordered Argentina to pay one point three billion dollars today.").forEach((x) => assert.ok(x.split(" ").length <= 4, x));
});

test("phraseChunks: 2-3 chunks, breaking at commas / conjunctions", () => {
  const c = (t) => {
    const w = t.split(" ");
    return M.phraseChunks(w).map((x) => x.map((i) => w[i]).join(" "));
  };
  assert.deepEqual(c("When dollars run out, money crashes and defaults follow."), ["When dollars run out,", "money crashes and defaults follow."]);
  const q = c("Why does a country this rich keep going broke?");
  assert.equal(q.length, 2);
  assert.equal(q.join(" "), "Why does a country this rich keep going broke?");
});

test("loaded / blame wording is rejected from montage lines", () => {
  const script = { sections: [{ id: "ch1", sentences: [{ text: "Debt kept rising for decades." }] }] };
  const v = M.validateLlmLines({ chorus: ["Reckless borrowing again.", "Debt keeps rising.", "Greedy lenders circle."], anchor: "A rich nation falls into debt because of relentless overspending." }, script);
  assert.deepEqual(v.chorus, ["Debt keeps rising."]);
  assert.equal(v.anchor, null);
  assert.ok(M.validateLlmLines({ chorus: [], anchor: "Why does a country this rich keep going broke?" }, script).anchor);
});

test("anchor shot: centred chunks timed to the voice, key phrase marked", () => {
  const { frames, photos } = fixture();
  const lines = fixture().lines;
  lines.anchor = { text: "Why does a country this rich keep going broke?", duration: 3.2, words: "Why does a country this rich keep going broke?".split(" ").map((w, k) => ({ text: w, start: k * 0.33, end: k * 0.33 + 0.3 })) };
  const plan = M.bestPlan({ lines, grid: grid112, frames, photos, seed: "t" });
  const an = plan.shots[plan.shots.length - 1];
  assert.equal(an.chunks.length, 2);
  assert.ok(an.chunks[1].t > an.chunks[0].t);
  assert.deepEqual(an.keySpan, [7, 8]);
});
