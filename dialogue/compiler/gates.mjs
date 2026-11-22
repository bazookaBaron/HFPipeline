// Episode gates: node dialogue/compiler/gates.mjs <ep>
// Static: shots.json vs PLAN.md table (rigs, cut times) + cut timing vs the word times. Engine: reads episodes/<ep>/out/gates_engine.json written by
//   node runtime/jobq.js --kind render -- node dialogue/engine/render.mjs epgate <ep>
// (a) contact + penetration at every shot midpoint (plus every 0.25 s and every gesture peak), (b) seated: root + hips never move > 1 cm,
// (c) face preset per PLAN line (and the engine's live face state matches it), (d) cut timing, (e) captions inside safe areas and off faces + mg.lint.
// Writes episodes/<ep>/out/gates.txt. Tolerances are the project's (contact 1.5 cm, penetration 1.5 cm, seated 1 cm) and are never loosened here.
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url"; import { varietyGate } from "./gate_variety.mjs";
const here = path.dirname(fileURLToPath(import.meta.url)), DLG = path.resolve(here, "..");
const ep = process.argv[2] || "cloud"; const EPD = path.join(DLG, "episodes", ep); const OUT = path.join(EPD, "out"); fs.mkdirSync(OUT, { recursive: true });
const E = JSON.parse(fs.readFileSync(path.join(EPD, "shots.json"), "utf8")); const engF = path.join(OUT, "gates_engine.json"); const G = fs.existsSync(engF) ? JSON.parse(fs.readFileSync(engF, "utf8")) : null;
const L = []; const res = {}; const f2 = x => (+x).toFixed(2), cm = x => (x * 100).toFixed(2);
const verdict = (k, fails, extra = "") => { res[k] = fails.length ? "FAIL" : "PASS"; L.push(`RESULT ${k}: ${res[k]}${fails.length ? ` (${fails.length})` : ""}${extra ? " - " + extra : ""}`); fails.slice(0, 25).forEach(f => L.push("  x " + f)); L.push(""); };
const presetAt = (tl, t) => { let i = 0; while (i + 1 < tl.length && tl[i + 1][0] <= t) i++; return { name: tl[i][1], w: tl[i][2] ?? 1 }; };

// ---------- PLAN.md table ----------
const planMd = fs.readFileSync(path.join(EPD, "PLAN.md"), "utf8"); const rows = [];
for (const ln of planMd.split(/\r?\n/)) { const m = /^\|\s*(\d+)\s*\|(.*)\|\s*$/.exec(ln); if (!m) continue; const c = m[2].split("|").map(x => x.trim()); const [a, b] = c[1].split("-").map(Number); rows.push({ n: +m[1], line: c[0], t0: a, t1: b, rig: c[2].split(/[ ,]/)[0], face: c[3], gesture: c[4], listener: c[5] }); }
L.push(`# gates for episode ${ep} (${E.duration} s, ${E.shots.length} shots), ${new Date().toISOString()}`, `# engine data: ${G ? "gates_engine.json " + G.when : "MISSING (run render.mjs epgate " + ep + ")"}`, "");

// ---------- (0) shot list vs PLAN ----------
{ const fails = []; if (rows.length !== E.shots.length) fails.push(`PLAN has ${rows.length} rows, shots.json ${E.shots.length}`);
  for (const r of rows) { const s = E.shots[r.n - 1]; if (!s) continue; if (s.plan !== r.rig) fails.push(`#${r.n} rig ${s.plan} (engine ${s.rig}) vs PLAN ${r.rig}`); if (Math.abs(s.t0 - r.t0) > 0.06 || Math.abs(s.t1 - r.t1) > 0.06) fails.push(`#${r.n} ${f2(s.t0)}-${f2(s.t1)} vs PLAN ${f2(r.t0)}-${f2(r.t1)}`);
    const pm = /push\s*(\d+)?%?/.exec(r.rig === "mcu_A" ? "" : planMd.split(/\r?\n/).find(x => x.startsWith(`| ${r.n} |`)).split("|")[4].replace(/^[^,]*,/, "")); const mv = pm ? "push" : "hold"; if (s.move.type !== mv) fails.push(`#${r.n} move ${s.move.type} vs PLAN ${mv}`); }
  const dt = rows.map(r => Math.abs(E.shots[r.n - 1]?.t0 - r.t0)).filter(isFinite); verdict("0 shot list = PLAN table (rig, move, times within 60 ms)", fails, `max |t0 - PLAN| ${(Math.max(...dt) * 1000).toFixed(0)} ms`); }

// ---------- (a) contact + penetration ----------
if (G) { const TOL = 0.015; const fails = []; let wS = 0, wF = 0, wP = 0;
  const chk = (lab, r) => { for (const s of ["A", "B"]) { const x = r[s]; const nm = s === "A" ? "Walter" : "Leo"; if (!(Math.abs(x.seat) <= TOL)) fails.push(`${lab} ${nm} seat gap ${cm(x.seat)} cm`); if (!(Math.abs(x.foot) <= TOL)) fails.push(`${lab} ${nm} foot gap ${cm(x.foot)} cm`); if (x.pen > TOL) fails.push(`${lab} ${nm} leg-in-seat ${cm(x.pen)} cm`); wS = Math.max(wS, Math.abs(x.seat)); wF = Math.max(wF, Math.abs(x.foot)); wP = Math.max(wP, x.pen); } };
  G.mids.forEach(m => chk(`shot #${m.n} mid t=${f2(m.t)}`, m)); G.peaks.forEach(p => chk(`gesture ${p.actor} ${p.kind} peak t=${f2(p.t)}`, p)); G.rows.forEach(r => chk(`t=${f2(r.t)}`, r));
  verdict(`a contact + penetration (${E.shots.length} shot midpoints, every gesture peak, every 0.25 s; tol 1.5 cm)`, fails, `${G.mids.length} mids + ${G.peaks.length} peaks + ${G.rows.length} samples; worst |seat gap| ${cm(wS)} cm, |foot gap| ${cm(wF)} cm, penetration ${cm(wP)} cm`); }
else { res.a = "NOT RUN"; L.push("RESULT a contact + penetration: NOT RUN (no engine data)", ""); }

// ---------- (b) seated ----------
if (G) { const fails = []; const ref = G.rows[0].st; let worst = { d: 0 };
  for (const r of G.rows) for (const s of ["A", "B"]) for (const k of ["root", "hips"]) { const a = r.st[s][k], b = ref[s][k]; const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); if (d > worst.d) worst = { d, s, k, t: r.t }; if (d > 0.01) fails.push(`t=${f2(r.t)} ${s === "A" ? "Walter" : "Leo"} ${k} moved ${cm(d)} cm`); }
  verdict("b seated (root + hips world position, every 0.25 s over the episode, max 1 cm)", fails, `${G.rows.length} samples x 2 actors x 2 bones; max displacement ${cm(worst.d)} cm${worst.s ? ` (${worst.s} ${worst.k} t=${f2(worst.t)})` : ""}`); }
else { res.b = "NOT RUN"; L.push("RESULT b seated: NOT RUN", ""); }

// ---------- (c) face per line ----------
{ const fails = []; const ok = []; const MAP = [[/^neutral\/firm-light/, ["firm_light", "neutral", "firm"]], [/^surprised-light/, ["impressed"]], [/^firm-light/, ["firm_light"]], [/^impressed/, ["impressed"]], [/^surprised/, ["surprised"]], [/^curious/, ["curious"]], [/^warm/, ["warm"]], [/^amused/, ["amused"]], [/^confused/, ["confused"]], [/^tender/, ["tender"]], [/^thinking/, ["thinking"]], [/^grin/, ["grin"]], [/^proud/, ["proud"]], [/^worried/, ["worried"]], [/^dry/, ["dry"]]];
  const parse = s => { const m = MAP.find(([re]) => re.test(s.trim().toLowerCase())); return m ? m[1] : null; };
  for (const r of rows) { const s = E.shots[r.n - 1]; if (!s) continue; let face = r.face.replace(/\*\*/g, ""); let actor = s.subject;
    if (/^Leo /.test(face)) { actor = "B"; face = face.slice(4); } if (/^Walter /.test(face)) { actor = "A"; face = face.slice(7); }
    if (s.cut === "tail") { const a = presetAt(E.emotion.A, s.t0 + 0.6), b = presetAt(E.emotion.B, s.t0 + 0.6); const TP = E.tailPlan ?? { face: { A: [["amused"]], B: [["worried"]] } }; const good = a.name === TP.face.A[0][0] && b.name === TP.face.B[0][0] && E.gaze.some(g => g.actor === "B" && g.target === "fire" && g.t0 <= s.t0 + 0.5); (good ? ok : fails).push(`#${r.n} tail: Walter ${a.name}, Leo ${b.name} + eyes to the fire (PLAN: "${face}")`); continue; }
    const parts = face.split("->").map(x => x.trim()); const exp = parts.map(parse); if (exp.some(x => !x)) { fails.push(`#${r.n} cannot parse PLAN face "${face}"`); continue; }
    const probes = exp.length === 1 ? [[(s.t0 + s.t1) / 2, exp[0]]] : [[s.t0 + 0.12, exp[0]], [s.t1 - 0.08, exp[exp.length - 1]]];
    for (const [t, want] of probes) { const p = presetAt(E.emotion[actor], t); const nm = actor === "A" ? "Walter" : "Leo"; if (!want.includes(p.name)) fails.push(`#${r.n} t=${f2(t)} ${nm} preset ${p.name} vs PLAN ${want.join("|")}`); else ok.push(`#${r.n} t=${f2(t)} ${nm} ${p.name}${p.w !== 1 ? " (" + p.w + ")" : ""}`); }
    if (G) { const m = G.mids.find(x => x.n === r.n); const st = m?.st?.[actor]; const p = presetAt(E.emotion[actor], m.t); if (!st || st.preset !== p.name) fails.push(`#${r.n} engine preset ${st?.preset} != shots.json ${p.name}`); else if (st.dist > 0.08 && m.t - st.since > 0.4) fails.push(`#${r.n} engine face not settled on ${p.name} at mid (dist ${st.dist})`); }
    if (/eyes to fire/.test(face) && !E.gaze.some(g => g.actor === actor && g.target === "fire" && g.t0 < s.t1 && g.t1 > s.t0)) fails.push(`#${r.n} PLAN eyes to fire but no fire gaze`);
    if (/one brow up/.test(face) && !["confused", "dry"].includes(exp[0][0])) fails.push(`#${r.n} one brow up not in preset`); }
  verdict("c face preset per line = PLAN (shots.json track + live engine state at each shot midpoint)", fails, `${ok.length} checks ok`); }

// ---------- (d) cut timing ----------
{ const fails = []; const notes = []; const W = E.words;
  for (const s of E.shots.slice(1)) {
    if (s.cut === "tail") { const last = W[W.length - 1]; if (s.t0 < last.e) fails.push(`#${s.n} tail cut ${f2(s.t0)} before the last word ends ${f2(last.e)}`); else notes.push(`#${s.n} tail ${f2(s.t0)} (last word ends ${f2(last.e)})`); continue; }
    const Ln = E.lines[s.line - 1]; if (s.cut === "speaker" || s.cut === "latch") { const w = W[Ln.w0]; const lead = w.s - s.t0; const prev = W[Ln.w0 - 1];
      if (s.cut === "latch") { if (Math.abs(lead) > 0.005 || !(prev && prev.e > w.s - 0.15)) fails.push(`#${s.n} latch cut ${f2(s.t0)} vs word "${w.w}" ${f2(w.s)}`); else notes.push(`#${s.n} latch on "${w.w}" ${f2(w.s)} (previous word ends ${f2(prev.e)})`); }
      else if (lead < -1e-6 || lead > 0.2 + 1e-6) fails.push(`#${s.n} cut ${f2(s.t0)} is ${(lead * 1000).toFixed(0)} ms before "${w.w}" ${f2(w.s)} (allowed 0-200)`); else notes.push(`#${s.n} ${(lead * 1000).toFixed(0)} ms before "${w.w}"`); }
    else if (s.cut === "cutin") { const nx = W.find(w => w.s >= s.t0 - 1e-6), pv = [...W].reverse().find(w => w.e <= s.t0 + 1e-6); const straddle = W.find(w => w.s < s.t0 - 1e-6 && w.e > s.t0 + 1e-6); if (straddle) fails.push(`#${s.n} cut-in ${f2(s.t0)} inside the word "${straddle.w}"`); else notes.push(`#${s.n} cut-in ${f2(s.t0)} in the pause "${pv?.w}" ${f2(pv?.e)} | "${nx?.w}" ${f2(nx?.s)}`); }
    const prevShot = E.shots[s.n - 2]; if (prevShot.speaker && s.speaker && prevShot.speaker !== s.speaker && s.cut === "cutin") fails.push(`#${s.n} cut-in on a speaker change`); }
  for (const s of E.shots) if (s.t1 - s.t0 < 0.8) fails.push(`#${s.n} shot only ${f2(s.t1 - s.t0)} s`);
  verdict("d cut timing (0-200 ms before the new speaker's first word; latch on the word; cut-ins in pauses)", fails, notes.join("; ")); }

// ---------- (e) captions ----------
if (G) { const fails = []; const exc = []; const H = G.caps[0]?.H ?? 1920, Wd = G.caps[0]?.W ?? 1080; let minGap = 1e9;
  for (const c of G.caps) { const nw = c.text.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length; const ln = E.lines.find(l => E.captions.find(x => x.text === c.text)?.line === l.n);
    if (nw > 6) fails.push(`"${c.text}" ${nw} words`); else if (nw < 2) { if (ln && ln.text.trim() === c.text.trim()) exc.push(`"${c.text}" is a whole one-word line (cannot reach 2 words without crossing speakers)`); else fails.push(`"${c.text}" ${nw} word`); }
    if (!c.box) { fails.push(`"${c.text}" not found in the DOM at t=${f2(c.t)}`); continue; } const b = c.box;
    if (b.y0 < 0.08 * H || b.y1 > 0.82 * H || b.x0 < 0.03 * Wd || b.x1 > 0.97 * Wd) fails.push(`"${c.text}" outside safe area: y ${(b.y0 / H * 100).toFixed(1)}-${(b.y1 / H * 100).toFixed(1)} %, x ${b.x0.toFixed(0)}-${b.x1.toFixed(0)} px`);
    for (const s of ["A", "B"]) { const f = c.faces[s]; if (!f) continue; const ix = Math.min(b.x1, f.x1) - Math.max(b.x0, f.x0), iy = Math.min(b.y1, f.y1) - Math.max(b.y0, f.y0); if (ix > 0 && iy > 0) fails.push(`"${c.text}" t=${f2(c.t)} shot #${c.shot} ${c.rig} over ${s === "A" ? "Walter" : "Leo"}'s face (${ix.toFixed(0)}x${iy.toFixed(0)} px; caption y ${b.y0.toFixed(0)}-${b.y1.toFixed(0)}, face y ${f.y0.toFixed(0)}-${f.y1.toFixed(0)})`); else if (ix > 0) minGap = Math.min(minGap, -iy); } }
  (G.lint ?? []).forEach(x => fails.push("mg.lint: " + x));
  verdict("e captions (2-6 words, safe area top 8 % / bottom 18 %, never over a face) + mg.lint", fails, `${G.caps.length} captions; closest caption-face vertical gap ${minGap < 1e8 ? minGap.toFixed(0) + " px" : "n/a"}; mg.lint ${(G.lint ?? []).length} issues${exc.length ? "; EXCEPTION: " + exc.join("; ") : ""}`); }
else { res.e = "NOT RUN"; L.push("RESULT e captions: NOT RUN", ""); }

// ---------- (f) camera variety (compiler/gate_variety.mjs) ----------
varietyGate(E, G, verdict, L, res);

L.unshift(`# SUMMARY ${Object.entries(res).map(([k, v]) => k.split(" ")[0] + "=" + v).join("  ")}`);
fs.writeFileSync(path.join(OUT, "gates.txt"), L.join("\n") + "\n"); console.log(L.filter(x => /^(# SUMMARY|RESULT)/.test(x)).join("\n")); console.log("-> " + path.relative(process.cwd(), path.join(OUT, "gates.txt")));
if (Object.values(res).some(v => v !== "PASS")) process.exitCode = 1;
