/* world-kit.js (dense spike): poster-monochrome isometric WORLDS (hundreds of static solids + dozens of movers) on HLG geometry.
 *
 * Render model (the performance strategy):
 *  - Statics (buildings, trees, lamps, poles...) are projected and painted ONCE per camera azimuth into <g> groups, in a
 *    topological painter's order (footprint-separation rule, only for pairs whose screen boxes overlap). After every static
 *    <g> sits an empty "slot" <g>. Ground (roads, markings, curbs) + all static shadows go in a single under-layer.
 *  - Movers (cars, buses) are re-projected every frame and written into the slot right after the last static they are in
 *    front of (same footprint-separation rule), so buildings occlude cars correctly with zero re-sorting of statics.
 *  - Camera pan/zoom = one transform on the world <g> (no reprojection). Stroke widths are CSS vars rescaled per frame, so
 *    outlines stay ~2.5-5 px on screen at any zoom (thin in wide shots = level of detail, poster-thick in close-ups).
 *  - Orbit (az change) re-projects + re-sorts all statics (measured: WK.stats.build).
 *  - Seek hooks: timeline onUpdate + patched tl.render + reactive state objects (HyperFrames proxies gsap.timeline()).
 *  - Every frame is a pure function of t (clock state): nothing reads wall time or Math.random.
 * Colours come ONLY from theme CSS vars (class names below), no hex anywhere.
 */
(function (root) {
  const H = root.HLG, WK = {};
  const r1 = (n) => Math.round(n * 10) / 10;
  const ptsS = (a) => a.map((p) => r1(p[0]) + " " + r1(p[1])).join("L");
  const polyD = (a) => (a.length ? "M" + ptsS(a) + "Z" : "");
  const openD = (a) => (a.length > 1 ? "M" + ptsS(a) : "");
  Object.assign(WK, { r1, polyD, openD });

  // world styles (theme tokens only), injected into the shadow root: HyperFrames' compile step does not keep extra <style> blocks addressable
  WK.CSS = `.wk .Fp{fill:var(--paper);stroke:var(--paper);stroke-width:.35}.wk .Fl{fill:var(--pale);stroke:var(--pale);stroke-width:.35}
.wk .Fd{fill:var(--deep);stroke:var(--deep);stroke-width:.35}.wk .Fb{fill:var(--bg);stroke:var(--bg);stroke-width:.35}
.wk .Fk{fill:var(--ink);stroke:var(--ink);stroke-width:.35}.wk .Fm{fill:var(--marker);stroke:var(--marker);stroke-width:.35}
.wk .Fa{fill:var(--alert);stroke:var(--alert);stroke-width:.35}
.wk .fp{fill:var(--paper)}.wk .fb{fill:var(--bg)}.wk .fk{fill:var(--ink)}.wk .fs{fill:var(--shadow)}
.wk .s{fill:none;stroke:var(--ink);stroke-width:var(--ws);stroke-linejoin:round}
.wk .sb{fill:none;stroke:var(--ink);stroke-width:var(--wsb);stroke-linejoin:round}
.wk .sh{fill:none;stroke:var(--ink);stroke-width:var(--wsh);stroke-linejoin:round}
.wk .sc{fill:none;stroke:var(--ink);stroke-width:var(--wsc);stroke-linejoin:round}
.wk .c{fill:none;stroke:var(--ink);stroke-width:var(--wc);stroke-linecap:round;stroke-linejoin:round}
.wk .cc{fill:none;stroke:var(--ink);stroke-width:var(--wcc);stroke-linecap:round;stroke-linejoin:round}
.wk .ln{fill:none;stroke:var(--ink);stroke-width:var(--wln);stroke-linecap:round;stroke-linejoin:round}
.wk .mkd{fill:none;stroke:var(--paper);stroke-width:1.3;stroke-dasharray:7 7}
.wk .mks{fill:none;stroke:var(--paper);stroke-width:1.3;stroke-linecap:round}
.wk .WL0{fill:var(--bg)}.wk .WR0{fill:var(--ink)}.wk .WL1,.wk .WR1{fill:var(--paper)}
.wk .Lg{fill:var(--paper);stroke:var(--ink);stroke-width:.6}.wk .Lr{fill:var(--alert);stroke:var(--ink);stroke-width:.6}
.wk .arm0{fill:none;stroke:var(--ink);stroke-width:2.8;stroke-linecap:round}.wk .arm1{fill:none;stroke:var(--paper);stroke-width:1.5;stroke-linecap:round}
.wk .arm2{fill:none;stroke:var(--ink);stroke-width:1.5}
.wk .hb0{fill:none;stroke:none}.wk .hbm{fill:var(--marker);stroke:var(--ink);stroke-width:var(--wc)}
.wk .xr path,.wk .xr circle{fill:none!important;stroke:var(--ink)!important;stroke-width:var(--wcc)!important}.wk .xr .win,.wk .xr .fs{display:none}
svg{pointer-events:none}#wk-world *{pointer-events:visiblePainted}.wk .hb1{fill:var(--paper);stroke:var(--ink);stroke-width:var(--wc)}`;
  // ---------- seeded PRNG (mulberry32) ----------
  WK.rng = (seed) => {
    let a = seed >>> 0 || 1;
    const f = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.range = (lo, hi) => lo + f() * (hi - lo);
    f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    return f;
  };

  // ---------- projection (S = 1, origin 0; the camera is a transform) ----------
  WK.view = (az, k) => {
    const C = H.Cam(az, k, 1); C.ox = 0; C.oy = 0;
    return { C, az, k, P: H.proj(C), front: H.facing(C), c: Math.cos(C.az), s: Math.sin(C.az) };
  };

  // ---------- solid painter ----------
  // ring = rrect/circ samples {u,v,nu,nv}; faces: top / L side / R side as token letters p l d b k m a s (paper pale deep bg ink marker alert shadow)
  // f.sil = silhouette class (s | sb | sh | sc), f.cr = extra crease path d, f.extra = svg before the silhouette, f.lip = inner ring on top
  function solid(V, out, ring, z0, z1, f) {
    f = f || {};
    const { P, c, s } = V, n = ring.length, top = H.ringAt(P, ring, z1), hgt = z1 - z0;
    const bot = hgt > 0.05 ? H.ringAt(P, ring, z0) : top;
    const Lf = f.L || "l", Rf = f.R || "d", seams = [];
    if (hgt > 0.05) {
      const seg = [];
      for (let i = 0; i < n; i++) {
        const a = ring[i], b = ring[(i + 1) % n], nu = a.nu + b.nu, nv = a.nv + b.nv;
        seg.push(nu * s + nv * c > 1e-6 ? (nu * c - nv * s < 0 ? 1 : 2) : 0);
      }
      let st = seg.findIndex((v, i) => v !== seg[(i + n - 1) % n]); if (st < 0) st = 0;
      let i = 0;
      while (i < n) {
        const v = seg[(st + i) % n]; let j = i; while (j < n && seg[(st + j) % n] === v) j++;
        if (v) {
          const idx = []; for (let q = i; q <= j; q++) idx.push((st + q) % n);
          const pts = idx.map((q) => top[q]).concat(idx.slice().reverse().map((q) => bot[q]));
          out.push(`<path class="F${v === 1 ? Lf : Rf}" d="${polyD(pts)}"/>`);
          if (v === 1 && seg[(st + j) % n] === 2) seams.push((st + j) % n);
        }
        i = j;
      }
    }
    out.push(`<path class="F${f.top || "p"}"${f.topAttr || ""} d="${polyD(top)}"/>`);
    let cr = "";
    if (hgt > 0.05 && !f.noCr) { cr += openD(H.ringAt(P, H.run(ring, V.front), z1)); seams.forEach((q) => { cr += openD([top[q], bot[q]]); }); }
    if (f.lip) cr += polyD(H.ringAt(P, f.lip, z1));
    if (f.cr) cr += f.cr;
    if (cr) out.push(`<path class="${f.crc || "c"}" d="${cr}"/>`);
    if (f.extra) out.push(f.extra);
    const hull = H.hull(top.concat(bot));
    out.push(`<path class="${f.sil || "s"}" d="${polyD(hull)}"/>`);
    return hull;
  }
  WK.solid = solid;
  WK.box = (x0, y0, x1, y1, r = 1.2, n = 2) => H.rrect(x0, y0, x1, y1, r, n);
  WK.circ = (x, y, R, n = 16) => H.circ(R, n).map((q) => ({ u: q.u + x, v: q.v + y, nu: q.nu, nv: q.nv }));
  WK.rot = (ring, cx, cy, hd) => { const co = Math.cos(hd), si = Math.sin(hd); return ring.map((q) => ({ u: cx + q.u * co - q.v * si, v: cy + q.u * si + q.v * co, nu: q.nu * co - q.nv * si, nv: q.nu * si + q.nv * co })); };

  // visible axis faces of box [x0,y0,x1,y1]: [{side:'L'|'R', a:[x,y], b:[x,y], len}] (a->b along the face)
  WK.faces = (V, x0, y0, x1, y1) => {
    const out = [];
    [[1, 0, [x1, y0], [x1, y1]], [-1, 0, [x0, y1], [x0, y0]], [0, 1, [x1, y1], [x0, y1]], [0, -1, [x0, y0], [x1, y0]]].forEach(([nu, nv, a, b]) => {
      if (nu * V.s + nv * V.c <= 1e-6) return;
      out.push({ side: nu * V.c - nv * V.s < 0 ? "L" : "R", a, b, nu, nv, len: Math.hypot(b[0] - a[0], b[1] - a[1]) });
    });
    return out;
  };
  // window grid on the visible faces: groups lit independently. Returns svg (paths class "win", toggled per frame).
  WK.windows = (V, x0, y0, x1, y1, z0, z1, o) => {
    const { P } = V, rng = o.rng, G = o.groups || 3, cw = o.cw || 7, rh = o.rh || 9, ww = o.ww || 3.6, wh = o.wh || 5, m = o.m || 3;
    let svg = "";
    WK.faces(V, x0, y0, x1, y1).forEach((F) => {
      const ncol = Math.max(1, Math.floor((F.len - 2 * m) / cw)), nrow = Math.max(0, Math.floor((z1 - z0 - (o.top || 4)) / rh));
      if (!nrow) return;
      const ux = (F.b[0] - F.a[0]) / F.len, uy = (F.b[1] - F.a[1]) / F.len, off = (F.len - ncol * cw) / 2;
      const d = Array.from({ length: G }, () => "");
      for (let r = 0; r < nrow; r++) {
        const za = z0 + (o.bottom || 3) + r * rh, zb = za + wh;
        for (let q = 0; q < ncol; q++) {
          const g = Math.floor(rng() * G), u0 = off + q * cw + (cw - ww) / 2, u1 = u0 + ww;
          const A = [F.a[0] + ux * u0, F.a[1] + uy * u0], B = [F.a[0] + ux * u1, F.a[1] + uy * u1];
          d[g] += "M" + ptsS([P(A[0], A[1], za), P(B[0], B[1], za), P(B[0], B[1], zb), P(A[0], A[1], zb)]) + "Z";
        }
      }
      d.forEach((dd, g) => { if (dd) svg += `<path class="win W${F.side}0" data-s="${F.side}" data-p="${(o.phase + g * 0.137) % 1}" d="${dd}"/>`; });
    });
    return svg;
  };

  // run-length merge: consecutive <path class="X" d=".."/> with the same class (no other attrs) become one element.
  // Painter's order is untouched (only adjacent draws of the same paint are fused). Cuts DOM size ~3x.
  WK.merge = (svg) => {
    const re = /<path class="([\w ]+)" d="([^"]*)"\/>/y, out = []; let i = 0, cur = null, d = "";
    const flush = () => { if (cur) out.push(`<path class="${cur}" d="${d}"/>`); cur = null; d = ""; };
    while (i < svg.length) {
      re.lastIndex = i; const m = re.exec(svg);
      if (m) { if (m[1] === cur) d += m[2]; else { flush(); cur = m[1]; d = m[2]; } i = re.lastIndex; continue; }
      flush(); const j = svg.indexOf("/>", i), k = svg.indexOf("<", i + 1), e = j >= 0 && (k < 0 || j < k) ? j + 2 : k < 0 ? svg.length : k; out.push(svg.slice(i, e)); i = e;
    }
    flush(); return out.join("");
  };
  // ---------- world registry ----------
  const world = { statics: [], ground: [], movers: null, lightFn: null };
  WK.world = world;
  // st: {fp:[x0,y0,x1,y1], draw(V,out,st,t) -> hull, shadow (default true), dyn (redraw each frame), key (sort tiebreak)}
  WK.addStatic = (st) => { st.idx = world.statics.length; world.statics.push(st); return st; };
  WK.addGround = (fn) => world.ground.push(fn);

  // painter relation on world footprints [x0,y0,x1,y1]: is a strictly behind b (separated on the far side of an axis)?
  const behind = (a, b, V) =>
    (V.s > 1e-6 ? a[2] <= b[0] + 0.01 : V.s < -1e-6 ? a[0] >= b[2] - 0.01 : false) ||
    (V.c > 1e-6 ? a[3] <= b[1] + 0.01 : V.c < -1e-6 ? a[1] >= b[3] - 0.01 : false);
  const bbOf = (pts) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const p of pts) { if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1]; if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1]; } return [a, b, c, d]; };
  const ovl = (A, B) => A[0] < B[2] && B[0] < A[2] && A[1] < B[3] && B[1] < A[3];
  WK.behind = behind;

  // ---------- timeline plumbing (same three seek hooks as spike-iso) ----------
  let tl, svgRoot, worldG, groundG, shadowG, staticsG, overSvg, labelsEl, W, H_, DUR;
  const TW = (target, from, to, t) => tl.fromTo(target, from, Object.assign({ immediateRender: false, lazy: false, overwrite: false }, to), t);
  const SET = (target, v, t) => tl.set(target, Object.assign({ immediateRender: false, lazy: false }, v), t);
  function go(o, v, t, d, ease) {
    const from = {}, to = {};
    for (const k in v) { from[k] = o.a[k]; to[k] = v[k]; o.a[k] = v[k]; }
    if (!d) return SET(o.s, to, t);
    return TW(o.s, from, Object.assign(to, { duration: d, ease: ease || "power3.inOut" }), t);
  }
  let dirty = false, queued = false;
  const kick = () => { dirty = true; if (!queued) { queued = true; queueMicrotask(() => { queued = false; if (dirty) WK.redraw(); }); } };
  const obj = (init) => {
    const back = Object.assign({}, init), s = {};
    for (const k in back) Object.defineProperty(s, k, { enumerable: true, get: () => back[k], set: (v) => { if (back[k] !== v) { back[k] = v; kick(); } } });
    return { s, a: Object.assign({}, init) };
  };
  WK.obj = obj; WK.go = go;
  WK.timeline = () => gsap.timeline({ paused: true, onUpdate: () => WK.redraw() });

  let camO, cam, clock, HOME;
  WK.stats = { build: [], frames: 0, sum: 0, max: 0, last: 0, movers: 0 };
  WK.init = (timeline, o) => {
    tl = timeline; overSvg = o.over; labelsEl = o.labels; W = o.W; H_ = o.H; DUR = o.dur;
    // the world lives in a shadow root on o.host: thousands of vector primitives stay out of document-level DOM walkers
    // (layout/stray checkers); theme CSS custom properties inherit through the shadow boundary.
    if (o.host) {
      const sr = o.host.attachShadow({ mode: "open" });
      sr.innerHTML = `<style>${WK.CSS}</style><svg width="${W}" height="${H_}" style="position:absolute;left:0;top:0;overflow:visible"></svg>`;
      svgRoot = sr.querySelector("svg");
    } else svgRoot = o.svg;
    svgRoot.classList.add("wk");
    svgRoot.innerHTML = `<g id="wk-world"><g id="wk-ground"></g><g id="wk-shadow"></g><g id="wk-statics"></g></g>`;
    worldG = svgRoot.firstChild; groundG = worldG.children[0]; shadowG = worldG.children[1]; staticsG = worldG.children[2];
    const proto = Object.getPrototypeOf(tl).render;
    if (typeof proto === "function") tl.render = function () { const r = proto.apply(this, arguments); WK.redraw(); return r; };
    camO = obj({ az: 45, k: 0.5, S: 1, fx: 0, fy: 0, fz: 0, sx: W / 2, sy: H_ / 2, fw: 0, fid: "" }); cam = camO.s;
    clock = obj({ t: 0 });
    TW(clock.s, { t: 0 }, { t: DUR, duration: DUR, ease: "none" }, 0);
  };
  WK.cam = (c) => { Object.assign(cam, c); Object.assign(camO.a, c); HOME = Object.assign({}, camO.a); };
  WK.camTo = (t, v, o = {}) => go(camO, v, t, o.d ?? 1.2, o.ease || "power2.inOut");
  WK.orbit = (t, az, o = {}) => go(camO, { az }, t, o.d || 3, o.ease || "sine.inOut");
  WK.home = (t, o = {}) => WK.camTo(t, { fx: HOME.fx, fy: HOME.fy, fz: HOME.fz, S: HOME.S, sx: HOME.sx, sy: HOME.sy }, o);
  // follow: blend the camera focus toward WK.track(t) (a mover's world position) with weight fw
  WK.follow = (t, w, o = {}) => go(camO, { fw: w }, t, o.d ?? 1.2, o.ease || "power2.inOut");
  WK.track = null;
  // ---------- subject focus ----------
  // WK.subjects[id] = (t) => ({ pts3: [[x,y,z]...] world hull points, fp: [x0,y0,x1,y1], kind: "static"|"mover"|"ground", st?, mover?, hi? })
  // WK.focus(id, t0, t1): camera ramps in over `ramp` before t0, holds the subject framed until t1, ramps out after t1.
  // While focused: bbox fully inside WK.focusSafe, area >= focusSafe.minFrac of the frame, everything in front of it is x-rayed
  // (ink outline only), the subject carries the --marker highlight.
  WK.subjects = {}; WK.beats = []; WK.focusSafe = null; WK.noXray = false;
  WK.focus = (id, t0, t1, o = {}) => {
    const r = o.ramp ?? 1.2;
    go(camO, { fid: id }, t0 - r, 0); go(camO, { fw: 1 }, t0 - r, r, "power2.inOut");
    go(camO, { fw: 0 }, t1, r, "power2.inOut");
    WK.beats.push({ id, t0, t1 });
  };

  // stroke widths in screen px as a function of zoom: [k, lo, hi] -> clamp(k*S, lo, hi) px
  WK.sw = { s: [2.2, 2.6, 5], sb: [1.5, 1.8, 3.4], sh: [3, 4.5, 6], sc: [1.5, 1.6, 3.4], c: [1.0, 1.2, 2.6], cc: [0.8, 1.0, 2.0], ln: [1.3, 1.5, 3.2] };

  // ---------- static build (per azimuth) ----------
  let xrOn = [], subEl = null;
  let built = null, order = [], slots = [], dynEls = [], winEls = [], lampEls = [], hiEls = [], slotCache = [];
  WK.shadowOff = 4.2;
  WK.hiFn = () => false;
  function build(V) {
    const t0 = performance.now(), S = world.statics;
    for (const st of S) {
      const out = []; st.hull = st.draw(V, out, st, 0) || []; st.svg = WK.merge(out.join("")); st.bb = st.hull.length ? bbOf(st.hull) : [0, 0, 0, 0];
      if (st.pad) { st.bb[0] -= st.pad; st.bb[1] -= st.pad; st.bb[2] += st.pad; st.bb[3] += st.pad; }
      st.depth = ((st.fp[0] + st.fp[2]) / 2) * V.s + ((st.fp[1] + st.fp[3]) / 2) * V.c;
    }
    const tA = performance.now();
    // topological painter's order over screen-overlapping pairs (Kahn, ties by depth then index)
    const n = S.length, adj = Array.from({ length: n }, () => []), indeg = new Int32Array(n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (!ovl(S[i].bb, S[j].bb)) continue;
      const ab = behind(S[i].fp, S[j].fp, V), ba = behind(S[j].fp, S[i].fp, V);
      if (ab && !ba) { adj[i].push(j); indeg[j]++; } else if (ba && !ab) { adj[j].push(i); indeg[i]++; }
    }
    const done = new Uint8Array(n), avail = []; order = [];
    for (let i = 0; i < n; i++) if (!indeg[i]) avail.push(i);
    const key = (i) => S[i].depth * 1e3 + i * 1e-6;
    while (order.length < n) {
      let pick = -1;
      if (avail.length) { let bi = 0; for (let q = 1; q < avail.length; q++) if (key(avail[q]) < key(avail[bi])) bi = q; pick = avail.splice(bi, 1)[0]; }
      else { for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || key(i) < key(pick))) pick = i; WK.stats.cycles = (WK.stats.cycles || 0) + 1; }
      done[pick] = 1; order.push(pick);
      for (const j of adj[pick]) if (!done[j] && --indeg[j] === 0) avail.push(j);
    }
    order.forEach((i, k) => (S[i].rank = k));
    const tB = performance.now();
    // ground + shadows + statics with a slot after each
    const g = []; world.ground.forEach((fn) => fn(V, g)); groundG.innerHTML = g.join("");
    const off = WK.shadowOff || 4.2;
    const shS = S.filter((st) => st.shadow !== false && !st.dyn && st.hull.length);
    shadowG.innerHTML = shS.map((st) => `<path class="fs" d="${polyD(st.hull.map((q) => [q[0] + off, q[1] + off]))}"/>`).join("");
    shS.forEach((st, k) => (st.shEl = shadowG.children[k]));
    staticsG.innerHTML = `<g class="slot"></g>` + order.map((i) => `<g>${S[i].svg}</g><g class="slot"></g>`).join("");
    const kids = staticsG.children; slots = []; for (let k = 0; k < kids.length; k += 2) slots.push(kids[k]);
    order.forEach((i, k) => (S[i].el = kids[2 * k + 1]));
    dynEls = S.filter((st) => st.dyn);
    winEls = [...staticsG.querySelectorAll("path.win")].map((el) => ({ el, p: +el.dataset.p, s: el.dataset.s, on: -1 }));
    lampEls = [...staticsG.querySelectorAll("[data-lamp]")].map((el) => ({ el, node: el.dataset.lamp, axis: el.dataset.axis, on: "" }));
    hiEls = [...worldG.querySelectorAll("[data-hi]")].map((el) => ({ el, id: el.dataset.hi, on: -1 }));
    slotCache = slots.map(() => "");
    built = { az: V.az, k: V.k };
    WK.stats.build.push(+(performance.now() - t0).toFixed(1));
    WK.stats.buildParts = { draw: +(tA - t0).toFixed(1), sort: +(tB - tA).toFixed(1), dom: +(performance.now() - tB).toFixed(1) };
    WK.stats.statics = n; WK.stats.windows = winEls.length;
  }

  // ---------- labels (DOM .lf-chip pinned to a projected world anchor) ----------
  const labels = [];
  // at: [x,y,z] or fn(t)->[x,y,z]; text: string or fn(t)->string
  WK.label = (at, text, t, o = {}) => {
    const el = document.createElement("div");
    el.className = "lf-chip wk-chip" + (o.fill ? " " + o.fill : "");
    el.textContent = typeof text === "function" ? text(t) : text;
    ["data-layout-allow-overlap", "data-layout-allow-occlusion", "data-layout-allow-overflow"].forEach((a) => el.setAttribute(a, ""));
    el.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;transform-origin:50% 100%" + (o.size ? `;font-size:${o.size}px` : "");
    labelsEl.appendChild(el);
    const L = obj({ a: 0 }); Object.assign(L, { at, text, el, dx: o.dx ?? 0, dy: o.dy ?? -110, txt: "", sub: o.sub });
    labels.push(L);
    go(L, { a: 1 }, t, 0.28, "back.out(2.2)");
    if (o.out != null) go(L, { a: 0 }, o.out, 0.18, "power2.in");
    return L;
  };

  // ---------- redraw ----------
  WK.safe = null;
  WK.winLit = () => false;
  WK.redraw = () => {
    if (!svgRoot) return;
    dirty = false;
    const t0 = performance.now(), t = clock.s.t, V = WK.view(cam.az, cam.k);
    if (!built || Math.abs(built.az - V.az) > 1e-6 || built.k !== V.k) build(V);
    // camera
    let fx = cam.fx, fy = cam.fy, fz = cam.fz;
    let S = cam.S, f = V.P(fx, fy, fz), tx = cam.sx - S * f[0], ty = cam.sy - S * f[1];
    // subject focus: blend scale toward the framing scale and the subject centre toward the safe-area centre
    let sub = null;
    if (cam.fid && cam.fw > 1e-4 && WK.subjects[cam.fid] && WK.focusSafe) {
      sub = WK.subjects[cam.fid](t); sub.id = cam.fid;
      if (sub.kind === "mover") sub.fp[4] = ((sub.fp[0] + sub.fp[2]) / 2) * V.s + ((sub.fp[1] + sub.fp[3]) / 2) * V.c;
      const pp = sub.pts3.map((q) => V.P(q[0], q[1], q[2])), b = bbOf(pp), bw = Math.max(1e-3, b[2] - b[0]), bh = Math.max(1e-3, b[3] - b[1]), sa = WK.focusSafe;
      const Sfit = Math.min((sa.x1 - sa.x0) / bw, (sa.y1 - sa.y0) / bh) * 0.92, Ssize = Math.sqrt((sa.minFrac * 1.2 * W * H_) / (bw * bh));
      const St = Math.min(Sfit, Math.max(S, Ssize)), w = cam.fw, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      const p0x = tx + S * cx, p0y = ty + S * cy, S2 = S + (St - S) * w;
      const px = p0x + ((sa.x0 + sa.x1) / 2 - p0x) * w, py = p0y + ((sa.y0 + sa.y1) / 2 - p0y) * w;
      S = S2; tx = px - S * cx; ty = py - S * cy; sub.bb = b; sub.hull = H.hull(pp);
    }
    WK.lastSubject = sub ? { id: sub.id, w: cam.fw, poly: sub.hull.map((q) => [tx + S * q[0], ty + S * q[1]]), bb: [tx + S * sub.bb[0], ty + S * sub.bb[1], tx + S * sub.bb[2], ty + S * sub.bb[3]] } : null;
    worldG.setAttribute("transform", `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${S.toFixed(4)})`);
    const st = worldG.style;
    for (const k in WK.sw) { const [a, lo, hi] = WK.sw[k]; st.setProperty("--w" + k, (Math.min(hi, Math.max(lo, a * S)) / S).toFixed(3)); }
    // live statics: dynamic geometry, window lights, signal lamps
    for (const d of dynEls) { const out = []; const hh = d.draw(V, out, d, t); d.el.innerHTML = out.join(""); if (d.bbLive && hh && hh.length) d.bb = bbOf(hh); }
    for (const w of winEls) { const on = WK.winLit(t, w.p) ? 1 : 0; if (on !== w.on) { w.on = on; w.el.setAttribute("class", `win W${w.s}${on}`); } }
    const hot = sub && cam.fw > 0.5 ? sub.hi : null;
    for (const h of hiEls) { const on = WK.hiFn(h.id, t) || h.id === hot ? 1 : 0; if (on !== h.on) { h.on = on; h.el.setAttribute("class", on ? h.el.dataset.on : h.el.dataset.off); } }
    if (world.lightFn) for (const L of lampEls) { const v = world.lightFn(L.node, L.axis, t); if (v !== L.on) { L.on = v; L.el.setAttribute("class", v === "g" ? "Lg" : "Lr"); } }
    // x-ray: statics overlapping the subject on screen and in front of it -> ink outline only; mark the subject
    for (const st of xrOn) { st.el.removeAttribute("class"); if (st.shEl) st.shEl.removeAttribute("display"); } xrOn = [];
    if (subEl) { subEl.removeAttribute("data-sub"); subEl = null; }
    if (sub) {
      if (sub.st) { subEl = sub.st.el; subEl.setAttribute("data-sub", "1"); }
      if (sub.el) { subEl = sub.el(); if (subEl) subEl.setAttribute("data-sub", "1"); }
      if (!WK.noXray) for (const st of world.statics) {
        if (st === sub.st || !ovl(st.bb, sub.bb)) continue;
        if (sub.kind === "ground" || (sub.st ? st.rank > sub.st.rank : !behind(st.fp, sub.fp, V))) { st.el.setAttribute("class", "xr"); if (st.shEl) st.shEl.setAttribute("display", "none"); xrOn.push(st); }
      }
    }
    // movers -> slots
    const list = world.movers ? world.movers(t) : [], Sst = world.statics, bySlot = new Map();
    let nv = 0; const ents = [];
    for (const m of list) {
      const c0 = V.P(m.x, m.y, 0), X = tx + S * c0[0], Y = ty + S * c0[1];
      if (X < -120 || X > W + 120 || Y < -120 || Y > H_ + 160) continue;
      m.hot = !!(sub && sub.kind === "mover" && sub.mover === m.id && cam.fw > 0.5);
      const out = [], hull = m.paint(V, out, m); const bb = bbOf(hull); bb[2] += WK.shadowOff; bb[3] += WK.shadowOff; nv++;
      let lo = -1, hi = 1e9;
      for (let k = 0; k < order.length; k++) {
        const s2 = Sst[order[k]]; if (!ovl(s2.bb, bb)) continue;
        if (behind(m.fp, s2.fp, V)) { if (k < hi) hi = k; } else if (behind(s2.fp, m.fp, V)) lo = k;
      }
      const slot = lo + 1, dpt = m.x * V.s + m.y * V.c;
      ents.push({ m, slot, dpt, bb, html: WK.merge(out.join("")) });
    }
    // x-ray movers painted after the subject (later slot, or same slot and nearer) that overlap it on screen
    const se = sub && sub.kind === "mover" ? ents.find((e) => e.m.id === sub.mover) : null;
    for (const e of ents) {
      let html = e.html;
      if (e === se) html = `<g data-sub="1">${html}</g>`;
      else if (sub && !WK.noXray && ovl(e.bb, sub.bb) && (sub.kind === "ground" || (se ? e.slot > se.slot || (e.slot === se.slot && e.dpt > se.dpt) : behind(sub.fp, e.m.fp, V)))) html = `<g class="xr">${html}</g>`;
      if (!bySlot.has(e.slot)) bySlot.set(e.slot, []);
      bySlot.get(e.slot).push([e.dpt, html]);
    }
    for (let k = 0; k < slots.length; k++) {
      const arr = bySlot.get(k), html = arr ? arr.sort((a, b) => a[0] - b[0]).map((q) => q[1]).join("") : "";
      if (html !== slotCache[k]) { slotCache[k] = html; slots[k].innerHTML = html; }
    }
    // labels
    const safe = WK.safe || { x0: 16, y0: 16, x1: W - 16, y1: H_ - 16 }, live = [];
    labels.forEach((L) => {
      const a = L.s.a;
      if (a <= 0.01 || (L.sub && !(WK.lastSubject && WK.lastSubject.id === L.sub))) { L.el.style.visibility = "hidden"; return; }
      if (typeof L.text === "function") { const s = L.text(t); if (s !== L.txt) { L.txt = s; L.el.textContent = s; } }
      let q;
      if (L.sub && WK.lastSubject && WK.lastSubject.id === L.sub) { const b = WK.lastSubject.bb; q = [(b[0] + b[2]) / 2, b[1]]; }
      else { const an = typeof L.at === "function" ? L.at(t) : L.at, q0 = V.P(an[0], an[1], an[2]); q = [tx + S * q0[0], ty + S * q0[1]]; }
      const w = L.el.offsetWidth, h = L.el.offsetHeight, b = { q, a, w, h, x: q[0] + L.dx - w / 2, y: q[1] + L.dy - h };
      b.x = Math.min(Math.max(b.x, safe.x0), safe.x1 - w - 8); b.y = Math.min(Math.max(b.y, safe.y0), safe.y1 - h - 8);
      live.push(b);
      L.el.style.visibility = "visible";
      L.el.style.transform = `translate(${r1(b.x)}px,${r1(b.y)}px) scale(${Math.max(0, a).toFixed(3)})`;
    });
    let lead = "", dots = "";
    live.filter((b) => b.a > 0.6).forEach((b) => {
      const ex = Math.min(Math.max(b.q[0], b.x + 24), b.x + b.w - 24), ey = b.q[1] < b.y ? b.y + 4 : b.y + b.h - 4;
      lead += `M${r1(b.q[0])} ${r1(b.q[1])}L${r1(ex)} ${r1(ey)}`;
      dots += `<circle cx="${r1(b.q[0])}" cy="${r1(b.q[1])}" r="7" class="fk"/>`;
    });
    overSvg.innerHTML = lead ? `<path d="${lead}" class="lead"/>` + dots : "";
    const ms = performance.now() - t0, Z = WK.stats;
    Z.frames++; Z.sum += ms; Z.last = ms; if (ms > Z.max) Z.max = ms; Z.movers = nv;
  };
  WK.camState = () => cam;
  WK.root = () => svgRoot.getRootNode();
  WK.clockT = () => clock.s.t;
  root.WK = WK;
})(typeof window !== "undefined" ? window : globalThis);
