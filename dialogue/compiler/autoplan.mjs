// DIALOGUE auto shot planner: script.md (+ ASR word times, optional [mg:] tags / mg.beats.json) -> PLAN.auto.md + shots.json (same format as compile.mjs).
//   node dialogue/compiler/autoplan.mjs <ep> [--ratio 9x16|16x9] [--plan-md]   (--plan-md also writes PLAN.md when none exists, so gates.mjs can run)
// Optional episodes/<ep>/episode.json overrides the defaults: { words, audio, duration, set, pair:[A,B], who:{WALTER:"A",LEO:"B"}, alias:{asr:[script tokens]}, lead, tail }.
// Script line:  SPEAKER (emotion words) [CU|MS|2S]: text [mg: CUE NAME | word=verb ; word#2=verb]
// Everything is rule based (tables below). Writes: PLAN.auto.md, shots.json, mg.auto.json (if mg beats), PLAN.auto.flags.json (shots for a human look).
import fs from "fs"; import path from "path"; import cp from "child_process"; import { fileURLToPath } from "url"; import { varietyCheck, VAR } from "./gate_variety.mjs";
const here = path.dirname(fileURLToPath(import.meta.url)), DLG = path.resolve(here, "..");
const args = process.argv.slice(2); const ep = args.find(a => !a.startsWith("--")) || "cloud"; const ri = args.indexOf("--ratio"); const RATIO = ri >= 0 ? args[ri + 1] : "9x16";
if (!["9x16", "16x9"].includes(RATIO)) throw new Error("--ratio 9x16|16x9");
const EPD = path.join(DLG, "episodes", ep); const r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000; const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const rj = f => JSON.parse(fs.readFileSync(f, "utf8"));
const CFG = { words: "fish/words6.json", audio: "fish/campfire_cloud_1p5x.wav", duration: null, set: "campfire", pair: ["dadu", "rohan"], who: null, alias: {}, lead: 0.15, tail: 1.55, ...(fs.existsSync(path.join(EPD, "episode.json")) ? rj(path.join(EPD, "episode.json")) : {}) };
const alias = { ...CFG.alias };

// ---------------- RULE TABLES ----------------
// emotion tag (first match in the tag text) -> [key, speaker preset (engine facelayer EMO name)]. The key selects listener / camera / gesture behaviour.
const EMO_KEYS = [[/shock/, "shocked", "surprised"], [/surpris/, "surprised", "surprised"], [/confus/, "confused", "confused"], [/curious/, "curious", "curious"], [/grin/, "grin", "grin"], [/impress/, "impressed", "impressed"], [/reassur|tender|gentle|soft/, "tender", "tender"],
  [/matter|firm|neutral|flat|calm/, "firm_light", "firm_light"], [/amus|pleased|playful|smirk/, "amused", "amused"], [/warm|friendly|kind/, "warm", "warm"], [/think|ponder/, "thinking", "thinking"], [/proud/, "proud", "proud"], [/worr|nervous|anxious|scared/, "worried", "worried"],
  [/dry|deadpan|wry/, "dry", "dry"], [/relief/, "relieved", "relieved"]];
// listener preset while the other person speaks: key -> [preset, weight]
const LIS = { curious: ["warm"], warm: ["curious"], surprised: ["amused", 0.6], shocked: ["tender"], amused: ["curious"], confused: ["amused"], firm_light: ["curious"], tender: ["worried", 0.5], impressed: ["warm"], thinking: ["warm"], grin: ["warm"], proud: ["grin", 0.8], worried: ["amused", 0.5], dry: ["worried"], relieved: ["warm"] };
const NEG = new Set("break breaks broke broken lose loses lost crash crashes dies dead fail fails failed gone delete deleted hack hacked stolen danger risk wrong".split(" ")), POS = new Set("safe safely still fine backup saved protected works fixed".split(" "));
const MONEY = new Set("rent pay pays paid cost costs price buy sell free money cheap expensive".split(" ")), SLOWNOD = new Set("shows show means understand because".split(" "));
const STOP = new Set("with that they them there what when where whose which your just have this from into about would could thought went then than some like does know keep much want been were will here very also".split(" "));
const NUMW = { two: "two_fingers", three: "count", four: "count", five: "count" };
// keyword -> gesture (speaker). head/nod are body; the rest use hands.
const KEYG = [[["no", "nope", "doesnt", "dont", "never", "cant"], "head_shake"], [["yes", "yeah", "right", "exactly", "correct", "sure", "got", "understood"], "nod"], [["huge", "giant", "massive", "enormous", "everything", "whole"], "two_hand_open"], [["safe", "safely", "relax", "calm"], "palm_down"]];
const EXTRA = { exactly: ["flick"] };
const HAND = new Set(["open_palm", "palm_up", "hand_lift", "two_hand_open", "hands_lift", "count", "two_fingers", "flick", "palm_down", "hand_chest"]);
const GDUR = { open_palm: [0.38, 0.6], palm_up: [0.34, 0.5], two_hand_open: [0.4, 0.75], count: [0.42, 0], two_fingers: [0.4, 0.9], palm_down: [0.36, 0.55], flick: [0.3, 0.3], hand_chest: [0.4, 0.8], hands_lift: [0.3, 0.75], hand_lift: [0.3, 0.45], head_shake: [0.08, 0.75], nod: [0.12, 0.3], slow_nod: [0.2, 0.7], tilt: [0.35, 0.8], head_back: [0.22, 0.45], shoulder_bounce: [0.1, 0.85], lean_in: [0.5, 0], lean_back: [0.5, 0], brows_up: [0.15, 0.6], deflate: [0.6, 0] };
const PLANFACE = { firm_light: "neutral/firm-light", impressed: "surprised-light + smile" };   // spelling the gates.mjs face parser knows

// ---------------- parse script ----------------
const scriptMd = fs.readFileSync(path.join(EPD, "script.md"), "utf8"); const lines = []; const speakersSeen = [];
for (const raw of scriptMd.split(/\r?\n/)) {
  if (/^#end/.test(raw)) break; let t = raw.trim(); let mg = null; const mm = /\s*\[mg:([^\]]*)\]\s*$/.exec(t); if (mm) { mg = mm[1].trim(); t = t.slice(0, mm.index).trim(); }
  const m = /^([A-Z]+) \(([^)]*)\)(?: \[(\w+)\])?: (.*)$/.exec(t); if (!m) continue; if (!speakersSeen.includes(m[1])) speakersSeen.push(m[1]);
  lines.push({ n: lines.length + 1, who: m[1], beat: m[2], cam: m[3] ?? null, text: m[4], mg });
}
if (!lines.length) throw new Error("no script lines (format: SPEAKER (emotion) [CU]: text)");
// default speaker map: first speaker (the asker) = B (screen-right), second = A. Override with episode.json who.
const who = CFG.who ?? (speakersSeen.length === 2 ? { [speakersSeen[0]]: "B", [speakersSeen[1]]: "A" } : null); if (!who) throw new Error("episode.json needs who:{NAME:'A'|'B'}");
lines.forEach(L => L.sp = who[L.who]); const other = s => (s === "A" ? "B" : "A");
const cast = {}; for (const s of "AB") { const nm = Object.keys(who).find(k => who[k] === s); cast[s] = { id: CFG.pair[s === "A" ? 0 : 1], name: nm[0] + nm.slice(1).toLowerCase() }; }
const warn = [], flags = {}; const flag = (n, why) => (flags[n] ??= []).push(why);

// ---------------- align script tokens to ASR words (fuzzy: merges/splits/typos/numbers) ----------------
const asr = rj(path.join(DLG, CFG.words)).map(([s, e, w]) => ({ s, e, w }));
const ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" "), TENS = "x x twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
const numNorm = n => n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ONES[n % 10] : "");
const nrm2 = s => { const n = norm(s); return /^\d{1,2}$/.test(n) ? numNorm(+n) : n; };
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length] / Math.max(a.length, b.length, 1); };
const words = []; let ai = 0;
for (const L of lines) {
  const toks = L.text.split(/\s+/).filter(Boolean); L.w0 = words.length; let k = 0;
  while (k < toks.length) {
    const A = asr[ai]; if (!A) throw new Error(`ran out of ASR words at line ${L.n} token "${toks[k]}"`); let best = null;
    const al = alias[norm(A.w)]; if (al && al.join("|") === toks.slice(k, k + al.length).map(norm).join("|")) best = { ks: al.length, as: 1, sc: 0 };
    for (const [ks, as] of best ? [] : [[1, 1], [2, 1], [3, 1], [1, 2], [1, 3]]) { if (k + ks > toks.length || ai + as > asr.length) continue; const sc = lev(toks.slice(k, k + ks).map(nrm2).join(""), asr.slice(ai, ai + as).map(x => nrm2(x.w)).join("")) + (ks + as > 2 ? 0.02 : 0); if (!best || sc < best.sc - 1e-9) best = { ks, as, sc }; }
    if (!best || best.sc > 0.45) { warn.push(`line ${L.n}: script "${toks[k]}" vs ASR "${A.w}" (#${ai}) - forced 1:1`); flag(L.n, "word alignment forced"); best = { ks: 1, as: 1, sc: 1 }; }
    else if (best.sc > 0.05) warn.push(`line ${L.n}: fuzzy align "${toks.slice(k, k + best.ks).join(" ")}" ~ ASR "${asr.slice(ai, ai + best.as).map(x => x.w).join(" ")}"`);
    const part = toks.slice(k, k + best.ks), tot = part.reduce((a, b) => a + (norm(b).length || 1), 0); const s0 = asr[ai].s, e0 = asr[ai + best.as - 1].e; let t = s0;
    for (const tk of part) { const d = (e0 - s0) * (norm(tk).length || 1) / tot; words.push({ i: words.length, w: tk, s: r3(t), e: r3(t + d), sp: L.sp, line: L.n, asr: ai }); t += d; }
    k += best.ks; ai += best.as;
  }
  L.w1 = words.length - 1; L.s = words[L.w0].s; L.e = words[L.w1].e;
}
if (ai !== asr.length) warn.push(`unused ASR words from #${ai} (${asr.slice(ai).map(x => x.w).join(" ")})`);
const lw = L => words.slice(L.w0, L.w1 + 1);
const findWord = (L, key) => { if (key == null) return null; const [k, occ] = String(key).split("#"); let c = 0; const kk = norm(k.split(/\s+/)[0]); for (let i = L.w0; i <= L.w1; i++) if (norm(words[i].w) === kk && ++c === (+occ || 1)) return words[i]; return null; };

// ---------------- duration ----------------
let duration = CFG.duration;
if (duration == null) { try { duration = +cp.execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path.join(DLG, CFG.audio)]).toString().trim(); } catch { duration = words[words.length - 1].e + 4; warn.push("no audio duration; last word + 4 s"); } }
duration = r2(duration);

// ---------------- emotion keys, rigs, splits ----------------
const keyOf = L => { const b = L.beat.toLowerCase(); const m = EMO_KEYS.find(([re]) => re.test(b)); if (!m) { warn.push(`line ${L.n}: unknown emotion "${L.beat}" -> warm`); flag(L.n, "unknown emotion tag"); return ["warm", "warm"]; } return [m[1], m[2]]; };
lines.forEach(L => { [L.key, L.preset] = keyOf(L); L.dur = L.e - L.s; L.isQ = /\?$/.test(L.text.trim()); });
const MCUSCORE = { shocked: 3, dry: 3, grin: 2, surprised: 1, worried: 0.5 }; let lastMcu = -9, lastPush = false; const shots = [];
lines.forEach((L, i) => {
  const prev = lines[i - 1]; const last = i === lines.length - 1; const pw = words[L.w0 - 1]; let t0 = i === 0 ? 0 : words[L.w0].s - CFG.lead, latch = false; if (pw && pw.e > t0 + 1e-6) { t0 = words[L.w0].s; latch = true; }
  let rig, move = ["hold"]; const score = (MCUSCORE[L.key] ?? 0) + (last ? 2 : 0); const sp = L.sp;
  if (L.cam === "2S" || L.dur >= 4.0) rig = "wide2"; else if (i > 0 && (score >= 4 || (score >= 2 && i - lastMcu >= 4))) rig = "mcu_" + sp; else rig = sp === "A" ? "ms_A" : "ots_B";
  const pr = shots.filter(s => s.cut !== "cutin").slice(-1)[0]; if (pr && pr.rig === "wide2" && rig === "wide2") { rig = sp === "A" ? "ms_A" : "ots_B"; flag(L.n, "wide2 twice in a row -> MS/OTS"); }
  if (rig.startsWith("mcu")) lastMcu = i;
  // push: CU-B / wide 4 %, first line 3 %, otherwise 3 % on beat openers (not after another push, not short quips); mcu_A always holds (deadpan; gates.mjs expects it)
  if (rig === "mcu_B" || rig === "wide2") move = ["push", 0.04]; else if (rig === "mcu_A") move = ["hold"];
  else if (i === 0) move = ["push", 0.03];
  else { const opener = !lastPush && L.dur >= 1.7 && L.dur < 4 && !["amused", "dry", "confused", "proud", "impressed", "firm_light"].includes(L.key) && !(prev && prev.sp === sp); if (opener) move = ["push", 0.03]; }
  lastPush = move[0] === "push"; const plan = rig === "ms_A" ? "seat_A" : rig;
  const cuts = [{ t0, rig, plan, move, subject: sp, cut: latch ? "latch" : "speaker", cu: rig.startsWith("mcu") }];
  // long line: split at the largest pause (>= 0.25 s) leaving >= 1.2 s before and >= 1.0 s after, with a listener reaction cut-in (never on CU / wide)
  if (L.dur > 2.2 && rig !== "wide2" && !rig.startsWith("mcu")) {
    let bestG = null; for (let w = L.w0 + 1; w <= L.w1; w++) { const gap = words[w].s - words[w - 1].e; const st = Math.max(words[w - 1].e + 0.02, words[w].s - CFG.lead); if (gap >= 0.25 && st - t0 >= 1.2 && L.e - st >= 1.0 && (!bestG || gap > bestG.gap + 1e-9)) bestG = { w, gap, st }; }
    if (bestG) { const lis = other(sp); cuts.push({ t0: bestG.st, rig: lis === "A" ? "ms_A" : "ms_B", plan: lis === "A" ? "seat_A" : "seat_B", move: ["hold"], subject: lis, cut: "cutin", cu: false }); flag(L.n, `split into a cut-in at ${r2(bestG.st)} (pause ${Math.round(bestG.gap * 1000)} ms)`); }
  }
  if (rig.startsWith("mcu") || rig === "wide2") flag(L.n, `${rig} choice (${L.key})`);
  for (const c of cuts) shots.push({ n: shots.length + 1, t0: r2(c.t0), t1: null, rig: c.rig, plan: c.plan, move: { type: c.move[0], amt: c.move[0] === "push" ? c.move[1] : 0 }, line: L.n, speaker: L.sp, subject: c.subject, cut: c.cut, cu: c.cu });
});
const lastL = lines[lines.length - 1]; const tailT0 = r2(words[words.length - 1].e + CFG.tail); const hasTail = duration - tailT0 >= 1.0;
if (hasTail) shots.push({ n: shots.length + 1, t0: tailT0, t1: null, rig: "wide2", plan: "wide2", move: { type: "push", amt: 0.02 }, line: 0, speaker: null, subject: null, cut: "tail", cu: false });
shots.forEach((s, i) => { s.t1 = i + 1 < shots.length ? shots[i + 1].t0 : duration; });

// ---------------- camera variety (gate_variety.mjs rules; angle table from engine/render.mjs rigdump) ----------------
// Cut TIMES are untouched. Only the rig of each shot is re-chosen inside its class (pair / close / mid): no rig twice in a row, no rig > ~30 % of the shots, >= 3 distinct angles per 10 s,
// the same subject's consecutive shots >= 15 deg apart (az/el) or a size step. slow_push only on punch/button lines, arc on shots >= 2 s. Coordinate descent with seeded restarts.
const ANG = (() => { const f = path.join(here, `rig_angles_${CFG.set}_${RATIO}.json`); return fs.existsSync(f) ? rj(f) : null; })();
if (!ANG) warn.push(`no compiler/rig_angles_${CFG.set}_${RATIO}.json (run: node runtime/jobq.js --kind render -- node dialogue/engine/render.mjs rigdump ${CFG.set} ${RATIO}); camera variety skipped`);
else {
  const PAIR = ["wide2", "high34", "profile2", "tent_wide"]; const lineOf = n => lines[n - 1]; const durOf = s => s.t1 - s.t0;
  const punchy = s => { const L = lineOf(s.line); return !!L && (["dry", "shocked", "grin", "amused", "proud"].includes(L.key) || L.n === lines.length); };
  const cands = shots.map(s => { const sub = s.subject; const origRig = s.rig; let list;
    if (s.cut === "tail" || origRig === "wide2") list = [...PAIR];
    else if (s.cut === "cutin") list = [`ms_${sub}`, `low_fire_${sub}`, `arc_${sub}`];
    else if (origRig.startsWith("mcu")) list = [`mcu_${sub}`, `low_fire_${sub}`, `slow_push_${sub}`, `arc_${sub}`];
    else list = sub === "A" ? ["ms_A", "arc_A", "low_fire_A", "slow_push_A", "mcu_A"] : ["ots_B", "ms_B", "arc_B", "low_fire_B", "slow_push_B", "mcu_B"];
    return list.filter(r => ANG[r] && (!r.startsWith("slow_push") || (punchy(s) && durOf(s) >= 1.6)) && (!r.startsWith("arc") || durOf(s) >= 2.0) && (!r.startsWith("mcu") || origRig.startsWith("mcu"))); });
  // (additive 2026-11-11) episode.json "avoidUnderCards": rig prefixes never used while an MG card is up (windows from mg.beats.json at/end), e.g. low_fire glare, small-actor pair rigs
  { const ej = path.join(EPD, "episode.json"), mb = path.join(EPD, "mg.beats.json"); const av = fs.existsSync(ej) ? rj(ej).avoidUnderCards : null;
    const avAll = fs.existsSync(ej) ? rj(ej).avoidRigs : null; // (additive) rig prefixes this episode never uses (e.g. low_fire: full-frame caption row sits on the CU face)
    if (avAll) cands.forEach((l, i) => { const k = l.filter(r => !avAll.some(a => r.startsWith(a))); if (k.length) cands[i] = k; });
    if (av && fs.existsSync(mb)) { const jb = rj(mb), win = (Array.isArray(jb) ? jb : jb.cues ?? []).filter(c => c.at != null && c.end != null);
      cands.forEach((l, i) => { const s = shots[i]; if (!win.some(w => s.t0 < w.end && s.t1 > w.at)) return; let k = l.filter(r => !av.some(a => r.startsWith(a)));
        // (additive 2026-11-11, qr) a pair-class shot whose whole list is banned under a card falls back to the speaker's MS/CU rigs instead of keeping the banned pair rig
        if (!k.length && s.speaker) { const sub = s.speaker; k = (sub === "A" ? ["ms_A", "arc_A", "mcu_A"] : ["ots_B", "ms_B", "mcu_B"]).filter(r => ANG[r] && !av.some(a => r.startsWith(a)) && !(avAll ?? []).some(a => r.startsWith(a)) && (!r.startsWith("arc") || (s.t1 - s.t0) >= 2.0)); }
        if (k.length) cands[i] = k; }); } }
  cands.forEach((l, i) => { if (shots[i].cut !== "tail" && shots[i].line === lines.length) { const k = l.findIndex(r => r.startsWith("slow_push")); if (k > 0) l.unshift(...l.splice(k, 1)); } });
  const camOf = (rig, sub) => { const c = ANG[rig].u5; return { sub: PAIR.includes(rig) ? "pair" : c.sub, az: c.az, el: c.el, half: c.half }; };
  const rigsOf = a => shots.map((s, i) => ({ n: s.n, t0: s.t0, t1: s.t1, rig: a[i] }));
  const cost = a => { const r = varietyCheck(rigsOf(a), i => camOf(a[i]), duration); const cnt = {}; a.forEach(x => cnt[x] = (cnt[x] ?? 0) + 1); const pref = a.reduce((t, x, i) => t + cands[i].indexOf(x), 0);
    return r.total * 100 + pref * 0.6 + Object.values(cnt).reduce((t, c) => t + c * c, 0) * 0.5; };
  let seed = 1234567; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const descend = a => { let best = cost(a), ch = true, pass = 0; while (ch && pass++ < 40) { ch = false; for (let i = 0; i < a.length; i++) { const keep = a[i]; let bi = keep; for (const c of cands[i]) { if (c === keep) continue; a[i] = c; const v = cost(a); if (v < best - 1e-9) { best = v; bi = c; ch = true; } } a[i] = bi; } } return best; };
  const base = shots.map((s, i) => cands[i].includes(s.rig) ? s.rig : cands[i][0]); let bestA = base.slice(), bestC = descend(bestA);
  for (let k = 0; k < 60; k++) { const a = shots.map((s, i) => cands[i][Math.floor(rnd() * cands[i].length)]); const c = descend(a); if (c < bestC - 1e-9) { bestC = c; bestA = a; } }
  const fin = varietyCheck(rigsOf(bestA), i => camOf(bestA[i]), duration);
  shots.forEach((s, i) => { const r = bestA[i]; if (r !== s.rig) { s.move = s.cut === "tail" ? s.move : r === "wide2" || r === "mcu_B" ? { type: "push", amt: 0.04 } : { type: "hold", amt: 0 }; s.rig = r; s.plan = r.startsWith("ms_") ? "seat_" + r.slice(3) : r; s.cu = /^(mcu|low_fire|slow_push)/.test(r); }
    else if (s.cut === "tail") s.move = { type: "push", amt: 0.02 }; });
  for (const [k, v] of Object.entries(fin.fails)) v.forEach(x => warn.push(`camera variety ${k}: ${x}`));
  console.log(`camera variety: ${fin.total} violations left; rigs ${JSON.stringify(fin.stats.cnt)}; fewest angles in a 10 s window ${fin.stats.minWindowAngles}`);
}
shots.forEach(s => { if (s.t1 - s.t0 < 0.8) flag(s.line, `shot #${s.n} only ${r2(s.t1 - s.t0)} s (gate d min 0.8 s)`); });
const lineStart = L => shots.find(s => s.line === L.n).t0; const lineEnd = L => (L.n < lines.length ? lineStart(lines[L.n]) : hasTail ? tailT0 : duration);

// ---------------- faces, gestures, listener, gaze ----------------
const emotion = { A: [], B: [] }; const gestures = []; const gaze = [];
const stressWords = L => lw(L).filter((w, idx) => { const n = norm(w.w); return n.length >= 4 && !STOP.has(n) && !(idx === 0 && /,$/.test(w.w)); });
const addG = (L, actor, kind, w, o = {}) => {
  const [rise, hold] = GDUR[kind]; const t0 = lineStart(L), tEnd = lineEnd(L);
  if (w === "@start") { const t = t0 + rise; gestures.push({ actor, kind, t: r2(t), rise, dur: r2(Math.max(0.3, tEnd - 0.35 - t)), line: L.n, word: null }); return; }
  let t = w.s + 0.06; if (t - rise < t0 - 0.02) t = t0 + rise; if (t > tEnd - 0.25) return; const g = { actor, kind, t: r2(t), rise, dur: hold, line: L.n, word: w.w };
  if (o.marks) { g.marks = o.marks.map(m => r2(m.s + 0.06)); g.dur = r2(g.marks[g.marks.length - 1] - g.t + 0.55); }
  const clash = HAND.has(kind) && gestures.some(x => x.actor === actor && HAND.has(x.kind) && g.t - rise < x.t + (x.dur || 0.5) && x.t - x.rise < g.t + g.dur + 0.1);
  if (clash) { flag(L.n, `gesture ${kind} dropped (hand clash)`); return; }
  if (HAND.has(kind) && actor === L.sp) w.stress = true; gestures.push(g);
};
for (const [li, L] of lines.entries()) {
  const prev = lines[li - 1]; const t0 = lineStart(L); const ws = lw(L); const sp = L.sp, lis = other(sp);
  const put = (actor, name, w, wt) => emotion[actor].push([Math.max(0, r2(w ? w.s - 0.1 : t0)), name, wt ?? 1]);
  // speaker face; a surprised opener settles to curious (B) / warm (A) after its first sentence
  put(sp, L.preset, null); const nextSent = []; ws.forEach((w, i) => { if (/[.?!]$/.test(w.w) && i < ws.length - 1) nextSent.push(ws[i + 1]); });
  if (L.key === "surprised" && nextSent.length) put(sp, sp === "B" ? "curious" : "warm", nextSent[0]);
  // listener face: reaction table, then worried on a NEG word and relieved on the next POS word
  const lp = LIS[L.key] ?? ["warm"]; put(lis, lp[0], null, lp[1]);
  const negI = ws.findIndex(w => NEG.has(norm(w.w))); if (negI >= 0) { put(lis, "worried", ws[negI]); const pi = ws.findIndex((w, i) => i > negI && POS.has(norm(w.w))); if (pi >= 0) put(lis, "relieved", ws[pi]); }
  // speaker gestures: line-start posture, lists, keywords, else one default beat by emotion
  if (sp === "B" && ["curious", "worried"].includes(L.key)) addG(L, sp, "lean_in", "@start");
  if (sp === "A" && L.key === "warm" && prev && prev.sp === "B" && prev.isQ && !lines.slice(0, li).some(x => x.sp === "A")) addG(L, sp, "lean_back", "@start");
  let kw = 0; const lists = [];   // runs of >= 3 capitalised single words separated by commas ("Google, Apple, Amazon.") -> count on fingers
  for (let i = 0; i < ws.length; i++) { let j = i; const run = []; while (j < ws.length && /^[A-Z]/.test(ws[j].w)) { run.push(ws[j]); if (/,$/.test(ws[j].w)) j++; else break; } if (run.length >= 3 && run.slice(0, -1).every(w => /,$/.test(w.w))) { lists.push(run); i = j; } }
  for (const run of lists) { addG(L, sp, "count", run[0], { marks: run }); kw++; }
  ws.forEach((w, i) => {
    const n = norm(w.w); if (lists.some(r => r.includes(w))) return;
    if (n === "spare" && norm(ws[i + 1]?.w ?? "") === "copies") { addG(L, sp, "two_fingers", w); kw++; return; }
    if (NUMW[n]) { addG(L, sp, NUMW[n], w, NUMW[n] === "count" ? { marks: [w] } : {}); kw++; return; }
    if (/^[1-5]$/.test(n)) { addG(L, sp, n === "2" ? "two_fingers" : "count", w, n === "2" ? {} : { marks: [w] }); kw++; return; }
    for (const [keys, kind] of KEYG) if (keys.includes(n)) { if ((n === "no" || n === "right") && !/[.,!]$/.test(w.w)) return; addG(L, sp, kind, w); for (const x of EXTRA[n] ?? []) addG(L, sp, x, w); kw++; return; }
  });
  if (!kw) {
    const st = stressWords(L), nW = ws.length; const at55 = st.find(w => (w.i - L.w0) >= 0.55 * nW), first = st[0], lastSt = st[st.length - 1];
    if (L.key === "curious" && nW >= 4 && first) addG(L, sp, "tilt", first); else if (L.key === "confused" && first) addG(L, sp, "tilt", first);
    else if (L.key === "surprised") { if (first) addG(L, sp, "head_back", first); if (lastSt && lastSt !== first) addG(L, sp, sp === "A" ? "open_palm" : "palm_up", lastSt); }
    else if (L.key === "warm" || L.key === "tender") { if (first) addG(L, sp, sp === "A" ? "open_palm" : "palm_up", first); }
    else if (L.key === "amused" && nW >= 3) { addG(L, sp, "shoulder_bounce", ws[2]); addG(L, sp, "nod", ws[2]); }
    else if (L.key === "shocked" && at55) addG(L, sp, "hands_lift", at55); else if (L.key === "grin" && at55) addG(L, sp, "two_hand_open", at55);
    else if (L.key === "impressed") { const w = [...ws].reverse().find(w => norm(w.w).length >= 3 && !STOP.has(norm(w.w))); if (w) addG(L, sp, "hand_lift", w); }
    else if (L.key === "thinking") { const w = st.find(w => (w.i - L.w0) >= 0.7 * nW); if (w) addG(L, sp, "palm_up", w); }
    else if (L.key === "worried" && at55) addG(L, sp, "hand_chest", at55);
  }
  if (L.key === "thinking") gaze.push({ actor: sp, t0: r2(t0 + 0.2), t1: r2(L.e - 0.25), target: "fire" });
  // listener reaction in a cut-in: nod / brows (money words) / slow nod, on the first content word of the cut-in segment
  const ci = shots.find(s => s.line === L.n && s.cut === "cutin");
  if (ci) { const seg = ws.filter(w => w.s >= ci.t0 + CFG.lead - 0.01); const hit = seg.find(w => SLOWNOD.has(norm(w.w)) || MONEY.has(norm(w.w))) ?? seg.find(w => norm(w.w).length >= 4 && !STOP.has(norm(w.w)));
    if (hit) { const n = norm(hit.w); const kind = MONEY.has(n) ? "brows_up" : SLOWNOD.has(n) ? "slow_nod" : "nod"; addG(L, lis, kind, hit); if (kind === "brows_up") put(lis, "worried", hit); if (kind === "slow_nod") put(lis, "grin", hit, 0.45); } }
}
// tail: after a dry/grin punchline the listener deflates and looks at the fire; otherwise both stay warm
const punch = ["dry", "grin"].includes(lastL.key) || /funny|dry|deadpan/.test(lastL.beat);
const TAIL = punch ? { A: [["amused", 0.7]], B: [["worried", 0.8]], deflate: true } : { A: [["warm", 0.8]], B: [["warm", 0.8]], deflate: false };
if (hasTail) { for (const s of ["A", "B"]) for (const [n, w] of TAIL[s]) emotion[s].push([tailT0, n, w]); gaze.push({ actor: "B", t0: r2(tailT0 + 0.25), t1: duration + 1, target: "fire" }); if (TAIL.deflate) gestures.push({ actor: "B", kind: "deflate", t: r2(tailT0 + GDUR.deflate[0] + 0.25), rise: GDUR.deflate[0], dur: 9, line: 0, word: null }); }
for (const s of ["A", "B"]) { emotion[s].sort((a, b) => a[0] - b[0]); emotion[s] = emotion[s].filter((e, i, A) => i === 0 || e[1] !== A[i - 1][1] || e[2] !== A[i - 1][2]); if (emotion[s][0][0] > 0) emotion[s].unshift([0, emotion[s][0][1], emotion[s][0][2]]); }
gestures.sort((a, b) => a.t - b.t);

// ---------------- captions (same grouping as compile.mjs) ----------------
const captions = []; const split = (ws, n) => { const k = Math.ceil(ws.length / n), out = []; for (let i = 0; i < ws.length; i += k) out.push(ws.slice(i, i + k)); return out; }; const chunk = ws => ws.length <= 6 ? [ws] : split(ws, Math.ceil(ws.length / 5));
for (const L of lines) {
  const ws = lw(L); const sents = []; let cur = []; ws.forEach((w, i) => { cur.push(w); if (/[.?!]$/.test(w.w) || i === ws.length - 1) { sents.push(cur); cur = []; } }); const groups = [];
  for (const se of sents) { const parts = []; let c = []; se.forEach((w, i) => { c.push(w); if ((/,$/.test(w.w) || /\.\.\.$/.test(w.w)) && i < se.length - 1) { parts.push(c); c = []; } }); if (c.length) parts.push(c);
    for (let i = 0; i < parts.length - 1; i++) if (parts[i].length === 1) { parts.splice(i, 2, parts[i].concat(parts[i + 1])); i--; }
    if (parts.length > 1 && parts[parts.length - 1].length === 1) parts.splice(-2, 2, parts[parts.length - 2].concat(parts[parts.length - 1]));
    for (const p of parts) groups.push(...chunk(p)); }
  for (let i = 0; i < groups.length; i++) if (groups[i].length === 1 && groups.length > 1) { const j = i + 1 < groups.length ? i + 1 : i - 1; if (groups[j].length + 1 > 6) groups.splice(j, 1, ...split(groups[j], 2)); const m = j > i ? groups[i].concat(groups[j]) : groups[j].concat(groups[i]); groups.splice(Math.min(i, j), 2, m); }
  for (const g of groups) captions.push({ text: g.map(w => w.w).join(" "), s: r2(g[0].s), e: r2(g[g.length - 1].e), line: L.n, sp: L.sp });
}
captions.forEach((c, i) => { const nx = captions[i + 1]; c.e = r2(Math.min(c.e + 0.35, nx ? nx.s - 0.06 : c.e + 0.6)); });

// ---------------- MG cues: timings passed through ([mg:] tags in the script and/or mg.beats.json); no visuals authored ----------------
// script tag:  [mg: THE CLOUD | cloud=cloud rises ; building=ghost + building rises]      mg.beats.json: {"cues":[{"name","line"?,"at"?,"end"?,"beats":[{"word","line"?,"t"?,"verb"}]}]}
const cues = []; const mgSrc = [];
for (const L of lines) if (L.mg) { const [name, rest = ""] = L.mg.split("|").map(x => x.trim()); mgSrc.push({ name, line: L.n, beats: rest.split(";").map(x => x.trim()).filter(Boolean).map(x => { const [word, ...v] = x.split("="); return { word: word.trim(), verb: v.join("=").trim() }; }) }); }
const mgb = path.join(EPD, "mg.beats.json"); if (fs.existsSync(mgb)) { const j = rj(mgb); (Array.isArray(j) ? j : j.cues ?? []).forEach(c => mgSrc.push(c)); }
mgSrc.forEach((c, idx) => {
  const bs = []; let cursor = 0;
  for (const b of c.beats ?? []) { let t = b.t; if (t == null) { const L = lines[(b.line ?? c.line ?? 0) - 1]; const cand = L ? findWord(L, b.word) : words.find(x => x.s >= cursor && norm(x.w) === norm(String(b.word).split(/\s+/)[0])); if (!cand) { warn.push(`mg beat word "${b.word}" not found`); continue; } t = cand.s; } cursor = t + 0.01; bs.push({ t: r2(t), word: b.word, verb: b.verb ?? "" }); }
  if (!bs.length && c.at == null) return; const at = c.at ?? c.t0 ?? r2(Math.max(0, bs[0].t - 0.3)); const end = c.end ?? c.t1 ?? r2(Math.min(duration, Math.max(at + 1.5, bs[bs.length - 1].t + 1.2)));
  if (end - at < 1.5) warn.push(`mg cue "${c.name}" shorter than 1.5 s`); cues.push({ id: idx + 1, name: c.name ?? "cue " + (idx + 1), at, end, beats: bs });
});
cues.sort((a, b) => a.at - b.at); cues.forEach((c, i) => { if (i && c.at < cues[i - 1].end) warn.push(`mg cues "${cues[i - 1].name}" and "${c.name}" overlap`); });
const mgWindows = cues.length ? cues.map(c => ({ t0: c.at, t1: c.end, name: c.name })) : null;
if (cues.length) fs.writeFileSync(path.join(EPD, "mg.auto.json"), JSON.stringify({ episode: ep, ratio: RATIO, generated: "autoplan.mjs (timings only)", cues }, null, 1));

// ---------------- write shots.json ----------------
const out = { ep, generated: "dialogue/compiler/autoplan.mjs (do not hand-edit)", ratio: RATIO, duration, set: CFG.set, pair: CFG.pair, audio: "dialogue/" + CFG.audio, words_src: "dialogue/" + CFG.words, cast,
  lines: lines.map(L => ({ n: L.n, sp: L.sp, beat: L.beat, cam: L.cam, text: L.text, s: L.s, e: L.e, w0: L.w0, w1: L.w1 })), shots, emotion, gestures, gaze,
  words: words.map(({ i, w, s, e, sp, line, stress }) => ({ i, w, s, e, sp, line, ...(stress ? { stress } : {}) })), captions, mgWindows, warnings: warn };
fs.writeFileSync(path.join(EPD, "shots.json"), JSON.stringify(out, null, 1));

// ---------------- PLAN.auto.md (same table as the hand PLAN: gates.mjs parses it) ----------------
const presetAt = (tl, t) => { let i = 0; while (i + 1 < tl.length && tl[i + 1][0] <= t) i++; return tl[i]; };
const fmtP = e => PLANFACE[e[1]] ?? e[1]; const gtxt = g => `${g.kind.replace(/_/g, " ")}${g.word ? ` "${g.word.replace(/[^\w']/g, "")}"` : ""} ${g.t.toFixed(2)}`;
const rows = shots.map(s => {
  const L = lines[s.line - 1]; const split2 = shots.some(x => x.line === s.line && x.cut === "cutin"); const actor = s.subject;
  const lab = s.cut === "tail" ? "tail (no voice)" : s.cut === "cutin" ? `L${s.line}b reaction cut-in` : `L${s.line}${split2 ? "a" : ""} ${cast[L.sp].name} ${L.beat}${s.cu ? " **CU**" : ""}`;
  const mv = s.move.type === "push" ? (s.cut === "tail" ? "slow push" : `push ${Math.round(s.move.amt * 100)}%`) : "hold"; let face;
  if (s.cut === "tail") face = `${cast.B.name} ${punch ? "deflates, looks at fire" : "looks at fire"}; ${cast.A.name} smiling`;
  else { const a = presetAt(emotion[actor], s.t0 + 0.12), b = presetAt(emotion[actor], s.t1 - 0.08), m = presetAt(emotion[actor], (s.t0 + s.t1) / 2); face = (s.cut === "cutin" ? cast[actor].name + " " : "") + (a[1] !== b[1] ? `${fmtP(a)} -> ${fmtP(b)}` : fmtP(m)); }
  const inShot = g => g.t >= s.t0 && g.t < s.t1 && g.line === s.line && s.cut !== "tail"; const gs = gestures.filter(g => inShot(g) && g.actor === actor).map(gtxt), ls = gestures.filter(g => inShot(g) && g.actor !== actor).map(gtxt);
  const lisFace = s.cut === "cutin" || s.cut === "tail" ? "" : (() => { const lo = other(actor); const set = new Set(emotion[lo].filter(e => e[0] >= s.t0 - 0.05 && e[0] < s.t1).map(e => e[1])); set.add(presetAt(emotion[lo], s.t0 + 0.1)[1]); return [...set].join(" -> "); })();
  return `| ${s.n} | ${lab} | ${s.t0.toFixed(2)}-${s.t1.toFixed(2)} | ${s.plan}, ${mv} | ${face} | ${gs.join("; ") || "-"} | ${[lisFace, ...ls].filter(Boolean).join("; ") || "-"} |`;
});
const md = [`# ${ep}: AUTO picture plan (autoplan.mjs, rule based, ${RATIO}); review with compiler/review.mjs`, "", `Audio ${CFG.audio} (${duration} s), words ${CFG.words}. Cast A=${cast.A.name} (${cast.A.id}), B=${cast.B.name} (${cast.B.id}), set ${CFG.set}. Cut ${CFG.lead * 1000} ms before the new speaker's first word. Seated-stage rule: no actor root moves.`, "", "## Shot list (seconds)",
  "| # | Line | Shot | Rig, move | Face | Gesture (on word) | Listener |", "|---|---|---|---|---|---|---|", ...rows, "", "## MG cues (timings only; visuals are authored elsewhere)", ...(cues.length ? cues.map(c => `- ${c.name} ${c.at}-${c.end}: ${c.beats.map(b => `"${b.word}" ${b.t} ${b.verb}`).join("; ")}`) : ["- none (no [mg:] tags / mg.beats.json)"]), "", ...(warn.length ? ["## Warnings", ...warn.map(w => "- " + w)] : [])].join("\n") + "\n";
fs.writeFileSync(path.join(EPD, "PLAN.auto.md"), md); if (args.includes("--plan-md") && !fs.existsSync(path.join(EPD, "PLAN.md"))) fs.writeFileSync(path.join(EPD, "PLAN.md"), md);
fs.writeFileSync(path.join(EPD, "PLAN.auto.flags.json"), JSON.stringify({ shotsToLook: [...new Set(shots.filter(s => flags[s.line] || s.cut === "tail").map(s => s.n))], byLine: flags }, null, 1));
console.log(`autoplan ${ep} ${RATIO}: ${shots.length} shots (${shots.filter(s => s.cut === "cutin").length} cut-ins, ${shots.filter(s => s.rig.startsWith("mcu")).length} mcu, ${shots.filter(s => s.rig === "wide2").length} wide2), ${gestures.length} gestures, ${captions.length} captions, ${words.length} words, ${cues.length} mg cues -> PLAN.auto.md, shots.json`);
for (const s of shots) console.log(`  #${String(s.n).padStart(2)} ${s.t0.toFixed(2)}-${s.t1.toFixed(2)} ${s.rig.padEnd(6)} ${s.move.type}${s.move.amt ? " " + s.move.amt : ""} L${s.line} ${s.cut}`);
if (warn.length) console.log("WARN", warn);
