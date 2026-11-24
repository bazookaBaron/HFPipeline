// ---------- gates: camera speed vs the approved coast2 film, and string-board overlap / crossing / crop
const COAST = { ang: { p95: 52.25, max: 62.7 }, pos: { p95: 1.28, max: 1.54 } };   // measured on coast2.html (max = 1.2 x p95 because coast2's raw max is a one-frame spike)
function camStats() { const cuts = new Set(); for (const r of RUNS) { const c = Math.round(r[0] * FPS); [c - 1, c, c + 1].forEach(x => cuts.add(x)); }
  const a = [], b = [], per = {};
  for (let f = 1; f < NF; f++) { if (cuts.has(f)) continue; const d0 = L[f].clone().sub(P[f]), d1 = L[f + 1].clone().sub(P[f + 1]); const A = d0.angleTo(d1) * 180 / Math.PI * FPS, B = P[f + 1].distanceTo(P[f]) * FPS / d0.length();
    a.push(A); b.push(B); const s = Math.floor(f / FPS); if (A > COAST.ang.p95 || B > COAST.pos.p95) per[s] = Math.max(per[s] || 0, Math.max(A / COAST.ang.p95, B / COAST.pos.p95)); }
  const q = (x, p) => { const s = [...x].sort((m, n) => m - n); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); }, st = x => ({ p50: q(x, .5), p95: q(x, .95), max: +Math.max(...x).toFixed(2) });
  const ang = st(a), pos = st(b);
  return { ang, pos, coast: COAST, pass: ang.p95 <= COAST.ang.p95 && ang.max <= COAST.ang.max && pos.p95 <= COAST.pos.p95 && pos.max <= COAST.pos.max, hotSeconds: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, +v.toFixed(2)]).slice(0, 14)) }; }
const proj2 = (p) => { const q = p.clone().project(cam); return [q.x * W / 2, q.y * H / 2, q.z]; };
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const segX = (p1, p2, p3, p4) => { const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2), d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4); return d1 * d2 < 0 && d3 * d4 < 0; };
const inPoly = (pt, poly) => { let s = 0; for (let i = 0; i < 4; i++) { const c = cross(poly[i], poly[(i + 1) % 4], pt); s += Math.sign(c); } return Math.abs(s) === 4; };
const polyHit = (A, B) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (segX(A[i], A[(i + 1) % 4], B[j], B[(j + 1) % 4])) return true; return inPoly(A[0], B) || inPoly(B[0], A); };
const segPoly = (p, q, poly) => { for (let i = 0; i < 4; i++) if (segX(p, q, poly[i], poly[(i + 1) % 4])) return true; return inPoly(p, poly) || inPoly(q, poly); };
function boardGate() { const fails = []; let checks = 0;
  for (let t = 37.5; t <= 44; t += 0.25) { setCam(t); animate(t, "board"); cam.updateMatrixWorld(); const rs = BRD.rects(t).filter(r => r.vis);
    const polys = rs.map(r => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => proj2(Vv(r.cx + sx * r.w / 2, r.cy + sy * r.h / 2, r.cz))));
    checks++; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (polyHit(polys[i], polys[j])) fails.push([t, "cards overlap", rs[i].id, rs[j].id]);
    const ss = BRD.strs(t).filter(s => s.vis);
    for (const s of ss) { const pp = s.pts.map(proj2); for (let k = 0; k < pp.length - 1; k++) rs.forEach((r, i) => { if (r.id === s.a || r.id === s.b) return; if (segPoly(pp[k], pp[k + 1], polys[i])) fails.push([t, "string over card", s.a + "-" + s.b, r.id]); }); }
    for (let i = 0; i < ss.length; i++) for (let j = i + 1; j < ss.length; j++) { const A = ss[i].pts, B = ss[j].pts; const a0 = [A[0].x, A[0].y], a1 = [A[A.length - 1].x, A[A.length - 1].y], b0 = [B[0].x, B[0].y], b1 = [B[B.length - 1].x, B[B.length - 1].y]; if (segX(a0, a1, b0, b1)) fails.push([t, "strings cross", ss[i].a + "-" + ss[i].b, ss[j].a + "-" + ss[j].b]); }
    if (t >= 37.8 && t <= 42.2) { let best = null; polys.forEach((pl, i) => { const cx = (pl[0][0] + pl[2][0]) / 2, cy = (pl[0][1] + pl[2][1]) / 2, d = Math.hypot(cx, cy); if (!best || d < best.d) best = { d, i }; });
      if (best) { const pl = polys[best.i]; if (pl.some(p => Math.abs(p[0]) > W / 2 * 0.97 || Math.abs(p[1]) > H / 2 * 0.97)) fails.push([t, "focus card cropped", rs[best.i].id]); } } }
  const uniq = {}; fails.forEach(f => { const k = f.slice(1).join("|"); uniq[k] ??= [f[0], 0]; uniq[k][1]++; });
  return { pass: fails.length === 0, nFail: fails.length, kinds: uniq, checks }; }
