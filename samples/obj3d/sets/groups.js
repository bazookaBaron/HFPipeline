// GROUP STAGING SOLVER (v3, builder B): stage(form, opts, rnd) -> [{ x, z, h, pose, o, s, seat?, role? }]
// A placement list for posedPerson figures. x,z in world units; h = heading = rotation.y (a figure faces fwd = (cos h, -sin h));
// s = figure height in world units (opts.scale, default PERSON_M = 1.75 for 1 unit = 1 m rooms; street scale 2.5 m/unit -> 0.7).
// Headings follow sightlines: seated figures face the table centre, an audience faces the speaker, a scrum faces the podium, a crowd
// leans toward its attractor. Nothing overlaps: every form ends with a min-spacing relaxation (pairs keep their exact contact gap).
// Common opts: n, at {x,z}, scale, face {x,z} (attractor / speaker), dress "formal"|"casual"|"work"|"mixed", avoid [{x,z,r}], wardrobe {..} (forced o fields)
// Forms: table, audience, pair, podium, queue, crowd, procession, huddle, bench_row, workers (see each function for its opts).
import { HANDSHAKE_GAP, EMBRACE_GAP, PERSON_M } from "./poses.js";

const TAU = Math.PI * 2;
const headTo = (x, z, tx, tz) => Math.atan2(-(tz - z), tx - x);          // heading that faces (tx,tz)
const fwdOf = h => [Math.cos(h), -Math.sin(h)];
const pick = (rnd, a) => a[Math.floor(rnd() * a.length) % a.length];
function wpick(rnd, table) { let t = 0; for (const [, w] of table) t += w; let r = rnd() * t; for (const [v, w] of table) { if ((r -= w) <= 0) return v; } return table[0][0]; }
const J = (rnd, a) => (rnd() * 2 - 1) * a;

// seeded wardrobe for one figure
export function wardrobe(rnd, dress = "mixed", force = {}) {
  const fem = rnd() < 0.42, formal = dress === "formal" || (dress === "mixed" && rnd() < 0.45), work = dress === "work";
  const hair = fem ? wpick(rnd, [["bun", 3], ["long", 4], ["short", 2]]) : wpick(rnd, [["short", 7], ["none", 2], ["long", 0.3]]);
  const o = { build: +(0.85 + rnd() * 0.45 + (rnd() < 0.12 ? 0.15 : 0)).toFixed(2), hair, coat: formal ? rnd() < 0.85 : work ? rnd() < 0.25 : rnd() < 0.3,
    skirt: fem && (formal ? rnd() < 0.55 : rnd() < 0.3), hat: work ? (rnd() < 0.75 ? "hard" : "cap") : (!formal && rnd() < 0.1 ? "cap" : "none"), prop: null, seed: Math.floor(rnd() * 1e6) };
  o.tie = o.coat && !fem && rnd() < (formal ? 0.75 : 0.25);
  return Object.assign(o, force); }

// ---------- spacing ----------
function relax(L, minD, avoid = [], iters = 40) {     // push apart any two figures closer than minD (pairs marked .lock move together)
  for (let it = 0; it < iters; it++) { let moved = false;
    for (let i = 0; i < L.length; i++) for (let k = i + 1; k < L.length; k++) { const a = L[i], b = L[k]; if (a.pair != null && a.pair === b.pair) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = Math.max(a.r ?? minD / 2, 0) + Math.max(b.r ?? minD / 2, 0);
      if (d < m) { const push = (m - d) / 2 + 1e-4, ux = d > 1e-6 ? dx / d : 1, uz = d > 1e-6 ? dz / d : 0;
        const fa = a.fixed ? 0 : b.fixed ? 2 : 1, fb = b.fixed ? 0 : a.fixed ? 2 : 1; mv(L, a, -ux * push * fa, -uz * push * fa); mv(L, b, ux * push * fb, uz * push * fb); moved = true; } }
    for (const a of L) for (const o of avoid) { if (a.fixed) continue; const dx = a.x - o.x, dz = a.z - o.z, d = Math.hypot(dx, dz), m = o.r + (a.r ?? minD / 2);
      if (d < m) { const ux = d > 1e-6 ? dx / d : 1, uz = d > 1e-6 ? dz / d : 0; mv(L, a, ux * (m - d), uz * (m - d)); moved = true; } }
    if (!moved) break; }
  return L; }
function mv(L, a, dx, dz) { if (a.pair != null) { for (const b of L) if (b.pair === a.pair) { b.x += dx / 2; b.z += dz / 2; } } else { a.x += dx; a.z += dz; } }
const clean = L => L.map(({ r, fixed, pair, ...e }) => e);
export function minGap(L) { let m = Infinity; for (let i = 0; i < L.length; i++) for (let k = i + 1; k < L.length; k++) { if (L[i].pairId != null && L[i].pairId === L[k].pairId) continue; m = Math.min(m, Math.hypot(L[i].x - L[k].x, L[i].z - L[k].z)); } return m; }

// poisson-disc sample inside a disc (r) or rect (w,d) around c
function poisson(rnd, n, c, shape, minD, avoid = []) { const P = []; let tries = 0;
  const inside = (x, z) => shape.r ? Math.hypot(x - c.x, z - c.z) <= shape.r : Math.abs(x - c.x) <= shape.w / 2 && Math.abs(z - c.z) <= shape.d / 2;
  while (P.length < n && tries < n * 400) { tries++; const x = shape.r ? c.x + J(rnd, shape.r) : c.x + J(rnd, shape.w / 2), z = shape.r ? c.z + J(rnd, shape.r) : c.z + J(rnd, shape.d / 2);
    if (!inside(x, z)) continue; const md = minD * (tries > n * 200 ? 0.85 : 1); if (P.some(p => Math.hypot(p.x - x, p.z - z) < md)) continue; if (avoid.some(o => Math.hypot(o.x - x, o.z - z) < o.r + md / 2)) continue; P.push({ x, z }); }
  return P; }

// ---------- forms ----------
const FORMS = {
  // table: opts.anchors = seat anchors [{x,z,h?}] (from FURN), opts.center {x,z} = table centre (else mean of anchors); or no anchors:
  // opts.table {len, wid, round?} around opts.at. Figures face the centre (long tables: face across, not to the middle).
  table(o, rnd, S) { let A = (o.anchors || []).filter(a => !a.type || a.type === "seat"); const c = o.center || o.at || (A.length ? { x: A.reduce((s, a) => s + a.x, 0) / A.length, z: A.reduce((s, a) => s + a.z, 0) / A.length } : { x: 0, z: 0 });
    if (!A.length) { const t = o.table || { len: 3.2, wid: 1.2 }, n = o.n ?? 8, back = 0.42; if (t.round) for (let i = 0; i < n; i++) { const a = i / n * TAU; A.push({ x: c.x + Math.cos(a) * (t.len / 2 + back), z: c.z + Math.sin(a) * (t.len / 2 + back) }); }
      else { const side = Math.ceil(n / 2); for (let i = 0; i < n; i++) { const s = i < side ? 1 : -1, k = i < side ? i : i - side, m = i < side ? side : n - side; A.push({ x: c.x - t.len / 2 + (k + 0.5) * t.len / m, z: c.z + s * (t.wid / 2 + back) }); } } }
    const n = Math.min(o.n ?? A.length, A.length), chair = rnd() < 0.5 ? 0 : 1, L = [], lenAxis = o.axis ?? null;
    const mix = o.mix || [["sit_type", 2], ["sit", 3], ["sit_listen", 3], ["sit_lean", 2], ["speak", 1.2], ["look_down", 1], ["point", 0.5], ["phone", 0.4]];
    const idx = A.map((a, i) => i); for (let i = idx.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [idx[i], idx[k]] = [idx[k], idx[i]]; }
    for (const i of idx.slice(0, n)) { const a = A[i]; let h; if (o.center || !Number.isFinite(a.h)) { const lt = o.table && !o.table.round && !o.center; h = lt ? headTo(a.x, a.z, a.x, c.z) : headTo(a.x, a.z, c.x, c.z);
        if (o.center && o.faceAcross) h = headTo(a.x, a.z, a.x + (o.faceAcross === "z" ? 0 : c.x - a.x), a.z + (o.faceAcross === "z" ? c.z - a.z : 0)); } else h = a.h;
      const pose = wpick(rnd, mix); const w = wardrobe(rnd, o.dress ?? "formal", o.wardrobe);
      if (pose === "sit_type") w.prop = rnd() < 0.5 ? "laptop" : null; else if (pose === "sit" || pose === "sit_listen") w.prop = rnd() < 0.25 ? "cup" : rnd() < 0.3 ? "papers" : null;
      L.push({ x: a.x, z: a.z, h: h + J(rnd, 0.08), pose, o: { ...w, seated: true }, s: S, seat: true, fixed: true, r: 0.3 * S }); }
    return L; },

  // audience: rows facing opts.face (speaker). opts: rows, cols (or n), pitch (seat spacing, m), rowGap, arc (0..1 curvature), standing, aisle (cols index gap)
  audience(o, rnd, S) { const c = o.at || { x: 0, z: 0 }, f = o.face || { x: c.x + 6, z: c.z }, n = o.n ?? 24, cols = o.cols ?? Math.max(3, Math.round(Math.sqrt(n * 2.2))), rows = o.rows ?? Math.ceil(n / cols);
    const pitch = (o.pitch ?? 0.62) * S / PERSON_M, rg = (o.rowGap ?? 0.95) * S / PERSON_M, base = headTo(c.x, c.z, f.x, f.z), [fx, fz] = fwdOf(base), rx = -fz, rz = fx, L = [], st = !!o.standing;
    const dist = Math.hypot(f.x - c.x, f.z - c.z), arc = o.arc ?? 0.35, aisle = o.aisle ?? (cols >= 8 ? Math.floor(cols / 2) : -1);
    const mix = o.mix || (st ? [["stand", 4], ["applaud", 2.5], ["raise_hand", 1], ["phone", 1.2], ["stand_arms_crossed", 1], ["point", 0.4]] : [["sit_listen", 6], ["applaud", 2.4], ["raise_hand", 0.8], ["phone", 0.8], ["look_down", 0.7], ["stand_arms_crossed", 0.6]]);
    let k = 0; for (let r = 0; r < rows && k < n; r++) for (let q = 0; q < cols && k < n; q++, k++) {
      let lat = (q - (cols - 1) / 2) * pitch + (aisle >= 0 && q >= aisle ? pitch * 0.9 : 0) - (aisle >= 0 ? pitch * 0.45 : 0), back = r * rg + (st ? J(rnd, 0.08 * S) : 0);
      if (st) lat += J(rnd, 0.1 * S); const bend = arc * lat * lat / Math.max(dist, 2) * 0.6;
      const x = c.x - fx * (back - bend) + rx * lat, z = c.z - fz * (back - bend) + rz * lat;
      const pose = wpick(rnd, mix), w = wardrobe(rnd, o.dress ?? "mixed", o.wardrobe); if (pose === "phone" && rnd() < 0.5) w.prop = "phone";
      L.push({ x, z, h: headTo(x, z, f.x, f.z) + J(rnd, st ? 0.25 : 0.06), pose, o: st ? w : { ...w, seated: true }, s: S, seat: !st, fixed: !st, r: (st ? 0.2 : 0.29) * S }); }
    return L; },

  // pair: opts.kind handshake|embrace|talk|argue, opts.h (heading of the first), opts.gap (talk distance, m)
  pair(o, rnd, S) { const c = o.at || { x: 0, z: 0 }, kind = o.kind ?? pick(rnd, ["handshake", "talk", "handshake", "argue"]), h = o.h ?? rnd() * TAU, [fx, fz] = fwdOf(h);
    const gap = kind === "handshake" ? HANDSHAKE_GAP * S : kind === "embrace" ? EMBRACE_GAP * S : (o.gap ?? (kind === "argue" ? 0.85 : 1.05)) * S / PERSON_M;
    const a = { x: c.x - fx * gap / 2, z: c.z - fz * gap / 2 }, b = { x: c.x + fx * gap / 2, z: c.z + fz * gap / 2 };
    const P = { handshake: ["handshake_L", "handshake_R"], embrace: ["embrace_L", "embrace_R"], talk: [pick(rnd, ["speak", "speak", "phone"]), pick(rnd, ["stand", "stand_arms_crossed", "look_down"])], argue: ["point", pick(rnd, ["stand_hips", "speak", "stand_arms_crossed"])] }[kind];
    if (P[0] === "phone") P[0] = "speak"; const exact = kind === "handshake" || kind === "embrace", D = o.dress ?? "formal";
    return [{ x: a.x, z: a.z, h: h + (exact ? 0 : J(rnd, 0.15)), pose: P[0], o: wardrobe(rnd, D, o.wardrobe), s: S, pair: 1, pairId: 1, r: 0.22 * S },
            { x: b.x, z: b.z, h: h + Math.PI + (exact ? 0 : J(rnd, 0.15)), pose: P[1], o: wardrobe(rnd, D, o.wardrobe), s: S, pair: 1, pairId: 1, r: 0.22 * S }]; },

  // podium: speaker at opts.at facing opts.face (the press); a press scrum fans out in front: reporters (mic/phone/papers) in the front arc,
  // photographers next, TV cameras at the back. opts: n (scrum size), near/far (m), spread (radians), aides (n figures behind the speaker)
  podium(o, rnd, S) { const c = o.at || { x: 0, z: 0 }, f = o.face || { x: c.x + 5, z: c.z }, hs = headTo(c.x, c.z, f.x, f.z), [fx, fz] = fwdOf(hs), sc = S / PERSON_M, L = [];
    L.push({ x: c.x, z: c.z, h: hs, pose: o.speakerPose ?? "speak", o: wardrobe(rnd, "formal", { coat: true, ...(o.speaker || {}) }), s: S, role: "speaker", fixed: true, r: 0.3 * S });
    const nA = o.aides ?? 2; for (let i = 0; i < nA; i++) { const side = i % 2 ? 1 : -1, x = c.x - fx * (0.9 + 0.3 * Math.floor(i / 2)) * sc + fz * side * (0.75 + 0.3 * i) * sc, z = c.z - fz * (0.9 + 0.3 * Math.floor(i / 2)) * sc - fx * side * (0.75 + 0.3 * i) * sc;
      L.push({ x, z, h: hs + J(rnd, 0.2), pose: pick(rnd, ["stand", "stand", "look_down", "stand_arms_crossed"]), o: wardrobe(rnd, "formal"), s: S, role: "aide", r: 0.22 * S }); }
    const n = o.n ?? 14, near = (o.near ?? 1.6) * sc, far = (o.far ?? 3.4) * sc, spread = o.spread ?? 1.5; const ring = [];
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1), band = i < n * 0.45 ? 0 : i < n * 0.78 ? 1 : 2; const d = near + band * (far - near) / 2 + J(rnd, 0.18 * sc);
      const a = hs + (t - 0.5) * spread * (band === 2 ? 0.8 : 1) + J(rnd, 0.06), x = c.x + Math.cos(a) * d, z = c.z - Math.sin(a) * d;
      const role = band === 0 ? "reporter" : band === 1 ? "photographer" : "camera"; let pose, prop;
      if (role === "reporter") { pose = wpick(rnd, [["stand", 3], ["raise_hand", 1.2], ["point", 0.5], ["phone", 0.8]]); prop = pose === "phone" ? "phone" : pose === "stand" ? pick(rnd, ["mic", "mic", "papers", "phone"]) : null; }
      else if (role === "photographer") { pose = "stand"; prop = "photo"; } else { pose = "stand"; prop = "camera"; }
      const w = wardrobe(rnd, "mixed", o.wardrobe); w.prop = prop; ring.push({ x, z, h: headTo(x, z, c.x, c.z) + J(rnd, 0.1), pose, o: w, s: S, role, r: 0.21 * S }); }
    return L.concat(ring); },

  // queue: a line from opts.at toward opts.to (or heading opts.h), opts.n, opts.gap (m), facing the head of the queue (opts.to)
  queue(o, rnd, S) { const c = o.at || { x: 0, z: 0 }, to = o.to || { x: c.x + 1, z: c.z }, h0 = headTo(c.x, c.z, to.x, to.z), [fx, fz] = fwdOf(h0), n = o.n ?? 8, L = [];
    let d = 0; for (let i = 0; i < n; i++) { const g = (o.gap ?? 0.75) * S / PERSON_M * (0.9 + rnd() * 0.35); const lat = J(rnd, 0.08 * S) + Math.sin(i * 0.7) * 0.05 * S;
      const x = c.x - fx * d - fz * lat, z = c.z - fz * d + fx * lat; d += g;
      const pose = wpick(rnd, [["stand", 4], ["phone", 2.2], ["look_down", 1], ["stand_arms_crossed", 1], ["stand_hips", 0.4]]), w = wardrobe(rnd, o.dress ?? "mixed", o.wardrobe);
      if (pose === "stand" && rnd() < 0.3) w.prop = pick(rnd, ["briefcase", "papers", "cup", "box"]); if (w.prop === "box") w.prop = "briefcase";
      L.push({ x, z, h: h0 + J(rnd, 0.3), pose, o: w, s: S, r: 0.2 * S }); }
    return L; },

  // crowd: poisson fill of a disc (opts.r) or rect (opts.w, opts.d) with headings toward opts.face; opts.mode plaza|rally|protest|market
  crowd(o, rnd, S) { const c = o.at || { x: 0, z: 0 }, f = o.face, mode = o.mode ?? (f ? "rally" : "plaza"), n = o.n ?? 30, minD = (o.minD ?? 0.62) * S / PERSON_M;
    const area = n * minD * minD * 1.9, shape = o.w ? { w: o.w, d: o.d ?? o.w } : { r: o.r ?? Math.sqrt(area / Math.PI) }; const P = poisson(rnd, n, c, shape, minD, o.avoid);
    const mix = o.mix || { plaza: [["walk", 4], ["stand", 3], ["phone", 2], ["point", 0.6], ["stand_hips", 0.4], ["look_down", 0.6]], rally: [["stand", 4], ["applaud", 3], ["raise_hand", 1.6], ["point", 0.8], ["phone", 1], ["salute", 0.2]],
      protest: [["stand", 3], ["walk", 2], ["raise_hand", 2], ["point", 1], ["stand", 2]], market: [["walk", 3], ["stand", 3], ["look_down", 2], ["carry", 1], ["point", 1], ["phone", 1]] }[mode] || [["stand", 1]];
    const flowH = o.flow ?? rnd() * TAU;
    return P.map(p => { const pose = wpick(rnd, mix), w = wardrobe(rnd, o.dress ?? "casual", o.wardrobe);
      let h; if (f) h = headTo(p.x, p.z, f.x, f.z) + J(rnd, pose === "walk" ? 0.6 : 0.35); else h = pose === "walk" ? flowH + (rnd() < 0.5 ? 0 : Math.PI) + J(rnd, 0.4) : rnd() * TAU;
      if (mode === "protest" && rnd() < 0.35 && pose !== "raise_hand" && pose !== "point") w.prop = "sign"; if (pose === "phone" && rnd() < 0.5) w.prop = "phone";
      if (mode === "market" && pose === "walk" && rnd() < 0.3) w.prop = "briefcase";
      return { x: p.x, z: p.z, h, pose, o: w, s: S, r: 0.2 * S }; }); },

  // procession: a walking column along opts.path [[x,z],...] (or from opts.at with heading opts.h), opts.n, abreast 2..3, all walking forward
  procession(o, rnd, S) { const n = o.n ?? 12, ab = o.abreast ?? 2, sc = S / PERSON_M, row = 0.95 * sc, col = 0.7 * sc, L = [];
    const path = o.path || (() => { const c = o.at || { x: 0, z: 0 }, h = o.h ?? 0, [fx, fz] = fwdOf(h), len = Math.ceil(n / ab) * row + 2; return [[c.x, c.z], [c.x - fx * len, c.z - fz * len]]; })();
    const seg = []; let tot = 0; for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(l); tot += l; }
    const at = d => { let i = 0; while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; } const a = path[i], b = path[i + 1], t = Math.min(1, d / seg[i]); return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, h: headTo(b[0], b[1], a[0], a[1]) }; };
    for (let i = 0; i < n; i++) { const r = Math.floor(i / ab), k = i % ab, d = Math.min(tot, r * row + J(rnd, 0.12 * sc) + (k % 2) * 0.25 * sc), p = at(d), [fx, fz] = fwdOf(p.h), lat = (k - (ab - 1) / 2) * col + J(rnd, 0.06 * sc);
      const w = wardrobe(rnd, o.dress ?? "formal", o.wardrobe); if (o.carry && rnd() < 0.5) w.prop = pick(rnd, ["box", "briefcase", "papers"]);
      const pose = w.prop === "box" ? "carry" : (o.signs && rnd() < 0.4 ? "walk" : "walk"); if (o.signs && rnd() < 0.4) w.prop = "sign";
      L.push({ x: p.x - fz * lat, z: p.z + fx * lat, h: p.h + J(rnd, 0.08), pose, o: w, s: S, r: 0.2 * S }); }
    if (L.length) L[0].role = "lead";
    return L; },

  // huddle: a tight ring (opts.n 3..8) facing its centre; one pointing / speaking, others listening
  huddle(o, rnd, S) { const c = o.at || { x: 0, z: 0 }, n = o.n ?? 5, sc = S / PERSON_M, rad = (0.42 + 0.075 * n) * sc, a0 = rnd() * TAU, L = [];
    for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU + J(rnd, 0.15), x = c.x + Math.cos(a) * rad * (0.92 + rnd() * 0.16), z = c.z + Math.sin(a) * rad * (0.92 + rnd() * 0.16);
      const pose = i === 0 ? pick(rnd, ["point", "speak"]) : wpick(rnd, [["look_down", 3], ["stand_arms_crossed", 2], ["stand", 2], ["stand_hips", 1], ["phone", 0.6]]);
      const w = wardrobe(rnd, o.dress ?? "mixed", o.wardrobe); if (pose === "look_down" && rnd() < 0.5) w.prop = "papers";
      L.push({ x, z, h: headTo(x, z, c.x, c.z) + J(rnd, 0.12), pose, o: w, s: S, r: 0.2 * S }); }
    return L; },

  // bench_row: seated along a bench. opts.anchors (bench anchors with x,z,h) or opts.at + opts.h (facing) + opts.len (m); opts.n
  bench_row(o, rnd, S) { const sc = S / PERSON_M, n = o.n ?? 4, L = []; let pts;
    const b = (o.anchors || []).find(a => a.type === "bench") || null; const c = b || o.at || { x: 0, z: 0 }, h = Number.isFinite(o.h) ? o.h : (b && Number.isFinite(b.h) ? b.h : 0), len = o.len ?? (b && b.len) ?? n * 0.62 * sc;
    const [fx, fz] = fwdOf(h), step = len / n;
    for (let i = 0; i < n; i++) { const lat = -len / 2 + (i + 0.5) * step + J(rnd, step * 0.12), x = c.x - fz * lat, z = c.z + fx * lat;
      const pose = wpick(rnd, [["sit", 3], ["sit_listen", 3], ["phone", 1.5], ["look_down", 1.5], ["stand_arms_crossed", 0.7]]), w = wardrobe(rnd, o.dress ?? "mixed", o.wardrobe);
      if (pose === "phone") w.prop = "phone"; if (pose === "look_down" && rnd() < 0.6) w.prop = "papers";
      L.push({ x, z, h: h + J(rnd, 0.12), pose, o: { ...w, seated: true }, s: S, seat: true, fixed: true, r: 0.27 * S }); }
    return L; },

  // workers: one figure per workstation anchor (opts.anchors from FURN: seat -> sit_type facing the desk; stand -> standing worker facing its
  // bench / machine); opts.fill 0..1 = fraction of stations occupied; opts.dress "work" gives hard hats on stand anchors
  workers(o, rnd, S) { const A = o.anchors || [], fill = o.fill ?? 1, L = [];
    for (const a of A) { if (a.type && !["seat", "stand"].includes(a.type)) continue; if (rnd() > fill) continue; const seated = (a.type ?? "seat") === "seat";
      let h = Number.isFinite(a.h) ? a.h : (o.face ? headTo(a.x, a.z, o.face.x, o.face.z) : 0);
      const pose = seated ? wpick(rnd, [["sit_type", 6], ["sit_lean", 1.2], ["phone", 0.8], ["sit", 0.6]]) : wpick(rnd, [["look_down", 4], ["stand", 2], ["carry", 1], ["point", 0.6], ["stand_hips", 0.4]]);
      const w = wardrobe(rnd, o.dress ?? (seated ? "mixed" : "work"), o.wardrobe); if (pose === "phone") w.prop = "phone"; if (pose === "sit_type" && o.laptops) w.prop = "laptop";
      L.push({ x: a.x, z: a.z, h: h + J(rnd, seated ? 0.05 : 0.15), pose, o: seated ? { ...w, seated: true } : w, s: S, seat: seated, fixed: true, r: 0.25 * S }); }
    return L; },
};
export const FORM_NAMES = Object.keys(FORMS);

export function stage(form, opts = {}, rnd = Math.random) {
  const f = FORMS[form]; if (!f) throw new Error("groups.stage: unknown form " + form);
  const S = opts.scale ?? PERSON_M; const L = f(opts, rnd, S);
  relax(L, 0.4 * S, opts.avoid || []);
  return clean(L).map(e => ({ ...e, x: +e.x.toFixed(4), z: +e.z.toFixed(4), h: +e.h.toFixed(4) })); }
