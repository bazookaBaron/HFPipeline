// DIALOGUE compiler: script.md + words (ASR times) [+ mg.json] -> episodes/<ep>/shots.json for the engine.
//   node dialogue/compiler/compile.mjs cloud
// Times are derived from the script + word times. The per-line table below encodes the approved PLAN.md shot list
// (rig / move / face / gesture / listener choices); it is the authority for those choices, nothing is hand-edited in JSON.
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const here = path.dirname(fileURLToPath(import.meta.url)), DLG = path.resolve(here, "..");
const ep = process.argv[2] || "cloud"; const EPD = path.join(DLG, "episodes", ep);
const r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000;

// ---------------- episode config (cloud) ----------------
const CFG = {
  cloud: {
    words: "fish/words6.json", audio: "fish/campfire_cloud_1p5x.wav", duration: 45.4, set: "campfire", pair: ["dadu", "rohan"],
    who: { WALTER: "A", LEO: "B" },
    // ASR spelling -> script tokens (PLAN: "Accompanies"="A company's", "40"="forty", "41"="Forty-one.")
    alias: { accompanies: ["a", "companys"], 40: ["forty"], 41: ["fortyone"] },
    lead: 0.15, // cut this long before the new speaker's first word
    tail: { t0: 42.60, rig: "wide2", move: ["push", 0.02] },
  },
}[ep] ?? (fs.existsSync(path.join(EPD, "plan.mjs")) ? (await import("file:///" + path.join(EPD, "plan.mjs").replace(/\\/g, "/"))).CFG : null);
if (!CFG) throw new Error("no config for episode " + ep);
// episodes other than cloud keep their PLAN table in episodes/<ep>/plan.mjs (export const CFG, PLAN, TAIL)
const EPPLAN = ep === "cloud" ? null : await import("file:///" + path.join(EPD, "plan.mjs").replace(/\\/g, "/"));

// ---------------- the PLAN table, per script line ----------------
// shots: first shot starts at the line cut; extra shots are reaction cut-ins starting in the pause before word `from`.
//   rig names: seat_X in the PLAN = the MS rig, engine name ms_X (seat_X stays the QA seat camera).
// face: speaker presets [[name, word?, weight?]] ; lis: listener presets ; g: speaker gestures [kind, word|'@start', opts] ; lg: listener gestures
// words are matched inside the line by normalised text, `#n` picks the n-th occurrence.
const PLAN = EPPLAN ? EPPLAN.PLAN : [
  { n: 1, shots: [{ rig: "ots_B", move: ["push", 0.03] }], face: [["curious"]], lis: [["warm"]], g: [["lean_in", "@start", { line: true }], ["tilt", "photos"]] },
  { n: 2, shots: [{ rig: "ms_A", plan: "seat_A", move: ["push", 0.03] }], face: [["warm"]], lis: [["curious"]], g: [["lean_back", "@start", { line: true }], ["open_palm", "building"]] },
  { n: 3, shots: [{ rig: "ots_B", move: ["hold"] }], face: [["surprised"], ["curious", "I"]], lis: [["amused", null, 0.6]], g: [["head_back", "building"], ["palm_up", "cloud"]] },
  { n: 4, shots: [{ rig: "ms_A", plan: "seat_A", move: ["hold"] }], face: [["amused"]], lis: [["curious"], ["confused", "building", 0.6]], g: [["shoulder_bounce", "is"], ["nod", "is"]] },
  { n: 5, shots: [{ rig: "ots_B", move: ["hold"] }], face: [["confused"]], lis: [["amused"]], g: [["tilt", "real"]] },
  { n: 6, shots: [{ rig: "ms_A", plan: "seat_A", move: ["push", 0.03] }, { from: "with", rig: "ms_B", plan: "seat_B", move: ["hold"], subject: "B", cutin: true }],
    face: [["warm"]], lis: [["curious"]], g: [["head_shake", "no"], ["two_hand_open", "huge"]], lg: [["nod", "fans"]] },
  { n: 7, shots: [{ rig: "ots_B", move: ["hold"] }], face: [["curious"]], lis: [["warm"]], g: [["lean_in", "@start", { line: true }]] },
  { n: 8, shots: [{ rig: "ms_A", plan: "seat_A", move: ["hold"] }, { from: "you", rig: "ms_B", plan: "seat_B", move: ["hold"], subject: "B", cutin: true }],
    face: [["firm_light"]], lis: [["curious"], ["worried", "rent"]], g: [["count", "google", { marks: ["google", "apple", "amazon"] }]], lg: [["brows_up", "rent"]] },
  { n: 9, shots: [{ rig: "mcu_B", move: ["push", 0.04] }], face: [["surprised"]], lis: [["tender"]], g: [["hands_lift", "someone"]] },
  { n: 10, shots: [{ rig: "wide2", move: ["push", 0.04] }], face: [["tender"]], lis: [["worried", null, 0.5], ["worried", "breaks"], ["relieved", "still"]],
    g: [["nod", "yes"], ["two_fingers", "spare"], ["palm_down", "still"]] },
  { n: 11, shots: [{ rig: "ots_B", move: ["hold"] }], face: [["impressed"]], lis: [["warm"]], g: [["hand_lift", "key"]] },
  { n: 12, shots: [{ rig: "ms_A", plan: "seat_A", move: ["hold"] }], face: [["amused"]], lis: [["impressed", null, 0.6]], g: [["nod", "exactly"], ["flick", "exactly"]] },
  { n: 13, shots: [{ rig: "ots_B", move: ["push", 0.03] }], face: [["thinking"]], lis: [["warm"]], g: [["palm_up", "any"]], gaze: "fire" },
  { n: 14, shots: [{ rig: "ms_A", plan: "seat_A", move: ["hold"] }, { from: "it", rig: "ms_B", plan: "seat_B", move: ["hold"], subject: "B", cutin: true }],
    face: [["warm"]], lis: [["thinking"], ["grin", "shows", 0.45]], g: [["nod", "right"], ["head_shake", "doesnt"]], lg: [["slow_nod", "shows"]] },
  { n: 15, shots: [{ rig: "mcu_B", move: ["push", 0.04] }], face: [["grin", null, 0.55], ["grin", "someone"]], lis: [["warm"]], g: [["two_hand_open", "someone"]] },
  { n: 16, shots: [{ rig: "ms_A", plan: "seat_A", move: ["hold"] }], face: [["proud"]], lis: [["grin", null, 0.8]], g: [["nod", "got"]] },
  { n: 17, shots: [{ rig: "ots_B", move: ["hold"] }], face: [["worried"]], lis: [["amused", null, 0.5]], g: [["lean_in", "@start", { line: true }], ["hand_chest", "took"]] },
  { n: 18, shots: [{ rig: "mcu_A", move: ["hold"] }], face: [["dry"]], lis: [["worried"]], g: [] },
];
// tail (no voice): Leo deflates, looks at the fire; Walter smiling
const TAIL = EPPLAN ? EPPLAN.TAIL : { face: { A: [["amused", 0.7]], B: [["worried", 0.8]] }, gaze: { B: "fire" }, g: [{ actor: "B", kind: "deflate" }] };
// gesture timing: [rise before the word, hold] seconds. Every gesture lands (reaches full) at the word start + 0.06 s.
const GDUR = { open_palm: [0.38, 0.6], palm_up: [0.34, 0.5], two_hand_open: [0.4, 0.75], count: [0.42, 0], two_fingers: [0.4, 0.9], palm_down: [0.36, 0.55], flick: [0.3, 0.3],
  hand_chest: [0.4, 0.8], hands_lift: [0.3, 0.75], hand_lift: [0.3, 0.45], head_shake: [0.08, 0.75], nod: [0.12, 0.3], slow_nod: [0.2, 0.7], tilt: [0.35, 0.8], head_back: [0.22, 0.45],
  shoulder_bounce: [0.1, 0.85], lean_in: [0.5, 0], lean_back: [0.5, 0], brows_up: [0.15, 0.6], deflate: [0.6, 0] };

// ---------------- inputs ----------------
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const scriptMd = fs.readFileSync(path.join(EPD, "script.md"), "utf8");
const lines = []; for (const raw of scriptMd.split(/\r?\n/)) { if (/^#end/.test(raw)) break; const m = /^([A-Z]+) \(([^)]*)\) \[(\w+)\]: (.*)$/.exec(raw.trim()); if (m) lines.push({ n: lines.length + 1, who: m[1], beat: m[2], cam: m[3], text: m[4], sp: CFG.who[m[1]] }); }
if (lines.length !== PLAN.length) throw new Error(`script has ${lines.length} lines, PLAN table ${PLAN.length}`);
const asr = JSON.parse(fs.readFileSync(path.join(DLG, CFG.words), "utf8")).map(([s, e, w]) => ({ s, e, w }));

// ---------------- align script tokens to ASR words (in order) ----------------
const words = []; let ai = 0;
for (const L of lines) {
  const toks = L.text.split(/\s+/).filter(Boolean); L.w0 = words.length; let k = 0;
  while (k < toks.length) {
    const A = asr[ai]; if (!A) throw new Error(`ran out of ASR words at line ${L.n} token "${toks[k]}"`); const an = norm(A.w);
    let span = 1; if (norm(toks[k]) !== an) { const al = CFG.alias[an]; if (!al) throw new Error(`line ${L.n}: script "${toks[k]}" vs ASR "${A.w}" (#${ai}) - no alias`); span = al.length; const got = toks.slice(k, k + span).map(norm); if (got.join("|") !== al.join("|")) throw new Error(`line ${L.n}: alias ${an} expects ${al} got ${got}`); }
    const part = toks.slice(k, k + span), tot = part.reduce((a, b) => a + norm(b).length, 0); let t = A.s;
    for (const tk of part) { const d = (A.e - A.s) * norm(tk).length / tot; words.push({ i: words.length, w: tk, s: r3(t), e: r3(t + d), sp: L.sp, line: L.n, asr: ai }); t += d; }
    k += span; ai++;
  }
  L.w1 = words.length - 1; L.s = words[L.w0].s; L.e = words[L.w1].e;
}
if (ai !== asr.length) throw new Error(`unused ASR words from #${ai}`);
const findWord = (L, key) => { if (key == null) return null; const [k, occ] = String(key).split("#"); let c = 0; for (let i = L.w0; i <= L.w1; i++) if (norm(words[i].w) === norm(k) && ++c === (+occ || 1)) return words[i]; throw new Error(`line ${L.n}: word "${key}" not found`); };

// ---------------- shots ----------------
const shots = []; const warn = [];
for (const L of lines) {
  const P = PLAN[L.n - 1]; const prev = words[L.w0 - 1];
  // cut CFG.lead before the first word; a latch (previous word ends within the lead) cuts on the word
  let t0 = L.n === 1 ? 0 : words[L.w0].s - CFG.lead; let latch = false; if (prev && prev.e > t0 + 1e-6) { t0 = words[L.w0].s; latch = true; }
  P.shots.forEach((S, j) => {
    let st = t0, kind = latch && j === 0 ? "latch" : "speaker";
    if (S.from) { const w = findWord(L, S.from), pw = words[w.i - 1]; st = Math.max(pw.e + 0.02, w.s - CFG.lead); kind = "cutin"; }
    shots.push({ n: shots.length + 1, t0: r2(st), t1: null, rig: S.rig, plan: S.plan ?? S.rig, move: { type: S.move[0], amt: S.move[0] === "push" ? S.move[1] ?? 0.03 : 0 }, line: L.n, speaker: L.sp, subject: S.subject ?? L.sp, cut: kind, cu: S.rig.startsWith("mcu") });
  });
}
shots.push({ n: shots.length + 1, t0: CFG.tail.t0, t1: null, rig: CFG.tail.rig, plan: CFG.tail.rig, move: { type: CFG.tail.move[0], amt: CFG.tail.move[1] }, line: 0, speaker: null, subject: null, cut: "tail", cu: false });
shots.forEach((s, i) => { s.t1 = i + 1 < shots.length ? shots[i + 1].t0 : CFG.duration; });

// ---------------- emotion tracks, gestures, listener reactions, gaze ----------------
const emotion = { A: [], B: [] }; const gestures = []; const gaze = [];
const other = s => (s === "A" ? "B" : "A");
const lineStart = L => shots.find(s => s.line === L.n).t0;
for (const L of lines) {
  const P = PLAN[L.n - 1]; const t0 = lineStart(L), tEnd = L.n < lines.length ? lineStart(lines[L.n]) : CFG.tail.t0;
  const put = (actor, list) => list.forEach(([name, wk, wt]) => { const w = findWord(L, wk); emotion[actor].push([Math.max(0, r2(w ? w.s - 0.1 : t0)), name, wt ?? 1]); });
  put(L.sp, P.face); put(other(L.sp), P.lis);
  const addG = (actor, [kind, wk, o = {}]) => {
    const [rise, hold] = GDUR[kind]; if (!GDUR[kind]) throw new Error("unknown gesture " + kind);
    if (wk === "@start") { const t = t0 + rise; gestures.push({ actor, kind, t: r2(t), rise, dur: r2(Math.max(0.3, tEnd - 0.35 - t)), line: L.n, word: null }); return; }
    const w = findWord(L, wk); const g = { actor, kind, t: r2(w.s + 0.06), rise, dur: hold, line: L.n, word: w.w };
    if (o.marks) { g.marks = o.marks.map(m => r2(findWord(L, m).s + 0.06)); g.dur = r2(g.marks[g.marks.length - 1] - g.t + 0.55); }
    words[w.i].stress = true; gestures.push(g);
  };
  (P.g ?? []).forEach(x => addG(L.sp, x)); (P.lg ?? []).forEach(x => addG(other(L.sp), x));
  if (P.gaze) gaze.push({ actor: L.sp, t0: r2(t0 + 0.2), t1: r2(L.e - 0.25), target: P.gaze });
}
for (const s of ["A", "B"]) for (const [name, wt] of TAIL.face[s]) emotion[s].push([CFG.tail.t0, name, wt]);
for (const [s, tg] of Object.entries(TAIL.gaze)) gaze.push({ actor: s, t0: r2(CFG.tail.t0 + 0.25), t1: CFG.duration + 1, target: tg });
for (const g of TAIL.g) gestures.push({ actor: g.actor, kind: g.kind, t: r2(CFG.tail.t0 + GDUR[g.kind][0] + 0.25), rise: GDUR[g.kind][0], dur: 9, line: 0, word: null });
for (const s of ["A", "B"]) { emotion[s].sort((a, b) => a[0] - b[0]); emotion[s] = emotion[s].filter((e, i, A) => i === 0 || e[1] !== A[i - 1][1] || e[2] !== A[i - 1][2]); if (emotion[s][0][0] > 0) emotion[s].unshift([0, emotion[s][0][1], emotion[s][0][2]]); }
gestures.sort((a, b) => a.t - b.t);

// ---------------- captions: script text, 2-6 word phrases, cut at sentence ends / commas, never across lines ----------------
const captions = [];
const split = (ws, n) => { const k = Math.ceil(ws.length / n), out = []; for (let i = 0; i < ws.length; i += k) out.push(ws.slice(i, i + k)); return out; };
const chunk = ws => ws.length <= (CFG.capMax ?? 6) ? [ws] : split(ws, Math.ceil(ws.length / (CFG.capMax ?? 5)));  // CFG.capMax: send uses 5 so a long-word phrase never wraps into the card
for (const L of lines) {
  const ws = words.slice(L.w0, L.w1 + 1); const sents = []; let cur = [];
  ws.forEach((w, i) => { cur.push(w); if (/[.?!]$/.test(w.w) || i === ws.length - 1) { sents.push(cur); cur = []; } });
  let groups = [];
  for (const se of sents) { const parts = []; let c = []; se.forEach((w, i) => { c.push(w); if ((/,$/.test(w.w) || /\.\.\.$/.test(w.w)) && i < se.length - 1) { parts.push(c); c = []; } }); if (c.length) parts.push(c);
    // a single word before a comma rides with the next part ("Grandpa, where ...")
    for (let i = 0; i < parts.length - 1; i++) if (parts[i].length === 1) { parts.splice(i, 2, parts[i].concat(parts[i + 1])); i--; }
    if (parts.length > 1 && parts[parts.length - 1].length === 1) parts.splice(-2, 2, parts[parts.length - 2].concat(parts[parts.length - 1]));
    for (const p of parts) groups.push(...chunk(p)); }
  // 1-word sentence ("No.", "Yes.", "Right."): join the next group, splitting it first if the result would pass 6 words
  for (let i = 0; i < groups.length; i++) if (groups[i].length === 1 && groups.length > 1) { const j = i + 1 < groups.length ? i + 1 : i - 1; if (groups[j].length + 1 > 6) groups.splice(j, 1, ...split(groups[j], 2)); const m = j > i ? groups[i].concat(groups[j]) : groups[j].concat(groups[i]); groups.splice(Math.min(i, j), 2, m); }
  for (const g of groups) captions.push({ text: g.map(w => w.w).join(" "), s: r2(g[0].s), e: r2(g[g.length - 1].e), line: L.n, sp: L.sp });
}
captions.forEach((c, i) => { const nx = captions[i + 1]; c.e = r2(Math.min(c.e + 0.35, nx ? nx.s - 0.06 : c.e + 0.6)); });

// ---------------- optional mg.json: layout windows (card up -> 9:16 stack) ----------------
let mgWindows = null; const mgj = path.join(EPD, "mg.json");
if (fs.existsSync(mgj)) { try { const m = JSON.parse(fs.readFileSync(mgj, "utf8")); const cues = m.cues ?? m.beats ?? []; mgWindows = cues.map(c => ({ t0: c.t0 ?? c.at ?? c.start, t1: c.t1 ?? c.end ?? ((c.at ?? c.t0) + c.dur), name: c.name ?? c.title ?? c.id ?? "" })).filter(c => isFinite(c.t0) && isFinite(c.t1)); } catch (e) { warn.push("mg.json unreadable: " + e.message); } }

// ---------------- write ----------------
const out = {
  ep, generated: "dialogue/compiler/compile.mjs (do not hand-edit)", ratio: "9x16", duration: CFG.duration, set: CFG.set, pair: CFG.pair, audio: "dialogue/" + CFG.audio, words_src: "dialogue/" + CFG.words,
  cast: { A: { id: CFG.pair[0], name: "Walter" }, B: { id: CFG.pair[1], name: "Leo" } },
  lines: lines.map(L => ({ n: L.n, sp: L.sp, beat: L.beat, cam: L.cam, text: L.text, s: L.s, e: L.e, w0: L.w0, w1: L.w1 })),
  shots, emotion, gestures, gaze, words: words.map(({ i, w, s, e, sp, line, stress }) => ({ i, w, s, e, sp, line, ...(stress ? { stress } : {}) })), captions, mgWindows, tailPlan: TAIL, warnings: warn,
};
fs.writeFileSync(path.join(EPD, "shots.json"), JSON.stringify(out, null, 1));
console.log(`shots.json: ${shots.length} shots, ${gestures.length} gestures, ${captions.length} captions, ${words.length} words; emotion A ${emotion.A.length} B ${emotion.B.length}`);
for (const s of shots) console.log(`  #${String(s.n).padStart(2)} ${s.t0.toFixed(2)}-${s.t1.toFixed(2)} ${s.rig.padEnd(6)} ${s.move.type}${s.move.amt ? " " + s.move.amt : ""} L${s.line} ${s.cut}`);
if (warn.length) console.log("WARN", warn);
