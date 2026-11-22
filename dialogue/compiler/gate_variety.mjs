// Camera-variety rules, shared by gates.mjs (gate "f camera variety", fed by the engine's real camera data) and autoplan.mjs (fed by rig_angles_<set>_<ratio>.json).
//   R1 no rig twice in a row                                R2 no rig on more than ~30 % of the shots (limit ceil(0.30 N))
//   R3 every 10 s window shows >= 3 distinct angles         R4 the same subject's consecutive shots differ by >= 15 deg (azimuth OR elevation) or a size step (visible half-height ratio >= 1.3)
// "angle" = (group, azimuth, elevation, size); group = the subject (A/B) for speaker rigs, "pair" for the two-shot rigs. Azimuth/elevation are computed around the subject head (pair: midpoint of
// both heads) from the rig camera position, at the shot's middle (u = 0.5). Cut timing is not touched by any of this.
export const VAR = { deg: 15, sizeRatio: 1.3, share: 0.30, win: 10, minAngles: 3, step: 0.5, minOverlap: 0.3 };
const dA = (a, b) => { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
export const sameAngle = (a, b) => a.sub === b.sub && Math.max(dA(a.az, b.az), Math.abs(a.el - b.el)) < VAR.deg && Math.max(a.half, b.half) / Math.min(a.half, b.half) < VAR.sizeRatio;
// shots: [{n, t0, t1, rig}], cam(i) -> {sub, az, el, half}; returns {fails:{R1:[],R2:[],R3:[],R4:[]}, stats}
export function varietyCheck(shots, cam, duration) {
  const fails = { R1: [], R2: [], R3: [], R4: [] }; const N = shots.length; const C = shots.map((_, i) => cam(i));
  for (let i = 1; i < N; i++) if (shots[i].rig === shots[i - 1].rig) fails.R1.push(`#${shots[i - 1].n} and #${shots[i].n} both ${shots[i].rig}`);
  const cnt = {}; shots.forEach(s => cnt[s.rig] = (cnt[s.rig] ?? 0) + 1); const lim = Math.ceil(VAR.share * N - 1e-9);
  for (const [r, c] of Object.entries(cnt)) if (c > lim) fails.R2.push(`${r} on ${c} of ${N} shots (${Math.round(100 * c / N)} %, limit ${lim})`);
  const nwin = Math.floor((duration - VAR.win) / VAR.step + 1e-9); let worst = 99;
  for (let k = 0; k <= nwin; k++) { const a = k * VAR.step, b = a + VAR.win; const idx = shots.map((s, i) => i).filter(i => Math.min(shots[i].t1, b) - Math.max(shots[i].t0, a) >= VAR.minOverlap); const reps = [];
    for (const i of idx) if (!reps.some(j => sameAngle(C[i], C[j]))) reps.push(i); worst = Math.min(worst, reps.length); if (reps.length < VAR.minAngles) fails.R3.push(`${a.toFixed(1)}-${b.toFixed(1)} s: ${reps.length} distinct angle${reps.length === 1 ? "" : "s"} (shots ${idx.map(i => "#" + shots[i].n).join(" ")})`); }
  const last = {}; let minStep = 999; const rows = [];
  for (let i = 0; i < N; i++) { const g = C[i].sub; const j = last[g]; last[g] = i; if (j == null) continue; const dd = Math.max(dA(C[i].az, C[j].az), Math.abs(C[i].el - C[j].el)), sr = Math.max(C[i].half, C[j].half) / Math.min(C[i].half, C[j].half);
    rows.push(`${shots[j].rig}->${shots[i].rig} ${dd.toFixed(0)} deg size x${sr.toFixed(2)}`); if (dd < VAR.deg && sr < VAR.sizeRatio) fails.R4.push(`#${shots[j].n} ${shots[j].rig} -> #${shots[i].n} ${shots[i].rig} (${g}): ${dd.toFixed(1)} deg, size x${sr.toFixed(2)}`); else minStep = Math.min(minStep, dd); }
  return { fails, total: Object.values(fails).reduce((a, f) => a + f.length, 0), stats: { N, cnt, lim, minWindowAngles: worst, windows: nwin + 1, steps: rows } };
}
// gates.mjs entry: engine data G.cams[i] = {n, u0, u5, u1} (see main.js epGate)
export function varietyGate(E, G, verdict, L, res) {
  if (!G || !G.cams) { L.push("RESULT f camera variety: NOT RUN (engine data has no camera table; re-run render.mjs epgate " + (E.ep ?? "") + ")", ""); return; }
  const shots = E.shots.map(s => ({ n: s.n, t0: s.t0, t1: s.t1, rig: s.rig })); const r = varietyCheck(shots, i => G.cams[i].u5, E.duration);
  const fails = [...r.fails.R1.map(x => "R1 rig twice in a row: " + x), ...r.fails.R2.map(x => "R2 rig share: " + x), ...r.fails.R3.map(x => "R3 " + x), ...r.fails.R4.map(x => "R4 same-subject step: " + x)];
  verdict("f camera variety (no rig twice in a row; no rig > ~30 % of shots; >= 3 distinct angles per 10 s; same subject's consecutive shots >= 15 deg or a size step)", fails,
    `${r.stats.N} shots, ${Object.keys(r.stats.cnt).length} rigs (max share ${Math.max(...Object.values(r.stats.cnt))} of ${r.stats.N}, limit ${r.stats.lim}); fewest angles in any 10 s window ${r.stats.minWindowAngles} (${r.stats.windows} windows); steps ${r.stats.steps.join("; ")}`);
}
