/* runtime/iso/worlds.js: seeded procedural iso worlds for iso-kit.js.
 *   WORLDS.city(seed, {cols, rows | blocksX, blocksY, cars, buses})   road grid + lanes + crosswalks + blocks of towers/midrises/shops,
 *                                                                     trees, street lamps, signals, a construction crane; traffic sim
 *   WORLDS.parking(seed, {...})                                       3x3 grid whose centre block is a 48-bay lot (barrier, booth, lamps);
 *                                                                     cars circulate, get "lot-bound", enter, park, leave
 * Motion: a deterministic fixed-step simulation (30 Hz, seeded) runs ONCE at load over [-warmup, dur]; cars follow a lane graph
 * (straight/right/left connectors at intersections), obey 2-phase signals, keep distance (IDM on a look-ahead along their own
 * route), park via bay-in / reverse bay-out edges. Frames read the recorded table: pose(t) is a pure function of t.
 */
(function (root) {
  const ISO = root.ISO, HL = root.HLG, R = {};
  const ROAD = 28, RH = 14, LO = 5.5, CW = 7, SW = 7, DT = 1 / 30;
  const V_LANE = 30, V_TURN = 12, V_LOT = 19, V_BAY = 9, A_MAX = 26, B_COMF = 38, B_HARD = 90, S0 = 2.6, TH = 0.55;
  const CAR = { len: 17, w: 8.4 }, BUS = { len: 30, w: 9.6 };
  const r1 = ISO.r1, polyD = ISO.polyD, openD = ISO.openD;

  // ---------- road grid ----------
  function grid(o) {
    const cols = o.cols, rows = o.rows, M = o.margin ?? 10, xs = [], ys = [];
    let x = M + RH; xs.push(x); cols.forEach((w) => { x += ROAD + w; xs.push(x); });
    let y = M + RH; ys.push(y); rows.forEach((h) => { y += ROAD + h; ys.push(y); });
    const Wd = xs[xs.length - 1] + RH + M, Hd = ys[ys.length - 1] + RH + M;
    for (let i = 0; i < xs.length; i++) xs[i] -= Wd / 2;
    for (let j = 0; j < ys.length; j++) ys[j] -= Hd / 2;
    const blocks = [];
    for (let i = 0; i < cols.length; i++) for (let j = 0; j < rows.length; j++) blocks.push({ i, j, x0: xs[i] + RH, x1: xs[i + 1] - RH, y0: ys[j] + RH, y1: ys[j + 1] - RH });
    return { xs, ys, blocks, M, bounds: [-Wd / 2, -Hd / 2, Wd / 2, Hd / 2], nx: xs.length, ny: ys.length };
  }

  // ---------- edges ----------
  function measure(e) { e.cum = [0]; for (let i = 1; i < e.pts.length; i++) e.cum.push(e.cum[i - 1] + Math.hypot(e.pts[i][0] - e.pts[i - 1][0], e.pts[i][1] - e.pts[i - 1][1])); e.len = e.cum[e.cum.length - 1]; }
  function at(e, s) {
    const P = e.pts, C = e.cum; s = Math.max(0, Math.min(e.len, s));
    let i = 1; while (i < P.length - 1 && C[i] < s) i++;
    const L = C[i] - C[i - 1] || 1e-9, u = (s - C[i - 1]) / L, a = P[i - 1], b = P[i];
    let hd = Math.atan2(b[1] - a[1], b[0] - a[0]); if (e.rev) hd += Math.PI;
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, hd];
  }
  const arc = (C, a, b, R, n = 8) => { const out = []; for (let k = 0; k <= n; k++) { const f = (k / n) * Math.PI / 2, c = Math.cos(f), s = Math.sin(f); out.push([C[0] + R * (c * a[0] + s * b[0]), C[1] + R * (c * a[1] + s * b[1])]); } return out; };
  const add = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k];

  function buildNet(G) {
    const edges = [], outAt = {}, inAt = {}, key = (i, j) => i + "," + j;
    const E = (pts, props) => { const e = Object.assign({ id: edges.length, pts, next: [], vmax: V_LANE }, props); measure(e); edges.push(e); return e; };
    const lane = (i, j, i2, j2) => {
      const A = [G.xs[i], G.ys[j]], B = [G.xs[i2], G.ys[j2]], d = [Math.sign(i2 - i), Math.sign(j2 - j)], r = [d[1], -d[0]];
      const p0 = add(add(A, d, RH), r, LO), p1 = add(add(B, d, -(RH + CW)), r, LO);
      const e = E([p0, p1], { kind: "lane", d, r, node: key(i2, j2), N: B, light: { node: key(i2, j2), axis: d[0] ? "x" : "y" } });
      (outAt[key(i, j)] = outAt[key(i, j)] || []).push(e); (inAt[key(i2, j2)] = inAt[key(i2, j2)] || []).push(e);
    };
    for (let i = 0; i < G.nx; i++) for (let j = 0; j < G.ny; j++) {
      if (i < G.nx - 1) { lane(i, j, i + 1, j); lane(i + 1, j, i, j); }
      if (j < G.ny - 1) { lane(i, j, i, j + 1); lane(i, j + 1, i, j); }
    }
    const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
    Object.keys(inAt).forEach((k) => {
      const outs = outAt[k] || [];
      inAt[k].forEach((e) => {
        const d = e.d, r = e.r, N = e.N, l = [-r[0], -r[1]];
        const S = outs.find((o) => eq(o.d, d)), Rt = outs.find((o) => eq(o.d, r)), Lt = outs.find((o) => eq(o.d, l));
        const mv = []; if (S) mv.push(["S", S]); if (Rt) mv.push(["R", Rt]); if (Lt && !S) mv.push(["L", Lt]);
        mv.forEach(([turn, o2]) => {
          const st = e.pts[1], o0 = o2.pts[0];
          let pts;
          if (turn === "S") pts = [st, o0];
          else {
            const Pe = add(add(N, d, -RH), r, LO), Cc = add(add(N, d, -RH), o2.d, RH), Rr = Math.hypot(Pe[0] - Cc[0], Pe[1] - Cc[1]);
            pts = [st].concat(arc(Cc, [(Pe[0] - Cc[0]) / Rr, (Pe[1] - Cc[1]) / Rr], [(o0[0] - Cc[0]) / Rr, (o0[1] - Cc[1]) / Rr], Rr));
          }
          const c = E(pts, { kind: "conn", turn, vmax: turn === "S" ? V_LANE : V_TURN });
          c.next = [o2.id]; e.next.push(c.id);
        });
      });
    });
    return { edges, inAt, outAt, key };
  }

  // signals: 2 phases per intersection, cycle 10 s, green 4 s each, 1 s all-red; offsets make a loose green wave
  const CYC = 10, GRN = 3.6;
  function lightFnFor(G) {
    const off = {};
    for (let i = 0; i < G.nx; i++) for (let j = 0; j < G.ny; j++) off[i + "," + j] = (i * 1.7 + j * 2.9) % CYC;
    return (node, axis, t) => { const u = (((t + off[node]) % CYC) + CYC) % CYC; return axis === "x" ? (u < GRN ? "g" : "r") : u >= CYC / 2 && u < CYC / 2 + GRN ? "g" : "r"; };
  }

  // ---------- traffic simulation ----------
  function Sim(net, o) {
    const E = net.edges, rng = ISO.rng(o.seed), cars = [], light = o.lightFn, lot = o.lot;
    const t0 = -(o.warmup ?? 20), nRec = Math.round(o.dur / DT) + 2;
    // place cars on lane edges at spaced slots
    const slots = [];
    E.forEach((e) => { if (e.kind !== "lane") return; for (let s = 9; s < e.len - 9; s += 34) slots.push([e.id, s]); });
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    const nC = Math.min(o.cars, slots.length);
    for (let i = 0; i < nC; i++) {
      const bus = i < (o.buses || 0), dims = bus ? BUS : CAR, u = rng();
      cars.push({ id: i, e: slots[i][0], s: slots[i][1], v: 0, len: dims.len, w: dims.w, kind: bus ? "bus" : "car", top: bus ? "p" : u < 0.55 ? "p" : u < 0.8 ? "l" : "b", route: [], state: "drive", hold: -1e9, blk: -1, mut: 0, ign: -1, ignT: -1e9 });
    }
    // parked cars (lot)
    if (lot) {
      lot.bays.forEach((b, k) => {
        if (k === lot.heroBay || !lot.initParked.includes(k)) return;
        const u = rng(), c = { id: cars.length, e: b.inE, s: E[b.inE].len, v: 0, len: CAR.len, w: CAR.w, kind: "car", top: u < 0.55 ? "p" : u < 0.8 ? "l" : "b", route: [], state: "park", bay: k, depart: 1e9, hold: -1e9, blk: -1, mut: 0, ign: -1, ignT: -1e9 };
        b.occ = c.id; cars.push(c);
      });
      (lot.departs || []).forEach(([k, td]) => { const c = cars.find((q) => q.state === "park" && q.bay === k); if (c) c.depart = td; });
    }
    const choose = (c, ei) => {
      const opts = E[ei].next.filter((n) => E[n].kind !== "drive" || c.bound);
      if (!opts.length) return null;
      if (opts.length === 1) return opts[0];
      if (c.bound && net.dist) { const f = opts.filter((n) => isFinite(net.dist[n])); if (f.length) return f.sort((a, b) => net.dist[a] - net.dist[b] || a - b)[0]; }
      const w = opts.map((n) => (E[n].turn === "S" ? 3 : E[n].turn === "R" ? 2 : 1.6)), tot = w.reduce((a, b) => a + b, 0);
      let u = rng() * tot; for (let q = 0; q < opts.length; q++) { u -= w[q]; if (u <= 0) return opts[q]; }
      return opts[opts.length - 1];
    };
    const ensure = (c) => {
      let tot = E[c.e].len - c.s; c.route.forEach((r) => (tot += E[r].len));
      let last = c.route.length ? c.route[c.route.length - 1] : c.e;
      while (tot < 90) { const nx = choose(c, last); if (nx == null) break; c.route.push(nx); tot += E[nx].len; last = nx; }
    };
    const rec = cars.map(() => new Float32Array(nRec * 3)), recArm = new Float32Array(nRec), recOcc = new Uint8Array(nRec), events = [];
    let arm = 0, collisions = 0, t = t0, frame = -1;
    const pose = (c) => at(E[c.e], c.s);
    const freeBays = () => lot.bays.map((b, k) => k).filter((k) => lot.bays[k].occ == null && k !== lot.heroBay);
    function onEnter(c, e) {
      if (e.kind === "drive") {
        let k = c.hero ? lot.heroBay : -1;
        if (k < 0) { const f = freeBays().sort((a, b) => lot.order(a) - lot.order(b)).slice(0, 7); k = f.length ? f[Math.floor(rng() * f.length)] : -1; }
        if (k < 0) { c.bound = false; return; }
        c.bay = k; lot.bays[k].occ = c.id; c.bound = false; c.gate = 0; c.gateDone = false;
        c.route = lot.routeIn(k);
        events.push({ t, type: "enter", id: c.id, bay: k });
      }
    }
    const steps = Math.round((o.dur - t0) / DT) + 1;
    for (let step = 0; step < steps; step++) {
      t = t0 + step * DT;
      // schedule: lot-bound designations, hero pick
      if (lot) {
        if (lot.heroAt != null && t >= lot.heroAt && lot.hero == null) {
          let best = -1, bd = 1e9;
          cars.forEach((c) => { if (c.state !== "drive" || c.kind !== "car" || c.bound || c.bay != null) return; const d = net.dist[c.e] - c.s; if (d > lot.heroDist[0] && d < bd) { bd = d; best = c.id; } });
          if (o.debug && !lot.__d) { lot.__d = 1; console.log('HERO PICK t', t, 'best', best, cars.filter((c) => c.state === 'drive' && !c.bound).map((c) => (net.dist[c.e] - c.s).toFixed(0) + c.kind[0] + (c.bay != null ? 'B' : '') + (c.hero?'H':'')).join(' '), JSON.stringify(lot.heroDist)); }
          if (best >= 0) { lot.hero = best; cars[best].hero = true; lot.heroPick = t; }
        }
        if (lot.hero != null && t >= lot.heroAt && !cars[lot.hero].boundSet) { cars[lot.hero].bound = true; cars[lot.hero].boundSet = true; cars[lot.hero].route.length = 0; }
        while (lot.bound.length && lot.bound[0] <= t) {
          lot.bound.shift();
          let best = -1, bd = 1e9;
          cars.forEach((c) => { if (c.state !== "drive" || c.kind !== "car" || c.bound || c.hero || c.bay != null || c.left) return; const d = net.dist[c.e] - c.s; if (d > 40 && d < bd) { bd = d; best = c.id; } });
          if (best >= 0) { cars[best].bound = true; cars[best].route.length = 0; }
        }
      }
      // pass 1: geometry of all cars (rear, mid, front points)
      const pts = cars.map((c) => { const p = pose(c), dx = Math.cos(p[2]), dy = Math.sin(p[2]), h = c.len / 2 - 1.5; return [p[0], p[1], p[0] - dx * h, p[1] - dy * h, p[0] + dx * h, p[1] + dy * h]; });
      // pass 2: decide
      const nv = new Float32Array(cars.length), nstop = new Float32Array(cars.length).fill(1e9);
      cars.forEach((c, ci) => {
        if (c.state === "park") {
          if (t >= c.depart) {
            const b = lot.bays[c.bay], mp = b.mouth;
            const busy = cars.some((q) => q !== c && q.state !== "park" && Math.hypot(pts[q.id][0] - mp[0], pts[q.id][1] - mp[1]) < (t - c.depart > 2 ? 16 : 40));
            if (!busy) { c.state = "drive"; c.e = b.outE; c.s = 0; c.v = 0; c.route = lot.routeOut(c.bay); lot.bays[c.bay].occ = null; events.push({ t, type: "leave", id: c.id, bay: c.bay }); c.bay = null; c.left = true; }
          }
          return;
        }
        if (t < c.hold) { nv[ci] = 0; nstop[ci] = 0; return; }
        ensure(c);
        const chain = [c.e].concat(c.route), LOOK = Math.max(34, c.v * 1.7 + 26);
        let vcap = 1e9, stopD = 1e9, acc = -c.s, lineFront = null, lineEdge = null;
        const capAt = (d) => { if (d < stopD) stopD = d; vcap = Math.min(vcap, Math.sqrt(2 * B_COMF * Math.max(0, d))); };
        for (let k = 0; k < chain.length; k++) {
          const e = E[chain[k]], dS = acc, dE = acc + e.len;
          if (dS > LOOK + 40) break;
          vcap = Math.min(vcap, Math.sqrt(e.vmax * e.vmax + 2 * B_COMF * Math.max(0, dS)));
          if (e.light && light && c.commit !== e.id) {
            const front = dE - c.len / 2 - 0.6;
            if (front > -1) {
              const stt = light(e.light.node, e.light.axis, t);
              if (stt !== "g") { if (front > (c.v * c.v) / (2 * B_HARD) + 0.4) { capAt(front); break; } else c.commit = e.id; }
              else if (lineFront == null) { lineFront = front; lineEdge = k; }
            }
          }
          if (e.stopEnd) { capAt(dE); break; }
          if (e.gate && !c.gateDone && dE > 0 && dS + e.gate > -2) {
            const dg = dS + e.gate;
            if (dg > 0.05) capAt(dg);
            else { c.gate += DT; if (c.gate > 0.8 && arm > 0.92) c.gateDone = true; else { capAt(0); } }
          }
          if (e.yield && dE > -0.5) {
            const X = e.pts[e.pts.length - 1], ld = e.yield;
            const busy = cars.some((q) => { if (q === c || q.state === "park") return false; const p = pts[q.id], dx = X[0] - p[0], dy = X[1] - p[1], dd = Math.hypot(dx, dy); if (dd < 11) return true; const along = dx * ld[0] + dy * ld[1]; return q.v > 1.5 && along > -4 && along < q.v * 2.6 + 12 && Math.abs(-dx * ld[1] + dy * ld[0]) < 7; });
            if (busy) { capAt(dE - 0.2); break; }
          }
          acc = dE;
        }
        // car obstacles along the own route (samples every 2.5 from the front bumper)
        const samp = [];
        { let k = 0, base = -c.s, e = E[chain[0]]; for (let a = c.len / 2 + 0.5; a <= LOOK; a += 2.5) { while (e && a - base > e.len) { base += e.len; k++; e = chain[k] != null ? E[chain[k]] : null; } if (!e) break; const p = at(e, a - base); samp.push([a, p[0], p[1]]); } }
        let gap = 1e9, vO = 0, who = -1;
        const me = pts[ci];
        for (let j = 0; j < cars.length; j++) {
          if (j === ci || (c.ign === j && t < c.ignT)) continue;
          const q = pts[j]; if (Math.abs(q[0] - me[0]) > LOOK + 22 || Math.abs(q[1] - me[1]) > LOOK + 22) continue;
          const thr = (c.w + cars[j].w) / 2 + 0.6, t2 = thr * thr;
          for (const sp of samp) {
            if (sp[0] - c.len / 2 > gap) break;
            const hit = [0, 2, 4].some((o2) => { const dx = sp[1] - q[o2], dy = sp[2] - q[o2 + 1]; return dx * dx + dy * dy < t2; });
            if (hit) { const g = sp[0] - c.len / 2 + thr * 0.35; if (g < gap) { gap = g; vO = cars[j].v; who = j; } break; }
          }
        }
        // don't block the box: green light but a stopped car just past the junction
        if (lineFront != null && who >= 0 && vO < 2 && lineFront > (c.v * c.v) / (2 * B_HARD) + 0.4) {
          let dEnd = -c.s; for (let k = 0; k <= lineEdge; k++) dEnd += E[chain[k]].len;
          const cl = chain[lineEdge + 1] != null ? E[chain[lineEdge + 1]].len : 20;
          if (gap + c.len / 2 > dEnd - c.len / 2 && gap + c.len / 2 < dEnd + cl + c.len + 8) capAt(lineFront);
        }
        // deadlock breaker
        // mutual detection (merging side by side): right of way to the car further into its connector/edge, ties by id
        if (who >= 0 && cars[who].blkPrev === ci) {
          // the car physically ahead (other's centre behind mine along my heading) keeps going; head-on ties by id
          const q = pts[who], hd = pose(c)[2] + (E[c.e].rev ? Math.PI : 0), lon = (q[0] - me[0]) * Math.cos(hd) + (q[1] - me[1]) * Math.sin(hd);
          const oc = cars[who], ohd = pose(oc)[2] + (E[oc.e].rev ? Math.PI : 0), olon = (me[0] - q[0]) * Math.cos(ohd) + (me[1] - q[1]) * Math.sin(ohd);
          // crossing (both ahead of each other): the car already deeper inside the junction box wins
          const inBox = (x) => (E[x.e].kind === "conn" ? 1000 + x.s : x.s - E[x.e].len);
          const mine = E[c.e].rev !== E[oc.e].rev ? !!E[c.e].rev : lon < 0 && olon >= 0 ? true : lon >= 0 && olon < 0 ? false : inBox(c) !== inBox(oc) ? inBox(c) > inBox(oc) : ci < who;
          if (mine) { c.ign = who; c.ignT = t + 2.5; gap = 1e9; vO = 0; who = -1; }
        }
        c.blk = who;
        // IDM
        const v0 = Math.max(0.5, Math.min(c.bound || c.bay != null ? V_LANE : V_LANE, vcap + 0.01));
        let a = A_MAX * (1 - Math.pow(c.v / v0, 4));
        if (gap < 1e8) { const ss = S0 + Math.max(0, c.v * TH + (c.v * (c.v - vO)) / (2 * Math.sqrt(A_MAX * B_COMF))); a -= A_MAX * Math.pow(ss / Math.max(gap, 0.2), 2); }
        a = Math.max(-B_HARD * 1.4, Math.min(A_MAX, a));
        nv[ci] = Math.max(0, Math.min(vcap, c.v + a * DT));
        nstop[ci] = stopD;
      });
      if (o.traceLot && step % 30 === 0) console.log(t.toFixed(1), 'arm', arm.toFixed(2), cars.filter((c) => c.state !== 'park' && !['lane', 'conn'].includes(E[c.e].kind)).map((c) => `#${c.id}${c.hero ? 'H' : ''}:${E[c.e].kind}${c.e} s${c.s.toFixed(0)} v${c.v.toFixed(1)} blk${c.blk} g${(c.gate || 0).toFixed(1)}${c.gateDone ? 'D' : ''} hold${(c.hold > t) ? 1 : 0}`).join(' | '), 'bound:', cars.filter((c) => c.bound).map((c) => c.id + '@' + E[c.e].kind + ':' + (net.dist[c.e] - c.s).toFixed(0)).join(','));
      if (o.trace && step % 15 === 0) o.trace.forEach((id) => { const c = cars[id], p = pose(c); console.log(t.toFixed(2), id, c.state, 'e', c.e, E[c.e].kind, 's', c.s.toFixed(1), 'v', c.v.toFixed(1), 'nv', nv[id].toFixed(1), 'pos', p[0].toFixed(1), p[1].toFixed(1), 'blk', c.blk, 'ign', c.ign); });
      cars.forEach((c) => (c.blkPrev = c.blk));
      // pass 3: integrate + edge transitions
      cars.forEach((c, ci) => {
        if (c.state === "park" || t < c.hold) return;
        c.v = nv[ci];
        let ds = Math.min(c.v * DT, Math.max(0, nstop[ci]));
        if (nstop[ci] < 0.04 && c.v < 0.5) { ds = Math.max(0, nstop[ci]); }
        c.s += ds;
        let e = E[c.e];
        if (e.stopEnd && c.s >= e.len - 0.05 && c.v < 0.6) {
          c.s = e.len; c.v = 0;
          if (e.kind === "bayin") { c.state = "park"; c.depart = c.hero ? 1e9 : lot.dwell(c, t); events.push({ t, type: "park", id: c.id, bay: c.bay }); return; }
          if (c.route.length) { c.e = c.route.shift(); c.s = 0; c.hold = t + 0.45; onEnter(c, E[c.e]); }
          return;
        }
        while (c.s >= e.len && !e.stopEnd) {
          if (!c.route.length) ensure(c);
          if (!c.route.length) { c.s = e.len; c.v = 0; break; }
          c.s -= e.len; c.e = c.route.shift(); e = E[c.e]; c.commit = null; onEnter(c, e);
        }
      });
      // barrier arm
      if (lot) {
        const want = cars.some((c) => c.state === "drive" && E[c.e].gate && ((c.gate > 0.35 && !c.passed) || (c.gateDone && c.s < E[c.e].gate + 14)));
        cars.forEach((c) => { if (c.gateDone && E[c.e].gate && c.s > E[c.e].gate + 14) c.passed = true; });
        arm = Math.max(0, Math.min(1, arm + (want ? 2.4 : -1.4) * DT));
      }
      // record t >= 0
      if (t >= -1e-6) {
        frame = Math.round(t / DT); if (frame >= nRec) continue;
        cars.forEach((c, ci) => { const p = pose(c), b = rec[ci]; b[frame * 3] = p[0]; b[frame * 3 + 1] = p[1]; b[frame * 3 + 2] = p[2]; });
        recArm[frame] = arm;
        if (lot) recOcc[frame] = cars.filter((c) => c.state === "park").length;
        // collision audit (oriented boxes, shrunk 0.8)
        for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
          const a = pts[i], b = pts[j]; if (Math.abs(a[0] - b[0]) > 30 || Math.abs(a[1] - b[1]) > 30) continue;
          if (obbHit(rec[i], rec[j], frame, cars[i], cars[j])) collisions++;
        }
      }
    }
    for (let f = frame + 1; f < nRec; f++) cars.forEach((c, ci) => { const b = rec[ci]; b[f * 3] = b[frame * 3]; b[f * 3 + 1] = b[frame * 3 + 1]; b[f * 3 + 2] = b[frame * 3 + 2]; });
    const sample = (ci, tt) => {
      const f = Math.max(0, Math.min(nRec - 1.001, tt / DT)), i = Math.floor(f), u = f - i, b = rec[ci];
      if (u < 1e-6) return [b[i * 3], b[i * 3 + 1], b[i * 3 + 2]];
      let h0 = b[i * 3 + 2], h1 = b[i * 3 + 5]; let dh = h1 - h0; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
      return [b[i * 3] + (b[i * 3 + 3] - b[i * 3]) * u, b[i * 3 + 1] + (b[i * 3 + 4] - b[i * 3 + 1]) * u, h0 + dh * u];
    };
    const at1 = (arr, tt) => { const f = Math.max(0, Math.min(nRec - 1.001, tt / DT)), i = Math.floor(f), u = f - i; return arr[i] + (arr[i + 1] - arr[i]) * u; };
    return { cars, sample, arm: (tt) => at1(recArm, tt), occ: (tt) => recOcc[Math.max(0, Math.min(nRec - 1, Math.round(tt / DT)))], events, collisions };
  }
  function obbHit(A, B, f, ca, cb) {
    const box = (b, c) => { const x = b[f * 3], y = b[f * 3 + 1], h = b[f * 3 + 2], dx = Math.cos(h), dy = Math.sin(h), l = c.len / 2 - 0.8, w = c.w / 2 - 0.8; return [[x + dx * l - dy * w, y + dy * l + dx * w], [x + dx * l + dy * w, y + dy * l - dx * w], [x - dx * l + dy * w, y - dy * l - dx * w], [x - dx * l - dy * w, y - dy * l + dx * w], [dx, dy]]; };
    const a = box(A, ca), b = box(B, cb);
    for (const ax of [a[4], [-a[4][1], a[4][0]], b[4], [-b[4][1], b[4][0]]]) {
      const pa = a.slice(0, 4).map((p) => p[0] * ax[0] + p[1] * ax[1]), pb = b.slice(0, 4).map((p) => p[0] * ax[0] + p[1] * ax[1]);
      if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
    }
    return true;
  }

  // ---------- mover painters ----------
  const CB = ISO.box(-CAR.len / 2, -CAR.w / 2, CAR.len / 2, CAR.w / 2, 2.2, 2), CC = ISO.box(-4.6, -3.5, 3.4, 3.5, 1.4, 2);
  const BB = ISO.box(-BUS.len / 2, -BUS.w / 2, BUS.len / 2, BUS.w / 2, 1.6, 2);
  function paintCar(V, out, m) {
    const body = ISO.rot(m.kind === "bus" ? BB : CB, m.x, m.y, m.hd), off = ISO.shadowOff * 0.55;
    const P = V.P, base = HL.ringAt(P, body, 0.6);
    out.push(`<path class="fs" d="${polyD(HL.hull(base).map((q) => [q[0] + off, q[1] + off]))}"/>`);
    let hull;
    if (m.kind === "bus") {
      // window band on the visible long sides
      const co = Math.cos(m.hd), si = Math.sin(m.hd); let win = "";
      [[0, 1], [0, -1]].forEach(([nu0, nv0]) => {
        const nu = nu0 * co - nv0 * si, nv = nu0 * si + nv0 * co; if (nu * V.s + nv * V.c <= 0.05) return;
        const w = (nv0 * BUS.w) / 2, q = (a, z) => P(m.x + a * co - w * si, m.y + a * si + w * co, z);
        win += "M" + [q(-11, 6.4), q(12, 6.4), q(12, 9.6), q(-11, 9.6)].map((p) => r1(p[0]) + " " + r1(p[1])).join("L") + "Z";
      });
      hull = ISO.solid(V, out, body, 0.8, 11.5, { top: m.hot ? "m" : m.top, sil: "sc", crc: "cc", extra: win ? `<path class="fk" d="${win}"/>` : "" });
    } else {
      const h1 = ISO.solid(V, out, body, 0.8, 5.2, { top: m.hot ? "m" : m.top, sil: "sc", crc: "cc" });
      const h2 = ISO.solid(V, out, ISO.rot(CC, m.x, m.y, m.hd), 5.2, 8.7, { top: m.hot ? "m" : "p", L: "k", R: "k", sil: "sc", crc: "cc" });
      hull = h1.concat(h2);
    }
    const hl = (m.kind === "bus" ? BUS.len : CAR.len) / 2, hw = (m.kind === "bus" ? BUS.w : CAR.w) / 2, co = Math.abs(Math.cos(m.hd)), si = Math.abs(Math.sin(m.hd));
    const ex = hl * co + hw * si, ey = hl * si + hw * co;
    m.fp = [m.x - ex, m.y - ey, m.x + ex, m.y + ey];
    return hull;
  }

  // ---------- static parts ----------
  const fpOf = (x0, y0, x1, y1) => [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
  const sortRoof = (V, items) => items.slice().sort((a, b) => (a.x * V.s + a.y * V.c) - (b.x * V.s + b.y * V.c));
  function roofItems(V, out, items, z, hulls) {
    sortRoof(V, items).forEach((it) => {
      if (it.k === "ac") hulls.push(ISO.solid(V, out, ISO.box(it.x - it.w / 2, it.y - it.d / 2, it.x + it.w / 2, it.y + it.d / 2, 0.6, 1), z, z + it.h, { sil: "sb", crc: "cc", cr: "" }));
      else if (it.k === "tank") {
        const P = V.P; let legs = "";
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { const p = P(it.x + a * it.R * 0.6, it.y + b * it.R * 0.6, z), q = P(it.x + a * it.R * 0.6, it.y + b * it.R * 0.6, z + 3.2); legs += `M${r1(p[0])} ${r1(p[1])}L${r1(q[0])} ${r1(q[1])}`; });
        out.push(`<path class="ln" d="${legs}"/>`);
        hulls.push(ISO.solid(V, out, ISO.circ(it.x, it.y, it.R, 14), z + 3.2, z + 3.2 + it.h, { top: "l", L: "l", R: "d", sil: "sb", crc: "cc", lip: ISO.circ(it.x, it.y, it.R * 0.55, 10) }));
      } else if (it.k === "ant") {
        const P = V.P, p = P(it.x, it.y, z), q = P(it.x, it.y, z + it.h);
        out.push(`<path class="ln" d="M${r1(p[0])} ${r1(p[1])}L${r1(q[0])} ${r1(q[1])}"/><circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="1.4" class="fk"/>`);
        hulls.push([p, q]);
      }
    });
  }
  // tower / midrise: tiers [{x0,y0,x1,y1,z0,z1}], roof items on the top tier, windows on every tier
  function building(o) {
    const fp = [o.tiers[0].x0, o.tiers[0].y0, o.tiers[0].x1, o.tiers[0].y1];
    return ISO.addStatic({ fp, kind: o.kind, hero: o.hero, o, draw: (V, out, st) => {
      const hulls = [], rng = ISO.rng(o.seed);
      o.tiers.forEach((T, i) => {
        const last = i === o.tiers.length - 1, win = o.far ? "" : ISO.windows(V, T.x0, T.y0, T.x1, T.y1, T.z0, T.z1, { rng, phase: o.phase, groups: 3, cw: o.cw || 7, rh: o.rh || 9, ww: o.ww || 3.6, wh: o.wh || 5.2, top: 3.5, bottom: i ? 3 : 4 });
        const lip = last ? ISO.box(T.x0 + 1.6, T.y0 + 1.6, T.x1 - 1.6, T.y1 - 1.6, 0.6, 1) : null;
        hulls.push(ISO.solid(V, out, ISO.box(T.x0, T.y0, T.x1, T.y1, 1.1, 1), T.z0, T.z1, { top: "p", extra: win, lip, sil: o.hero ? "sh" : o.far ? "sb" : "s", topAttr: last ? ` data-hi="${o.hero || "s" + st.idx}" data-on="Fm" data-off="Fp"` : "" }));
      });
      const T = o.tiers[o.tiers.length - 1];
      roofItems(V, out, o.roof || [], T.z1, hulls);
      return HL.hull([].concat(...hulls));
    } });
  }
  function shop(o) {
    const { x0, y0, x1, y1, h } = o;
    return ISO.addStatic({ fp: [x0, y0, x1, y1], kind: "shop", draw: (V, out) => {
      const P = V.P; let glass = "", aw = "", awS = "", awO = "";
      ISO.faces(V, x0, y0, x1, y1).forEach((F) => {
        if (F.len < 10) return;
        const ux = (F.b[0] - F.a[0]) / F.len, uy = (F.b[1] - F.a[1]) / F.len, za = h * 0.6, m = 2.2;
        const A = [F.a[0] + ux * m, F.a[1] + uy * m], B = [F.b[0] - ux * m, F.b[1] - uy * m];
        const g = [P(A[0], A[1], 1.2), P(B[0], B[1], 1.2), P(B[0], B[1], za - 3.6), P(A[0], A[1], za - 3.6)];
        glass += polyD(g);
        const n = Math.max(3, Math.round((F.len - 2 * m) / 4)), q = (u, out2, z) => { const L = F.len - 2 * m; return P(A[0] + ux * L * u + F.nu * out2, A[1] + uy * L * u + F.nv * out2, z); };
        for (let s = 0; s < n; s++) { const u0 = s / n, u1 = (s + 1) / n; const poly = polyD([q(u0, 0, za), q(u1, 0, za), q(u1, 4.4, za - 3.4), q(u0, 4.4, za - 3.4)]); if (s % 2) awS += poly; else aw += poly; }
        awO += polyD([q(0, 0, za), q(1, 0, za), q(1, 4.4, za - 3.4), q(0, 4.4, za - 3.4)]);
      });
      const extra = (glass ? `<path class="fk" d="${glass}"/>` : "") + (aw ? `<path class="fp" d="${aw}"/>` : "") + (awS ? `<path class="fb" d="${awS}"/>` : "") + (awO ? `<path class="c" d="${awO}"/>` : "");
      const hulls = [ISO.solid(V, out, ISO.box(x0, y0, x1, y1, 1, 1), 0, h, { top: "p", extra, lip: ISO.box(x0 + 1.4, y0 + 1.4, x1 - 1.4, y1 - 1.4, 0.5, 1), sil: "s" })];
      roofItems(V, out, o.roof || [], h, hulls);
      return HL.hull([].concat(...hulls));
    } });
  }
  function tree(x, y, s = 1) {
    return ISO.addStatic({ fp: [x - 1.2, y - 1.2, x + 1.2, y + 1.2], kind: "tree", pad: 0, draw: (V, out) => {
      const P = V.P, t0 = P(x, y, 0), t1 = P(x, y, 4.6 * s), h1 = [t0, t1];
      out.push(`<path class="ln" d="M${r1(t0[0])} ${r1(t0[1])}L${r1(t1[0])} ${r1(t1[1])}"/>`);
      const h2 = ISO.solid(V, out, ISO.circ(x, y, 5.6 * s, 14), 4.5 * s, 9.5 * s, { top: "b", L: "d", R: "d", sil: "sb", crc: "cc" });
      const h3 = ISO.solid(V, out, ISO.circ(x, y, 3.7 * s, 12), 9.5 * s, 12.6 * s, { top: "b", L: "d", R: "d", sil: "sb", crc: "cc" });
      return HL.hull(h1.concat(h2, h3));
    } });
  }
  function lamp(x, y, dir) {
    return ISO.addStatic({ fp: [x - 0.8, y - 0.8, x + 0.8, y + 0.8], kind: "lamp", shadow: false, draw: (V, out) => {
      const P = V.P, a = P(x, y, 0), b = P(x, y, 22), hx = x + dir[0] * 6, hy = y + dir[1] * 6, c = P(hx, hy, 22);
      out.push(`<path class="ln" d="M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}L${r1(c[0])} ${r1(c[1])}"/>`);
      const h = ISO.solid(V, out, ISO.box(hx - 1.8, hy - 1.8, hx + 1.8, hy + 1.8, 0.5, 1), 20.4, 22.2, { top: "p", L: "p", R: "l", sil: "cc", noCr: true });
      return HL.hull([a, b].concat(h));
    } });
  }
  // signal pole: lamp element toggled per frame (data-lamp / data-axis -> class Lg | Lr)
  function signal(x, y, arm, node, axis) {
    return ISO.addStatic({ fp: [x - 0.9, y - 0.9, x + 0.9, y + 0.9], kind: "signal", shadow: false, draw: (V, out) => {
      const P = V.P, a = P(x, y, 0), b = P(x, y, 19), hx = x + arm[0], hy = y + arm[1], c = P(hx, hy, 19);
      out.push(`<path class="ln" d="M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}L${r1(c[0])} ${r1(c[1])}"/>`);
      const h = ISO.solid(V, out, ISO.box(hx - 1.4, hy - 1.4, hx + 1.4, hy + 1.4, 0.4, 1), 13.5, 19, { top: "k", L: "k", R: "k", sil: "cc", noCr: true });
      const q = P(hx, hy, 16.2);
      out.push(`<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="1.5" class="Lr" data-lamp="${node}" data-axis="${axis}"/>`);
      return HL.hull([a, b].concat(h));
    } });
  }
  // tower crane: static mast; jib/trolley/load re-drawn every frame (dyn) — rotation is a pure function of t
  function crane(x, y, H0, rot) {
    const ring = ISO.box(x - 2.6, y - 2.6, x + 2.6, y + 2.6, 0.3, 1);
    return ISO.addStatic({ fp: [x - 2.6, y - 2.6, x + 2.6, y + 2.6], kind: "crane", dyn: true, draw: (V, out, st, t) => {
      const P = V.P, off = ISO.shadowOff; let lat = "";
      ISO.faces(V, x - 2.6, y - 2.6, x + 2.6, y + 2.6).forEach((F) => { for (let z = 0; z < H0 - 6; z += 8) { const p = P(F.a[0], F.a[1], z), q = P(F.b[0], F.b[1], z + 8), r = P(F.b[0], F.b[1], z), s = P(F.a[0], F.a[1], z + 8); lat += `M${r1(p[0])} ${r1(p[1])}L${r1(q[0])} ${r1(q[1])}M${r1(r[0])} ${r1(r[1])}L${r1(s[0])} ${r1(s[1])}`; } });
      const mh = HL.hull(HL.ringAt(P, ring, 0).concat(HL.ringAt(P, ring, H0)));
      out.push(`<path class="fs" d="${polyD(mh.map((q) => [q[0] + off, q[1] + off]))}"/>`);
      ISO.solid(V, out, ring, 0, H0, { top: "p", L: "p", R: "l", extra: `<path class="cc" d="${lat}"/>`, sil: "s" });
      const ang = rot(t), co = Math.cos(ang), si = Math.sin(ang), J = (a, w) => [x + a * co - w * si, y + a * si + w * co];
      ISO.solid(V, out, ISO.rot(ISO.box(-24, -4, -12, 4, 0.4, 1), x, y, ang), H0 - 2, H0 + 5, { top: "l", L: "l", R: "d", sil: "s" });
      ISO.solid(V, out, ISO.rot(ISO.box(-24, -2, 74, 2, 0.3, 1), x, y, ang), H0, H0 + 4, { top: "p", L: "l", R: "d", sil: "s" });
      // trolley + hook + load (the load travels and rises/falls)
      const rr = 30 + 26 * (0.5 + 0.5 * Math.sin(t * 0.35)), zl = H0 - 34 - 40 * (0.5 + 0.5 * Math.sin(t * 0.5 + 1)), tp = J(rr, 0), a1 = P(tp[0], tp[1], H0), a2 = P(tp[0], tp[1], zl + 5);
      out.push(`<path class="ln" d="M${r1(a1[0])} ${r1(a1[1])}L${r1(a2[0])} ${r1(a2[1])}"/>`);
      ISO.solid(V, out, ISO.rot(ISO.box(-6, -3, 6, 3, 0.4, 1), tp[0], tp[1], ang), zl, zl + 5, { top: "p", L: "l", R: "d", sil: "s" });
      return mh;
    } });
  }
  function booth(x, y) {
    return ISO.addStatic({ fp: [x - 5, y - 4, x + 5, y + 4], kind: "booth", draw: (V, out) => {
      const win = ISO.windows(V, x - 5, y - 4, x + 5, y + 4, 0, 11, { rng: ISO.rng(5), phase: 0.99, groups: 1, cw: 4.5, rh: 6, ww: 3.4, wh: 3.4, top: 1, bottom: 5.5, m: 1 });
      const h1 = ISO.solid(V, out, ISO.box(x - 5, y - 4, x + 5, y + 4, 0.8, 1), 0, 11, { top: "p", extra: win, sil: "s" });
      const h2 = ISO.solid(V, out, ISO.box(x - 6.5, y - 5.5, x + 6.5, y + 5.5, 0.8, 1), 11, 12.6, { top: "l", sil: "s" });
      return HL.hull(h1.concat(h2));
    } });
  }
  // entry barrier: post + arm rotating up by arm(t) (0 closed .. 1 open)
  function barrier(x, y, len, armFn) {
    return ISO.addStatic({ fp: [x - 1.6, y - 1.6, x + 1.6, y + len], kind: "barrier", dyn: true, bbLive: true, draw: (V, out, st, t) => {
      const P = V.P, hp = ISO.solid(V, out, ISO.box(x - 1.6, y - 1.6, x + 1.6, y + 1.6, 0.4, 1), 0, 8, { top: "k", L: "p", R: "l", sil: "s" });
      const a = armFn(t) * 1.35, p0 = P(x, y, 7), p1 = P(x, y + len * Math.cos(a), 7 + len * Math.sin(a));
      let stripes = ""; for (let k = 1; k < 6; k += 2) { const u0 = k / 6, u1 = (k + 1) / 6, A = [p0[0] + (p1[0] - p0[0]) * u0, p0[1] + (p1[1] - p0[1]) * u0], B = [p0[0] + (p1[0] - p0[0]) * u1, p0[1] + (p1[1] - p0[1]) * u1]; stripes += `M${r1(A[0])} ${r1(A[1])}L${r1(B[0])} ${r1(B[1])}`; }
      out.push(`<path class="arm0" d="M${r1(p0[0])} ${r1(p0[1])}L${r1(p1[0])} ${r1(p1[1])}"/><path class="arm1" d="M${r1(p0[0])} ${r1(p0[1])}L${r1(p1[0])} ${r1(p1[1])}"/><path class="arm2" d="${stripes}"/>`);
      return HL.hull(hp.concat([p1, p0]));
    } });
  }

  // ---------- ground ----------
  function groundFn(G, o) {
    return (V, out) => {
      const P = V.P, B = G.bounds, q = (x, y, z = 0) => P(x, y, z);
      ISO.solid(V, out, ISO.box(B[0], B[1], B[2], B[3], 10, 3), -12, 0, { top: "d", L: "l", R: "d", sil: "s", noCr: true });
      // outer sidewalk ring
      const ib = [G.xs[0] - RH, G.ys[0] - RH, G.xs[G.nx - 1] + RH, G.ys[G.ny - 1] + RH];
      out.push(`<path class="Fp" fill-rule="evenodd" d="${polyD(HL.rrect(B[0], B[1], B[2], B[3], 10, 3).map((p) => q(p.u, p.v)))}${polyD([q(ib[0], ib[1]), q(ib[2], ib[1]), q(ib[2], ib[3]), q(ib[0], ib[3])])}"/>`);
      out.push(`<path class="c" d="${polyD([q(ib[0], ib[1]), q(ib[2], ib[1]), q(ib[2], ib[3]), q(ib[0], ib[3])])}"/>`);
      // blocks: curb slab + inner surface
      G.blocks.forEach((b) => {
        ISO.solid(V, out, ISO.box(b.x0, b.y0, b.x1, b.y1, 3, 2), 0, 1.2, { top: "p", L: "l", R: "d", sil: "c", noCr: true });
        const k = b.surface || "l", ring = ISO.box(b.x0 + SW, b.y0 + SW, b.x1 - SW, b.y1 - SW, 1.5, 1);
        out.push(`<path class="F${k}" d="${polyD(HL.ringAt(P, ring, 1.2))}"/><path class="cc" d="${polyD(HL.ringAt(P, ring, 1.2))}"/>`);
        if (b.paint) b.paint(V, out);
      });
      // markings: centre dashes, crosswalk stripes, stop lines
      let dash = "", zebra = "", stop = "";
      for (let i = 0; i < G.nx; i++) for (let j = 0; j < G.ny; j++) {
        const N = [G.xs[i], G.ys[j]];
        [[1, 0], [0, 1]].forEach((d) => {
          const i2 = i + d[0], j2 = j + d[1]; if (i2 >= G.nx || j2 >= G.ny) return;
          const N2 = [G.xs[i2], G.ys[j2]], a = add(N, d, RH + CW + 3), b = add(N2, d, -(RH + CW + 3)), A = q(a[0], a[1]), Bq = q(b[0], b[1]);
          dash += `M${r1(A[0])} ${r1(A[1])}L${r1(Bq[0])} ${r1(Bq[1])}`;
          const r = [d[1], -d[0]];
          [[N, d], [N2, [-d[0], -d[1]]]].forEach(([M, dd]) => {
            for (let w = -RH + 2; w < RH - 2; w += 3.4) {
              const p0 = add(add(M, dd, RH + 0.8), r, w), p1 = add(add(M, dd, RH + CW - 0.8), r, w), p2 = add(p1, r, 1.9), p3 = add(p0, r, 1.9);
              zebra += polyD([q(p0[0], p0[1]), q(p1[0], p1[1]), q(p2[0], p2[1]), q(p3[0], p3[1])]);
            }
            // stop line on the incoming lane (the lane whose right side is r' where travel = -dd)
            const tr = [-dd[0], -dd[1]], rr = [tr[1], -tr[0]], s0 = add(add(M, dd, RH + CW + 0.6), rr, 0.6), s1 = add(add(M, dd, RH + CW + 0.6), rr, RH - 1.5);
            const S0p = q(s0[0], s0[1]), S1p = q(s1[0], s1[1]); stop += `M${r1(S0p[0])} ${r1(S0p[1])}L${r1(S1p[0])} ${r1(S1p[1])}`;
          });
        });
      }
      out.push(`<path class="mkd" d="${dash}"/><path class="Fp" d="${zebra}"/><path class="mks" d="${stop}"/>`);
      (o.extraGround || []).forEach((fn) => fn(V, out));
    };
  }

  // ---------- block filling ----------
  function lots(r, rng, maxW, out, depth = 0) {
    const w = r[2] - r[0], d = r[3] - r[1];
    if ((w <= maxW && d <= maxW) || depth > 6 || (w < 22 && d < 22)) { out.push(r); return; }
    const g = 3.2, f = rng.range(0.36, 0.64);
    if (w >= d) { const m = r[0] + w * f; lots([r[0], r[1], m - g / 2, r[3]], rng, maxW, out, depth + 1); lots([m + g / 2, r[1], r[2], r[3]], rng, maxW, out, depth + 1); }
    else { const m = r[1] + d * f; lots([r[0], r[1], r[2], m - g / 2], rng, maxW, out, depth + 1); lots([r[0], m + g / 2, r[2], r[3]], rng, maxW, out, depth + 1); }
  }
  function roofFor(rng, x0, y0, x1, y1, tall) {
    const items = [], w = x1 - x0, d = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const nAc = Math.min(3, Math.floor((w * d) / 260) + (rng() < 0.5 ? 1 : 0));
    for (let k = 0; k < nAc; k++) items.push({ k: "ac", x: rng.range(x0 + 5, x1 - 5), y: rng.range(y0 + 5, y1 - 5), w: rng.range(4, 6.5), d: rng.range(4, 6), h: rng.range(2.5, 4) });
    if (w > 14 && d > 14 && rng() < (tall ? 0.45 : 0.3)) items.push({ k: "tank", x: x0 + 6, y: y0 + 6, R: 3.6, h: 6 });
    if (tall && rng() < 0.55) items.push({ k: "ant", x: cx + rng.range(-3, 3), y: cy + rng.range(-3, 3), h: rng.range(14, 28) });
    // de-overlap (drop items too close)
    return items.filter((a, i) => items.slice(0, i).every((b) => Math.hypot(a.x - b.x, a.y - b.y) > 7.5));
  }
  // window phase: spatial (diagonal band) + jitter, so "lights on" sweeps across the city in waves
  const wph = (x, y, rng) => ((((x + y) / 700 + 0.18 * rng()) % 1) + 1) % 1;
  function fillBlock(b, rng, o) {
    const ix0 = b.x0 + SW + 1.5, iy0 = b.y0 + SW + 1.5, ix1 = b.x1 - SW - 1.5, iy1 = b.y1 - SW - 1.5, dist = o.district(b);
    const L = []; lots([ix0, iy0, ix1, iy1], rng, dist > 0.55 ? 54 : 44, L);
    const made = [];
    L.forEach((r) => {
      const w = r[2] - r[0], d = r[3] - r[1]; if (w < 10 || d < 10) return;
      const u = rng(), pT = 0.04 + 0.5 * dist * dist, pS = 0.6 * (1 - dist);
      const x0 = r[0] + 1, y0 = r[1] + 1, x1 = r[2] - 1, y1 = r[3] - 1;
      if (u < pT && w > 16 && d > 16) {
        const h = 46 + dist * rng.range(20, 125) + rng.range(0, 20), tiers = [{ x0, y0, x1, y1, z0: 0, z1: h }];
        if (h > 110 && w > 24 && d > 24) { const k1 = rng.range(4, 7); tiers[0].z1 = h * rng.range(0.55, 0.72); tiers.push({ x0: x0 + k1, y0: y0 + k1, x1: x1 - k1, y1: y1 - k1, z0: tiers[0].z1, z1: h }); }
        if (h > 190 && w > 34 && d > 34) { const T = tiers[1], k2 = rng.range(4, 6); T.z1 = h * 0.86; tiers.push({ x0: T.x0 + k2, y0: T.y0 + k2, x1: T.x1 - k2, y1: T.y1 - k2, z0: T.z1, z1: h }); }
        const Tt = tiers[tiers.length - 1];
        made.push(building({ kind: "tower", tiers, seed: rng.int(1, 1e9), phase: wph(x0, y0, rng), roof: roofFor(rng, Tt.x0, Tt.y0, Tt.x1, Tt.y1, true), cw: 6.5, rh: 8.6, far: o.far && o.far(b) }));
      } else if (u < pT + pS || w < 16 || d < 16) {
        made.push(shop({ x0, y0, x1, y1, h: rng.range(12, 19), roof: roofFor(rng, x0, y0, x1, y1, false).filter((it) => it.k === "ac").slice(0, 2) }));
      } else {
        const h = rng.range(26, 62);
        made.push(building({ kind: "mid", tiers: [{ x0, y0, x1, y1, z0: 0, z1: h }], seed: rng.int(1, 1e9), phase: wph(x0, y0, rng), roof: roofFor(rng, x0, y0, x1, y1, false), cw: 8, rh: 9.5, ww: 4.6, wh: 5, far: o.far && o.far(b) }));
      }
    });
    return made;
  }
  // trees + lamps along chosen sidewalk sides of a block
  function streetFurniture(b, rng, o) {
    const sides = [[b.x0, b.y0, b.x1, b.y0, [0, -1]], [b.x1, b.y0, b.x1, b.y1, [1, 0]], [b.x1, b.y1, b.x0, b.y1, [0, 1]], [b.x0, b.y1, b.x0, b.y0, [-1, 0]]];
    sides.forEach(([ax, ay, bx, by, n], si) => {
      if (rng() > (o.sideP ?? 0.55)) return;
      const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len, inset = SW / 2;
      let k = 0;
      for (let s = 16; s < len - 14; s += o.pitch || 24, k++) {
        const x = ax + ux * s - n[0] * inset, y = ay + uy * s - n[1] * inset;
        if (k % 3 === 1) lamp(x, y, n); else tree(x, y, rng.range(0.85, 1.1));
      }
    });
  }
  function signals(G, net) {
    for (let i = 0; i < G.nx; i++) for (let j = 0; j < G.ny; j++) {
      const N = [G.xs[i], G.ys[j]], ins = net.inAt[net.key(i, j)] || [];
      ["x", "y"].forEach((ax) => {
        const e = ins.find((e2) => e2.light && e2.light.axis === ax && (() => { const c = add(add(N, e2.d, -(RH + 3.5)), e2.r, RH + 3.5); return G.blocks.some((b) => c[0] > b.x0 && c[0] < b.x1 && c[1] > b.y0 && c[1] < b.y1); })());
        if (!e) return;
        const c = add(add(N, e.d, -(RH + 3.5)), e.r, RH + 3.5), arm = [-e.r[0] * (RH + 3.5 - LO), -e.r[1] * (RH + 3.5 - LO)];
        signal(c[0], c[1], arm, net.key(i, j), ax);
      });
    }
  }

  // ---------- world: city ----------
  R.city = (seed, o = {}) => {
    const rng = ISO.rng(seed);
    const cols = o.cols || Array.from({ length: o.blocksX || 5 }, () => rng.int(o.bmin || 110, o.bmax || 140));
    const rows = o.rows || Array.from({ length: o.blocksY || 4 }, () => rng.int(o.bmin || 110, o.bmax || 140));
    const G = grid({ cols, rows, margin: 10 }), net = buildNet(G), lightFn = lightFnFor(G);
    const R0 = Math.hypot(G.bounds[2], G.bounds[3]) * 0.8, dc = o.downtown || [0, 0];
    const district = (b) => Math.max(0, 1 - Math.hypot((b.x0 + b.x1) / 2 - dc[0], (b.y0 + b.y1) / 2 - dc[1]) / R0);
    const parkBlock = o.park != null ? o.park : rng.int(0, G.blocks.length - 1);
    let craneDone = false, heroB = null;
    ISO.addGround(groundFn(G, o));
    G.blocks.forEach((b, bi) => {
      if (bi === parkBlock) {
        b.surface = "b";
        for (let x = b.x0 + 20; x < b.x1 - 12; x += 19) for (let y = b.y0 + 20; y < b.y1 - 12; y += 19) if (rng() < 0.72) tree(x + rng.range(-3, 3), y + rng.range(-3, 3), rng.range(0.9, 1.25));
        return;
      }
      const made = fillBlock(b, rng, { district, far: o.far });
      if (!craneDone && district(b) > 0.4 && bi !== (o.heroBlock ?? -1) && made.length > 2 && rng() < 0.5) {
        // turn one tower lot into a construction site: lower floors + crane
        const st = made.find((m) => m.kind === "tower");
        if (st) {
          const T = st.o.tiers[0]; st.o.tiers = [{ x0: T.x0, y0: T.y0, x1: T.x1, y1: T.y1, z0: 0, z1: 34 }]; st.o.roof = []; st.o.cw = 99;
          crane(T.x0 - 4 > b.x0 + SW ? T.x0 - 3 : T.x1 + 3, (T.y0 + T.y1) / 2, 150, (t) => 0.6 + t * 0.12);
          craneDone = true;
        }
      }
      streetFurniture(b, rng, o);
      if (o.heroBlock === bi) heroB = made.filter((m) => m.kind === "tower").sort((a, c) => c.o.tiers[c.o.tiers.length - 1].z1 - a.o.tiers[a.o.tiers.length - 1].z1)[0] || null;
    });
    if (heroB) {
      // the hero tower rises clearly above the skyline so its marker roof reads from any shot
      heroB.o.hero = "hero"; heroB.hero = "hero";
      const top = (b) => b.o.tiers[b.o.tiers.length - 1].z1, maxH = Math.max(...ISO.world.statics.filter((st) => st.kind === "tower" && st !== heroB).map(top)), f = (maxH + 40) / top(heroB);
      heroB.o.tiers.forEach((T) => { T.z0 *= f; T.z1 *= f; });
    }
    signals(G, net);
    const sim = Sim(net, { seed: seed + 7, cars: o.cars || 70, buses: o.buses || 4, dur: o.dur, warmup: o.warmup ?? 24, lightFn, trace: o.trace });
    ISO.world.lightFn = lightFn;
    const movers = sim.cars.map((c) => ({ id: c.id, kind: c.kind, top: c.top, paint: paintCar }));
    ISO.world.movers = (t) => movers.map((m) => { const p = sim.sample(m.id, t); m.x = p[0]; m.y = p[1]; m.hd = p[2]; return m; });
    return { G, net, sim, hero: heroB, statics: ISO.world.statics.length, district };
  };

  // ---------- world: parking lot (centre block of a 3x3 grid) ----------
  R.parking = (seed, o = {}) => {
    const rng = ISO.rng(seed), BW = 12, BD = 22, AW = 24, NC = o.cols || 12, M = 6, RT = 11, RD = 10;
    const LH = 4 * BD + 2 * AW + 2 * M, Ru = (AW + 2 * BD) / 2, LW = 34 + NC * BW + RT + 2 + Ru + AW / 2 + 6;
    const G = grid({ cols: [o.side || 128, LW + 2 * SW, o.side || 128], rows: [o.side || 118, LH + 2 * SW, o.side || 118], margin: 10 });
    const net = buildNet(G), lightFn = lightFnFor(G), E = net.edges;
    const lotB = G.blocks.find((b) => b.i === 1 && b.j === 1); lotB.surface = "d";
    const lx0 = lotB.x0 + SW, ly0 = lotB.y0 + SW;
    const A2 = ly0 + M + BD + AW / 2, A1 = A2 + AW / 2 + 2 * BD + AW / 2, bxs = Array.from({ length: NC }, (_, k) => lx0 + 34 + k * BW + BW / 2);
    const xu = bxs[NC - 1] + RT + 2;
    const mk = (pts, props) => { const e = Object.assign({ id: E.length, pts, next: [], vmax: V_LOT }, props); measure(e); E.push(e); return e; };
    // aisle 1 (east), U-turn, aisle 2 (west)
    const n1 = bxs.map((bx) => [bx - RT, A1]), n2 = bxs.map((bx) => [bx + RT, A2]);
    const a1 = [], a2 = [];
    for (let k = 0; k < NC - 1; k++) a1.push(mk([n1[k], n1[k + 1]], { kind: "aisle" }));
    const a1end = mk([n1[NC - 1], [xu, A1]], { kind: "aisle" });
    const Cu = [xu, (A1 + A2) / 2], uturn = mk([[xu, A1]].concat(Array.from({ length: 12 }, (_, q) => { const f = Math.PI / 2 - ((q + 1) / 12) * Math.PI; return [Cu[0] + Ru * Math.cos(f), Cu[1] + Ru * Math.sin(f)]; })), { kind: "aisle", vmax: 11 });
    const a2start = mk([[xu, A2], n2[NC - 1]], { kind: "aisle" });
    for (let k = NC - 1; k > 0; k--) a2.push(mk([n2[k], n2[k - 1]], { kind: "aisle" }));
    // lane split points on the northbound lane of the west road
    const xL = G.xs[1] + LO, laneE = E.find((e) => e.kind === "lane" && e.d[0] === 0 && e.d[1] === 1 && Math.abs(e.pts[0][0] - xL) < 0.01 && e.pts[0][1] < A2 && e.pts[1][1] > A1);
    const Xp = [xL, A2 + RD], Dp = [xL, A1 - RD], p1 = laneE.pts[1];
    const e2 = mk([Xp, Dp], { kind: "lane", vmax: V_LANE }), e3 = mk([Dp, p1], { kind: "lane", vmax: V_LANE, light: laneE.light, d: laneE.d, r: laneE.r });
    e3.next = laneE.next; laneE.next = [e2.id]; laneE.pts = [laneE.pts[0], Xp]; delete laneE.light; measure(laneE);
    const gateX = lx0 + 13;
    const drive = mk(arc([xL + RD, A1 - RD], [-1, 0], [0, 1], RD).concat([[gateX - 6, A1], n1[0]]), { kind: "drive", vmax: V_LOT, gate: 0 });
    drive.gate = drive.len - (n1[0][0] - gateX) - CAR.len / 2 - 1.5;
    e2.next = [e3.id, drive.id];
    const exitE = mk([n2[0], [xL + RD + 8, A2]].concat(arc([xL + RD, A2 + RD], [0, -1], [-1, 0], RD)), { kind: "exit", vmax: 9, yield: [0, 1] });
    exitE.next = [e2.id];
    // chain the aisles
    drive.next = [a1[0] ? a1[0].id : a1end.id];
    a1.forEach((e, k) => (e.next = [k + 1 < a1.length ? a1[k + 1].id : a1end.id]));
    a1end.next = [uturn.id]; uturn.next = [a2start.id]; a2start.next = [a2[0] ? a2[0].id : exitE.id];
    a2.forEach((e, k) => (e.next = [k + 1 < a2.length ? a2[k + 1].id : exitE.id]));
    // bays: rows A (above aisle 1), B1 (below aisle 1), B2 (above aisle 2), C (below aisle 2)
    const bays = [];
    const mkBay = (k, aisle, side) => {
      const bx = bxs[k], A = aisle === 1 ? A1 : A2, sx = aisle === 1 ? -RT : RT, cy = A + side * (AW / 2 + BD / 2), node = [bx + sx, A];
      const Cc = [bx + sx, A + side * RT], pts = arc(Cc, [(node[0] - Cc[0]) / RT, (node[1] - Cc[1]) / RT], [(bx - Cc[0]) / RT, 0], RT).concat([[bx, cy]]);
      const inE = mk(pts, { kind: "bayin", vmax: V_BAY + 2, stopEnd: true });
      const outE = mk(pts.slice().reverse(), { kind: "bayout", vmax: V_BAY, stopEnd: true, rev: true });
      bays.push({ k: bays.length, bx, cy, aisle, col: k, side, inE: inE.id, outE: outE.id, mouth: [bx, A + side * (AW / 2)], occ: null, x0: bx - BW / 2, x1: bx + BW / 2, y0: Math.min(cy - BD / 2, cy + BD / 2), y1: Math.max(cy - BD / 2, cy + BD / 2) });
    };
    for (let k = 0; k < NC; k++) { mkBay(k, 1, 1); mkBay(k, 1, -1); mkBay(k, 2, 1); mkBay(k, 2, -1); }
    // routes
    const aisleIdx1 = (k) => (k < a1.length ? a1.slice(k).map((e) => e.id) : []).concat([a1end.id]);
    const aisle2From = (k) => { const pos = NC - 1 - k; return a2.slice(pos).map((e) => e.id).concat([exitE.id]); };
    const routeIn = (bk) => { const b = bays[bk]; if (b.aisle === 1) return a1.slice(0, b.col).map((e) => e.id).concat([b.inE]); return a1.map((e) => e.id).concat([a1end.id, uturn.id, a2start.id]).concat(a2.slice(0, NC - 1 - b.col).map((e) => e.id)).concat([b.inE]); };
    const routeOut = (bk) => { const b = bays[bk]; if (b.aisle === 1) return aisleIdx1(b.col).concat([uturn.id, a2start.id]).concat(aisle2From(NC - 1)); return aisle2From(b.col); };
    // distance-to-driveway (for lot-bound routing)
    const dist = new Float64Array(E.length).fill(Infinity); dist[drive.id] = 0;
    { // Dijkstra on the reversed edge graph (lot-internal edges excluded): dist[e] = length from the start of e to the driveway
      const skip = (e) => ["aisle", "bayin", "bayout", "exit"].includes(e.kind), prev = E.map(() => []);
      E.forEach((e) => { if (!skip(e) && e.id !== drive.id) e.next.forEach((n) => prev[n].push(e.id)); });
      const done = new Uint8Array(E.length);
      for (;;) {
        let u = -1; for (let q = 0; q < E.length; q++) if (!done[q] && isFinite(dist[q]) && (u < 0 || dist[q] < dist[u])) u = q;
        if (u < 0) break; done[u] = 1;
        prev[u].forEach((p) => { const v = E[p].len + dist[u]; if (v < dist[p]) dist[p] = v; });
      }
    }
    net.dist = dist;
    // hero bay: row A (aisle 1, above), a middle column
    const heroBay = bays.findIndex((b) => b.aisle === 1 && b.side === 1 && b.col === (o.heroCol ?? 4));
    const all = bays.map((b) => b.k).filter((k) => k !== heroBay), initParked = [];
    all.forEach((k) => { if (rng() < (o.initFill ?? 0.3)) initParked.push(k); });
    const departs = []; const pk = initParked.slice(); for (let q = 0; q < (o.departs ?? 3); q++) { const i = Math.floor(rng() * pk.length); departs.push([pk.splice(i, 1)[0], rng.range(-4, o.dur - 8)]); }
    if (o.leaveAt != null) { const hc = bays[heroBay].col, cand = pk.filter((k) => bays[k].aisle === 1).sort((a, b) => Math.abs(bays[a].col - hc - 2.5) - Math.abs(bays[b].col - hc - 2.5)); if (cand.length) departs.push([cand[0], o.leaveAt]); }
    const bound = []; for (let tt = -18; tt < o.dur - 12; tt += rng.range(1.8, 2.8)) bound.push(tt);
    const lot = { bays, heroBay, initParked, departs, bound, routeIn, routeOut, heroAt: o.heroAt ?? 3, heroDist: o.heroDist || [220, 1e9], order: (k) => (bays[k].aisle === 1 ? bays[k].col : 2 * NC + (NC - bays[k].col)), dwell: (c, t) => (rng() < 0.08 ? t + rng.range(8, 14) : 1e9) };
    // ground paint for the lot: bay lines, aisle arrows, hero bay
    lotB.paint = (V, out) => {
      const P = V.P; let lines = "", arrows = "";
      const seg = (a, b) => { const p = P(a[0], a[1], 1.2), q = P(b[0], b[1], 1.2); return `M${r1(p[0])} ${r1(p[1])}L${r1(q[0])} ${r1(q[1])}`; };
      [[A1, 1], [A1, -1], [A2, 1], [A2, -1]].forEach(([A, side]) => {
        const y0 = A + side * (AW / 2), y1 = A + side * (AW / 2 + BD);
        for (let k = 0; k <= NC; k++) { const x = bxs[0] - BW / 2 + k * BW; lines += seg([x, y0 + side * 1.5], [x, y1]); }
        lines += seg([bxs[0] - BW / 2, y1], [bxs[NC - 1] + BW / 2, y1]);
      });
      [[A1, 1], [A2, -1]].forEach(([A, dir]) => { for (let k = 1; k < NC; k += 4) { const x = bxs[k]; const tip = [x + dir * 5, A], l = [x - dir * 2, A - 3.5], r = [x - dir * 2, A + 3.5]; arrows += polyD([P(tip[0], tip[1], 1.2), P(l[0], l[1], 1.2), P(x, A, 1.2), P(r[0], r[1], 1.2)]); } });
      const hb = bays[heroBay], hp = [[hb.x0 + 1.2, hb.y0 + 1.5], [hb.x1 - 1.2, hb.y0 + 1.5], [hb.x1 - 1.2, hb.y1 - 0.5], [hb.x0 + 1.2, hb.y1 - 0.5]].map((p) => P(p[0], p[1], 1.2));
      out.push(`<path class="mks" d="${lines}"/><path class="Fp" d="${arrows}"/><path class="hb0" data-hi="bay" data-on="hbm" data-off="hb0" d="${polyD(hp)}"/>`);
    };
    ISO.addGround(groundFn(G, o));
    // surrounding blocks: low-rise
    G.blocks.forEach((b) => { if (b === lotB) return; fillBlock(b, rng, { district: () => 0.25 }); streetFurniture(b, rng, { sideP: 0.6 }); });
    // lot furniture: booth, barrier, lamps, trees on the lot's sidewalk
    booth(gateX - 2, A1 - AW / 2 - 7);
    const sim0 = { arm: () => 0 };
    barrier(gateX, A1 - AW / 2 + 1, AW - 3, (t) => sim0.arm(t));
    [[lx0 + 26, A2 + AW / 2 + BD], [xu - 4, A2 + AW / 2 + BD], [lx0 + 26, A1 + AW / 2 + BD + 2.5], [xu - 4, ly0 + 2.5]].forEach(([x, y], q) => lamp(x, y, q % 2 ? [-1, 0] : [1, 0]));
    for (let x = lotB.x0 + 18; x < lotB.x1 - 10; x += 26) { tree(x, lotB.y1 - SW / 2, 1); }
    for (let y = lotB.y0 + 18; y < lotB.y1 - 10; y += 30) { if (Math.abs(y - A1) > 18 && Math.abs(y - A2) > 18) tree(lotB.x0 + SW / 2, y, 0.95); }
    signals(G, net);
    const sim = Sim(net, { seed: seed + 11, cars: o.cars || 44, buses: o.buses || 1, dur: o.dur, warmup: 22, lightFn, lot, traceLot: o.traceLot, trace: o.trace, debug: o.debug });
    sim0.arm = sim.arm;
    ISO.world.lightFn = lightFn;
    const movers = sim.cars.map((c) => ({ id: c.id, kind: c.kind, top: c.top, paint: paintCar }));
    ISO.world.movers = (t) => movers.map((m) => { const p = sim.sample(m.id, t); m.x = p[0]; m.y = p[1]; m.hd = p[2]; return m; });
    const hbB = bays[heroBay];
    ISO.subjects.bay = () => ({ kind: "ground", pts3: [[hbB.x0, hbB.y0, 1], [hbB.x1, hbB.y0, 1], [hbB.x1, hbB.y1, 1], [hbB.x0, hbB.y1, 1]], fp: [hbB.x0, hbB.y0, hbB.x1, hbB.y1], hi: "bay", tier: "small" });
    return { G, net, sim, lot, lotB, A1, A2, bxs, heroBay, statics: ISO.world.statics.length, gate: [gateX, A1] };
  };
  // subject providers for ISO.focus
  R.subjectStatic = (st) => () => {
    const T = st.o && st.o.tiers, pts3 = [];
    (T || [{ x0: st.fp[0], y0: st.fp[1], x1: st.fp[2], y1: st.fp[3], z0: 0, z1: 10 }]).forEach((q) => [q.z0, q.z1].forEach((z) => pts3.push([q.x0, q.y0, z], [q.x1, q.y0, z], [q.x1, q.y1, z], [q.x0, q.y1, z])));
    return { kind: "static", st, pts3, fp: st.fp, hi: st.o && st.o.hero ? st.o.hero : "s" + st.idx, tier: "large" };
  };
  R.subjectCar = (sim, id) => (t) => {
    const p = sim.sample(id, t), c = sim.cars[id], hl = c.len / 2, hw = c.w / 2, co = Math.cos(p[2]), si = Math.sin(p[2]), pts3 = [], h = c.kind === "bus" ? 11.5 : 8.7;
    [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]].forEach(([a, b]) => [0, h].forEach((z) => pts3.push([p[0] + a * co - b * si, p[1] + a * si + b * co, z])));
    const ex = hl * Math.abs(co) + hw * Math.abs(si), ey = hl * Math.abs(si) + hw * Math.abs(co);
    return { kind: "mover", mover: id, pts3, fp: [p[0] - ex, p[1] - ey, p[0] + ex, p[1] + ey, 0], hi: null, tier: "small" };
  };
  R.paintCar = paintCar; R.CAR = CAR;
  root.WORLDS = R;
})(typeof window !== "undefined" ? window : globalThis);
