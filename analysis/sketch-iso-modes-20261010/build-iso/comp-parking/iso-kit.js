/* runtime/iso/iso-kit.js: poster-monochrome ISOMETRIC mode (dense worlds + data-centre parts) on HLG geometry (runtime/vendor/hairline/hl-geom.js).
 * See runtime/ISO.md for the builder doc. Everything is drawn on ONE <canvas> by a pure function of the timeline clock.
 *
 * Render model (the performance strategy):
 *  - Statics (buildings, trees, lamps...) are projected once per camera azimuth (S = 1 world units), sorted in a topological painter's order
 *    and rasterised into per-static SPRITES (lazy) -> one BASE canvas (ground + shadows + statics, rebuilt only when the quantised window/lamp
 *    state changes, ISO.qdt). Pan/zoom = one drawImage with the camera transform. Live items (cars, cranes, highlights, parts) are drawn on top;
 *    the statics that stand in front of an item are re-blitted over it clipped to the item's box, so occlusion stays exact.
 *  - Zoom S > ISO.raster (default 0.8), or mid-orbit (az between rest values): everything is painted as VECTOR Path2D in painter order
 *    (cars interleaved by slot), so close-ups stay crisp. Stroke widths follow one function of S in both modes (no pop at the switch).
 *  - Focus (ISO.focus): camera frames the subject (tiered min size), occluders are x-rayed (region repaint without them + silhouette ghost).
 *  - Seek hooks: timeline onUpdate + patched tl.render + reactive state objects (HyperFrames proxies gsap.timeline()).
 *  - Colours come ONLY from theme CSS vars (paper pale deep bg shadow marker alert ink, + dot for the grid). No hex anywhere.
 */
(function (root) {
  "use strict";
  const H = root.HLG, ISO = {};
  const r1 = (n) => Math.round(n * 10) / 10;
  const ptsS = (a) => a.map((p) => r1(p[0]) + " " + r1(p[1])).join("L");
  const polyD = (a) => (a.length ? "M" + ptsS(a) + "Z" : "");
  const openD = (a) => (a.length > 1 ? "M" + ptsS(a) : "");
  Object.assign(ISO, { r1, polyD, openD });
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---------- kit CSS (injected from JS: HyperFrames compile drops extra <style> blocks) ----------
  ISO.CSS = `.iso-bg{position:absolute;inset:0;background-color:var(--bg);background-image:radial-gradient(circle at center,var(--dot) 0 2px,transparent 2.6px);background-size:40px 40px}
.iso-layer{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.iso-chip{font:400 44px/1 Anton,sans-serif;letter-spacing:.04em;color:var(--ink);background:var(--paper);border:6px solid var(--ink);border-radius:16px;box-shadow:8px 8px 0 var(--shadow);padding:12px 24px 8px;white-space:nowrap;text-transform:uppercase}
.iso-chip.marker{background:var(--marker)}.iso-chip.alert{background:var(--alert);color:var(--paper)}`;

  // ---------- seeded PRNG (mulberry32) ----------
  ISO.rng = (seed) => {
    let a = seed >>> 0 || 1;
    const f = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.range = (lo, hi) => lo + f() * (hi - lo);
    f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    return f;
  };

  // ---------- projection (S = 1, origin 0; the camera is a canvas transform) ----------
  ISO.view = (az, k) => {
    const C = H.Cam(az, k, 1); C.ox = 0; C.oy = 0;
    return { C, az, k, P: H.proj(C), front: H.facing(C), c: Math.cos(C.az), s: Math.sin(C.az) };
  };

  // ---------- solid painter (emits class-based svg strings; parsed into canvas ops) ----------
  // ring = rrect/circ samples {u,v,nu,nv}; faces: top / L side / R side as token letters p l d b k m a (paper pale deep bg ink marker alert)
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
  ISO.solid = solid;
  ISO.box = (x0, y0, x1, y1, r = 1.2, n = 2) => H.rrect(x0, y0, x1, y1, r, n);
  ISO.circ = (x, y, R, n = 16) => H.circ(R, n).map((q) => ({ u: q.u + x, v: q.v + y, nu: q.nu, nv: q.nv }));
  ISO.rot = (ring, cx, cy, hd) => { const co = Math.cos(hd), si = Math.sin(hd); return ring.map((q) => ({ u: cx + q.u * co - q.v * si, v: cy + q.u * si + q.v * co, nu: q.nu * co - q.nv * si, nv: q.nu * si + q.nv * co })); };
  // visible axis faces of box [x0,y0,x1,y1]: [{side:'L'|'R', a:[x,y], b:[x,y], len}] (a->b along the face)
  ISO.faces = (V, x0, y0, x1, y1) => {
    const out = [];
    [[1, 0, [x1, y0], [x1, y1]], [-1, 0, [x0, y1], [x0, y0]], [0, 1, [x1, y1], [x0, y1]], [0, -1, [x0, y0], [x1, y0]]].forEach(([nu, nv, a, b]) => {
      if (nu * V.s + nv * V.c <= 1e-6) return;
      out.push({ side: nu * V.c - nv * V.s < 0 ? "L" : "R", a, b, nu, nv, len: Math.hypot(b[0] - a[0], b[1] - a[1]) });
    });
    return out;
  };
  // window grid on the visible faces: groups lit independently (class "win", state from ISO.winLit(t, phase))
  ISO.windows = (V, x0, y0, x1, y1, z0, z1, o) => {
    const { P } = V, rng = o.rng, G = o.groups || 3, cw = o.cw || 7, rh = o.rh || 9, ww = o.ww || 3.6, wh = o.wh || 5, m = o.m || 3;
    let svg = "";
    ISO.faces(V, x0, y0, x1, y1).forEach((F) => {
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
      d.forEach((dd, g) => { if (dd) svg += `<path class="win" data-s="${F.side}" data-p="${(o.phase + g * 0.137) % 1}" d="${dd}"/>`; });
    });
    return svg;
  };
  // run-length merge of consecutive <path class="X" d=".."/> with the same class (painter's order untouched)
  ISO.merge = (svg) => {
    const re = /<path class="([\w ]+)" d="([^"]*)"\/>/y, out = []; let i = 0, cur = null, d = "";
    const flush = () => { if (cur) out.push(`<path class="${cur}" d="${d}"/>`); cur = null; d = ""; };
    while (i < svg.length) {
      re.lastIndex = i; const m = re.exec(svg);
      if (m) { if (m[1] === cur) d += m[2]; else { flush(); cur = m[1]; d = m[2]; } i = re.lastIndex; continue; }
      flush(); const j = svg.indexOf("/>", i), k = svg.indexOf("<", i + 1), e = j >= 0 && (k < 0 || j < k) ? j + 2 : k < 0 ? svg.length : k; out.push(svg.slice(i, e)); i = e;
    }
    flush(); return out.join("");
  };

  // ---------- svg strings -> canvas ops ----------
  // class -> paint. f/s = fill/stroke token, w = fixed stroke (world units) | "F" seam hairline, k = width kind from ISO.sw
  const STY = {
    Fp: { f: "paper", s: "paper", w: "F" }, Fl: { f: "pale", s: "pale", w: "F" }, Fd: { f: "deep", s: "deep", w: "F" }, Fb: { f: "bg", s: "bg", w: "F" },
    Fk: { f: "ink", s: "ink", w: "F" }, Fm: { f: "marker", s: "marker", w: "F" }, Fa: { f: "alert", s: "alert", w: "F" },
    fp: { f: "paper" }, fb: { f: "bg" }, fk: { f: "ink" }, fs: { f: "shadow" },
    s: { s: "ink", k: "s" }, sb: { s: "ink", k: "sb" }, sh: { s: "ink", k: "sh" }, sc: { s: "ink", k: "sc" },
    c: { s: "ink", k: "c", cap: "round" }, cc: { s: "ink", k: "cc", cap: "round" }, ln: { s: "ink", k: "ln", cap: "round" },
    mkd: { s: "paper", w: 1.3, dash: [7, 7] }, mks: { s: "paper", w: 1.3, cap: "round" },
    Lg: { f: "paper", s: "ink", w: 0.6 }, Lr: { f: "alert", s: "ink", w: 0.6 },
    arm0: { s: "ink", w: 2.8, cap: "round" }, arm1: { s: "paper", w: 1.5, cap: "round" }, arm2: { s: "ink", w: 1.5 },
    hbm: { f: "marker", s: "ink", k: "c" }, dotm: { f: "marker", s: "ink", k: "cc" }
  };
  // stroke width on screen (px) as a function of zoom S; below ISO.raster it scales with S (LOD), above it is clamped (poster-thick in close-ups)
  ISO.sw = { s: [3.8, 3, 6], sb: [2.8, 2.2, 5], sh: [5, 4, 7], sc: [3, 2, 5], c: [2, 1.5, 3], cc: [1.5, 1.1, 2.6], ln: [2.2, 1.7, 3.6] };
  let R = 0.8, rasterFixed = false; // raster threshold zoom (default: 1.15 x the home/wide-shot zoom, set by ISO.cam)
  const wpx = (kind, S) => { const [a, lo, hi] = ISO.sw[kind]; return S <= R ? (clamp(a * R, lo, hi) * S) / R : clamp(a * S, lo, hi); };
  const widths = (S) => { const F = { S, F: Math.max(0.35, 0.75 / S) }; for (const k in ISO.sw) F[k] = wpx(k, S) / S; return F; };
  let T = null; // resolved theme tokens
  const tokens = () => {
    if (T) return T; const cs = getComputedStyle(document.documentElement); T = {};
    ["paper", "pale", "deep", "bg", "shadow", "marker", "alert", "ink", "dot"].forEach((k) => (T[k] = cs.getPropertyValue("--" + k).trim() || "#f0f"));
    return T;
  };
  const NUM = /-?\d+(?:\.\d+)?/g;
  function parseOps(svg) {
    const ops = [], re = /<(path|circle)\b([^>]*?)\/>/g; let m;
    while ((m = re.exec(svg))) {
      const a = {}; m[2].replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => { a[k] = v; });
      const o = { c: (a.class || "").replace(/^win .*/, "win") };
      if (m[1] === "path") {
        if (!a.d) continue;
        o.p = new Path2D(a.d); if (a["fill-rule"] === "evenodd") o.eo = 1;
        const n = a.d.match(NUM) || []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (let i = 0; i + 1 < n.length; i += 2) { const x = +n[i], y = +n[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        o.bb = [x0, y0, x1, y1];
      } else {
        const cx = +a.cx, cy = +a.cy, r = +a.r; o.p = new Path2D(); o.p.arc(cx, cy, r, 0, Math.PI * 2); o.bb = [cx - r, cy - r, cx + r, cy + r];
      }
      if (o.c === "win") { o.side = a["data-s"]; o.ph = +a["data-p"]; }
      if (a["data-lamp"]) o.lamp = [a["data-lamp"], a["data-axis"]];
      if (a["data-hi"]) { o.hi = a["data-hi"]; o.dyn = 1; }
      ops.push(o);
    }
    return ops;
  }
  ISO.parseOps = parseOps;
  const unionBB = (ops) => { let b = [1e9, 1e9, -1e9, -1e9]; for (const o of ops) if (o.bb && o.c) { if (o.bb[0] < b[0]) b[0] = o.bb[0]; if (o.bb[1] < b[1]) b[1] = o.bb[1]; if (o.bb[2] > b[2]) b[2] = o.bb[2]; if (o.bb[3] > b[3]) b[3] = o.bb[3]; } return b; };
  function paintSty(c, sty, o, F) {
    if (sty.f) { c.fillStyle = T[sty.f]; c.fill(o.p, o.eo ? "evenodd" : "nonzero"); }
    if (sty.s) {
      c.strokeStyle = T[sty.s]; c.lineWidth = sty.w === "F" ? F.F : sty.w != null ? sty.w : F[sty.k];
      c.lineCap = sty.cap || "butt"; c.lineJoin = "round";
      if (sty.dash) c.setLineDash(sty.dash);
      c.stroke(o.p);
      if (sty.dash) c.setLineDash([]);
    }
  }
  // live=true: evaluate window / lamp state at quantised time qt; false (sprite bake): windows dark, lamps skipped
  function paintOp(c, o, F, qt, live) {
    const cls = o.c;
    if (cls === "win") { c.fillStyle = live && ISO.winLit(qt, o.ph) ? T.paper : o.side === "L" ? T.bg : T.ink; c.fill(o.p); return; }
    if (o.lamp) { if (live) paintSty(c, world.lightFn && world.lightFn(o.lamp[0], o.lamp[1], qt) === "g" ? STY.Lg : STY.Lr, o, F); return; }
    const sty = STY[cls]; if (sty) paintSty(c, sty, o, F);
  }
  const paintOps = (c, ops, F, qt, live) => { for (let i = 0; i < ops.length; i++) paintOp(c, ops[i], F, qt, live); };

  // ---------- world registry ----------
  const world = { statics: [], ground: [], movers: null, lightFn: null };
  ISO.world = world;
  // st: {fp:[x0,y0,x1,y1], draw(V,out,st,t) -> hull, shadow (default true), dyn (redraw each frame), bbLive, pad}
  ISO.addStatic = (st) => { st.idx = world.statics.length; world.statics.push(st); return st; };
  ISO.addGround = (fn) => world.ground.push(fn);
  // painter relation on world footprints [x0,y0,x1,y1]: is a strictly behind b (separated on the far side of an axis)?
  const behind = (a, b, V) =>
    (V.s > 1e-6 ? a[2] <= b[0] + 0.01 : V.s < -1e-6 ? a[0] >= b[2] - 0.01 : false) ||
    (V.c > 1e-6 ? a[3] <= b[1] + 0.01 : V.c < -1e-6 ? a[1] >= b[3] - 0.01 : false);
  const bbOf = (pts) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const p of pts) { if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1]; if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1]; } return [a, b, c, d]; };
  const ovl = (A, B) => A[0] < B[2] && B[0] < A[2] && A[1] < B[3] && B[1] < A[3];
  ISO.behind = behind;
  const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
  ISO.inPoly = inPoly;

  // ---------- timeline plumbing ----------
  let tl, cv, ctx, labelsEl, W, H_, DUR, dpr = 1, camO, cam, clock, HOME;
  const restAz = [];
  const TW = (target, from, to, t) => tl.fromTo(target, from, Object.assign({ immediateRender: false, lazy: false, overwrite: false }, to), t);
  const SET = (target, v, t) => tl.set(target, Object.assign({ immediateRender: false, lazy: false }, v), t);
  function go(o, v, t, d, ease) {
    const from = {}, to = {};
    for (const k in v) { from[k] = o.a[k]; to[k] = v[k]; o.a[k] = v[k]; }
    if (!d) return SET(o.s, to, t);
    return TW(o.s, from, Object.assign(to, { duration: d, ease: ease || "power3.inOut" }), t);
  }
  let dirty = false, queued = false;
  const kick = () => { dirty = true; if (!queued) { queued = true; queueMicrotask(() => { queued = false; if (dirty) ISO.redraw(); }); } };
  const obj = (init) => {
    const back = Object.assign({}, init), s = {};
    for (const k in back) Object.defineProperty(s, k, { enumerable: true, get: () => back[k], set: (v) => { if (back[k] !== v) { back[k] = v; kick(); } } });
    return { s, a: Object.assign({}, init) };
  };
  ISO.obj = obj; ISO.go = go;
  ISO.timeline = () => gsap.timeline({ paused: true, onUpdate: () => ISO.redraw() });
  ISO.stats = { build: [], frames: 0, sum: 0, max: 0, last: 0, movers: 0, raster: 0, vector: 0 };
  ISO.qdt = 0.25;           // window/lamp state quantum (s)
  ISO.winLit = () => false; // (t, phase) -> bool
  ISO.hiFn = () => false;   // (hiId, t) -> bool; the marker normally comes only from the focused subject
  ISO.shadowOff = 4.2;
  ISO.noXray = false;
  ISO.safe = null;          // label clamp rect
  ISO.focusSafe = null;     // {x0,y0,x1,y1}: where a focused subject must land (outside the puppet zone)
  ISO.minFrac = { large: [0.06, 0.08], small: [0.015, 0.02] }; // [LF, reel] min bbox area / frame by subject tier

  // o: {host: element that receives the canvas, labels: chip layer element, W, H, dur, raster?}
  ISO.init = (timeline, o) => {
    tl = timeline; labelsEl = o.labels; W = o.W; H_ = o.H; DUR = o.dur; if (o.raster) { R = o.raster; rasterFixed = true; }
    const st = document.createElement("style"); st.textContent = ISO.CSS; document.head.appendChild(st);
    if (/noxray/.test(root.location ? root.location.search : "")) ISO.noXray = true; // debug: ?noxray shows what the camera alone gives
    dpr = Math.min(2, root.devicePixelRatio || 1);
    cv = document.createElement("canvas"); cv.width = W * dpr; cv.height = H_ * dpr;
    cv.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H_}px`;
    o.host.appendChild(cv); ctx = cv.getContext("2d");
    const proto = Object.getPrototypeOf(tl).render;
    if (typeof proto === "function") tl.render = function () { const r = proto.apply(this, arguments); ISO.redraw(); return r; };
    camO = obj({ az: 45, k: 0.5, S: 1, fx: 0, fy: 0, fz: 0, sx: W / 2, sy: H_ / 2 }); cam = camO.s;
    clock = obj({ t: 0 });
    TW(clock.s, { t: 0 }, { t: DUR, duration: DUR, ease: "none" }, 0);
  };
  // ---------- camera verbs (t = absolute timeline seconds) ----------
  ISO.cam = (c) => { Object.assign(cam, c); Object.assign(camO.a, c); HOME = Object.assign({}, camO.a); restAz.push(cam.az); if (!rasterFixed) R = Math.max(0.4, HOME.S * 1.15); };
  ISO.camTo = (t, v, o = {}) => go(camO, v, t, o.d ?? 1.2, o.ease || "power2.inOut");
  ISO.orbit = (t, az, o = {}) => { restAz.push(az); return go(camO, { az }, t, o.d || 3, o.ease || "sine.inOut"); };
  ISO.home = (t, o = {}) => ISO.camTo(t, Object.assign({ fx: HOME.fx, fy: HOME.fy, fz: HOME.fz, S: HOME.S, sx: HOME.sx, sy: HOME.sy }, o.az != null ? { az: o.az } : {}), o);
  ISO.zoomTo = (p, t, o = {}) => { const c = Array.isArray(p) ? p : p.center(); return ISO.camTo(t, { fx: c[0], fy: c[1], fz: c[2], S: o.S || cam.S * 1.8, sx: o.sx ?? W * 0.42, sy: o.sy ?? H_ * 0.55 }, o); };
  // ---------- subject focus ----------
  // ISO.subjects[id] = (t) => ({ pts3: [[x,y,z]...], fp: [x0,y0,x1,y1], kind: "static"|"mover"|"ground"|"part", tier?: "large"|"small", st?, mover?, hi? })
  // ISO.focus(id, t0, t1): camera ramps in before t0, holds the subject framed until t1, ramps out after. While focused: bbox inside ISO.focusSafe,
  // bbox area >= ISO.minFrac[tier], statics/movers in front of it are x-rayed (silhouette ghost), the subject carries the --marker highlight.
  ISO.subjects = {}; ISO.beats = [];
  ISO.focus = (id, t0, t1, o = {}) => { ISO.beats.push({ id, t0, t1, r: o.ramp ?? 1.2 }); };
  // focus weight is a pure function of t (not tweens): overlapping windows cannot fight, any seek order gives the same frame
  const ease2 = (p) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p));
  function focusAt(t) {
    let id = "", w = 0;
    for (const b of ISO.beats) { const wi = ease2(clamp((t - (b.t0 - b.r)) / b.r, 0, 1)) * ease2(1 - clamp((t - b.t1) / b.r, 0, 1)); if (wi > w) { w = wi; id = b.id; } }
    return [id, w];
  }
  ISO.camState = () => cam;
  ISO.clockT = () => clock.s.t;

  // ---------- static build (per azimuth) ----------
  let built = null, order = [], dynSt = [], under = null, base = null, hiIdx = {}, gHi = [], groundOps = [];
  function build(V) {
    const t0 = performance.now(), S = world.statics;
    for (const st of S) {
      const out = []; st.hull = st.draw(V, out, st, 0) || []; st.ops = parseOps(ISO.merge(out.join("")));
      st.bb = st.hull.length ? bbOf(st.hull) : [0, 0, 0, 0];
      if (st.pad) { st.bb[0] -= st.pad; st.bb[1] -= st.pad; st.bb[2] += st.pad; st.bb[3] += st.pad; }
      st.depth = ((st.fp[0] + st.fp[2]) / 2) * V.s + ((st.fp[1] + st.fp[3]) / 2) * V.c;
      st.spr = null; st.hullP = null;
      st.hiOps = st.ops.filter((o) => o.hi); st.live = st.ops.filter((o) => o.c === "win" || o.lamp);
      st.shP = st.shadow !== false && !st.dyn && st.hull.length ? new Path2D(polyD(st.hull.map((q) => [q[0] + ISO.shadowOff, q[1] + ISO.shadowOff]))) : null;
    }
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
      else { for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || key(i) < key(pick))) pick = i; ISO.stats.cycles = (ISO.stats.cycles || 0) + 1; }
      done[pick] = 1; order.push(pick);
      for (const j of adj[pick]) if (!done[j] && --indeg[j] === 0) avail.push(j);
    }
    order.forEach((i, k) => (S[i].rank = k));
    dynSt = S.filter((st) => st.dyn);
    const g = []; world.ground.forEach((fn) => fn(V, g));
    const gops = parseOps(ISO.merge(g.join(""))); groundOps = gops.filter((o) => !o.hi); gHi = gops.filter((o) => o.hi);
    hiIdx = {}; S.forEach((st) => st.hiOps.forEach((o) => { (hiIdx[o.hi] = hiIdx[o.hi] || []).push({ st, o }); }));
    gHi.forEach((o) => { (hiIdx[o.hi] = hiIdx[o.hi] || []).push({ st: null, o }); });
    under = null; base = null;
    built = { az: V.az, k: V.k };
    ISO.stats.build.push(+(performance.now() - t0).toFixed(1)); ISO.stats.statics = n;
  }
  // world extents (S = 1 units) for the raster canvases
  function worldBB() {
    const b = unionBB(groundOps);
    for (const st of world.statics) { const q = unionBB(st.ops); for (let i = 0; i < 2; i++) { b[i] = Math.min(b[i], q[i], st.bb[i]); b[i + 2] = Math.max(b[i + 2], q[i + 2], st.bb[i + 2] + ISO.shadowOff); } }
    return b;
  }
  function mkCanvas(x0, y0, x1, y1, sc) {
    const X0 = Math.floor(x0 * sc) / sc, Y0 = Math.floor(y0 * sc) / sc, c = document.createElement("canvas");
    c.width = Math.ceil((x1 - X0) * sc) + 1; c.height = Math.ceil((y1 - Y0) * sc) + 1;
    const c2 = c.getContext("2d"); c2.setTransform(sc, 0, 0, sc, -X0 * sc, -Y0 * sc);
    return { cv: c, c2, x0: X0, y0: Y0, w: c.width / sc, h: c.height / sc, sc };
  }
  function ensureUnder() {
    if (under) return under;
    const sc = R * dpr, b = worldBB(), F = widths(R); under = mkCanvas(b[0] - 2, b[1] - 2, b[2] + 2, b[3] + 2, sc);
    paintOps(under.c2, groundOps, F, 0, false);
    under.c2.fillStyle = T.shadow; for (const st of world.statics) if (st.shP) under.c2.fill(st.shP);
    return under;
  }
  function sprite(st) {
    if (st.spr) return st.spr;
    const sc = R * dpr, b = unionBB(st.ops); if (b[0] > b[2]) { st.spr = { none: 1 }; return st.spr; }
    const s = mkCanvas(b[0] - 3, b[1] - 3, b[2] + 3, b[3] + 3, sc);
    paintOps(s.c2, st.ops, widths(R), 0, false);
    return (st.spr = s);
  }
  // draw static st (sprite + live windows/lamps) under the current transform of c
  function blit(c, st, F, qt) {
    const s = sprite(st); if (s.none) return;
    c.drawImage(s.cv, s.x0, s.y0, s.w, s.h);
    for (const o of st.live) { if (o.c === "win") { if (ISO.winLit(qt, o.ph)) { c.fillStyle = T.paper; c.fill(o.p); } } else paintOp(c, o, F, qt, true); }
  }
  let baseKey = "";
  function ensureBase(qt) {
    const key = built.az + ":" + qt; if (base && baseKey === key) return base;
    if (!base) { const b = worldBB(); base = mkCanvas(b[0] - 2, b[1] - 2, b[2] + 2, b[3] + 2, R * dpr); }
    const u = ensureUnder(), c = base.c2, F = widths(R);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, base.cv.width, base.cv.height); c.restore();
    c.drawImage(u.cv, u.x0, u.y0, u.w, u.h);
    for (const i of order) { const st = world.statics[i]; if (!st.dyn) blit(c, st, F, qt); }
    baseKey = key; return base;
  }

  // ---------- labels (DOM .iso-chip pinned to a projected world anchor or the focused subject) ----------
  const labels = [];
  // at: [x,y,z] | fn(t)->[x,y,z] | null (with o.sub = subject id); text: string | fn(t)->string
  ISO.label = (at, text, t, o = {}) => {
    const el = document.createElement("div");
    el.className = "iso-chip" + (o.fill ? " " + o.fill : "");
    el.textContent = typeof text === "function" ? text(t) : text;
    ["data-layout-allow-overlap", "data-layout-allow-occlusion", "data-layout-allow-overflow"].forEach((a) => el.setAttribute(a, ""));
    el.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;transform-origin:50% 100%" + (o.size ? `;font-size:${o.size}px` : "");
    labelsEl.appendChild(el);
    const L = obj({ a: 0 }); Object.assign(L, { at, text, el, dx: o.dx ?? 0, dy: o.dy ?? -110, txt: "", sub: o.sub, part: o.part });
    labels.push(L);
    go(L, { a: 1 }, t, 0.28, "back.out(2.2)");
    if (o.out != null) go(L, { a: 0 }, o.out, 0.18, "power2.in");
    return L;
  };

  // ---------- parts (data-centre / diagram objects): live items drawn above the world ----------
  const parts = [], links = []; let FLOOR_Z = 0, hiPart = null;
  const TL = { paper: "p", pale: "l", deep: "d", bg: "b", ink: "k", marker: "m", alert: "a" };
  const tk = (n) => TL[n] || n || "p";
  function part(kind, o, draw) {
    const p = obj({ on: o.on ?? 0, lift: 0, grow: 1, ex: 0, hi: 0 });
    Object.assign(p, { kind, o, draw, layer: o.layer ?? 2, id: o.id || kind + parts.length });
    p.base = () => (o.parent ? o.parent.top() : FLOOR_Z + (o.z || 0)) + p.s.lift + p.s.ex;
    p.top = () => p.base() + o.h * p.s.grow;
    p.center = () => [o.x, o.y, p.base() + (o.h * p.s.grow) / 2];
    p.anchor = () => [o.x, o.y, p.top()];
    parts.push(p); return p;
  }
  const foot = (o) => H.rrect(o.x - o.w / 2, o.y - o.d / 2, o.x + o.w / 2, o.y + o.d / 2, o.r ?? 4, 4);
  const hiTop = (p, dflt) => (p.s.hi === 1 ? "m" : p.s.hi === 2 ? "a" : tk(dflt));
  function faceLines(V, x0, y0, x1, y1, zs, m) {
    const { P, front } = V; let d = "";
    [[1, 0, x1, null], [-1, 0, x0, null], [0, 1, null, y1], [0, -1, null, y0]].forEach(([nu, nv, X, Y]) => {
      if (!front({ nu, nv })) return;
      zs.forEach((z) => { const a = X != null ? P(X, y0 + m, z) : P(x0 + m, Y, z), b = X != null ? P(X, y1 - m, z) : P(x1 - m, Y, z); d += `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`; });
    });
    return d;
  }
  function faceDots(V, x0, y0, x1, y1, zs, m, r) {
    const { P, front } = V; let out = "";
    [[1, 0, x1, null], [0, 1, null, y1], [-1, 0, x0, null], [0, -1, null, y0]].forEach(([nu, nv, X, Y]) => {
      if (!front({ nu, nv })) return;
      zs.forEach((z) => { const q = X != null ? P(X, y1 - m, z) : P(x1 - m, Y, z); out += `<circle class="dotm" cx="${r1(q[0])}" cy="${r1(q[1])}" r="${r}"/>`; });
    });
    return out;
  }
  // I.floor({x,y,w,d,h,r?,top?}) : base slab (layer 0). Other parts sit on its top.
  ISO.floor = (o) => { FLOOR_Z = o.h; const p = part("floor", Object.assign({ layer: 0, z: -o.h, on: 1 }, o), (V, out, p) => {
    const ring = H.rrect(o.x - o.w / 2, o.y - o.d / 2, o.x + o.w / 2, o.y + o.d / 2, o.r ?? 16, 6), lip = H.rrect(o.x - o.w / 2 + 10, o.y - o.d / 2 + 10, o.x + o.w / 2 - 10, o.y + o.d / 2 - 10, Math.max(1, (o.r ?? 16) - 10), 6);
    return solid(V, out, ring, p.base(), p.top(), { top: tk(o.top || "pale"), L: "p", R: "d", lip });
  }); p.base = () => p.s.lift; p.top = () => o.h * p.s.grow; return p; };
  ISO.block = (o) => part("box", o, (V, out, p) => solid(V, out, foot(o), p.base(), p.top(), { top: hiTop(p, o.top), L: o.L && tk(o.L), R: o.R && tk(o.R),
    lip: o.lip ? H.rrect(o.x - o.w / 2 + o.lip, o.y - o.d / 2 + o.lip, o.x + o.w / 2 - o.lip, o.y + o.d / 2 - o.lip, Math.max(0.5, (o.r ?? 4) - o.lip), 4) : null }));
  ISO.tower = (o) => part("tower", o, (V, out, p) => {
    const z0 = p.base(), z1 = p.top(), zs = []; for (let z = z0 + (o.band || 22); z < z1 - 8; z += o.band || 22) zs.push(z);
    return solid(V, out, foot(o), z0, z1, { top: hiTop(p), cr: faceLines(V, o.x - o.w / 2, o.y - o.d / 2, o.x + o.w / 2, o.y + o.d / 2, zs, 0) });
  });
  ISO.cyl = (o) => part("cyl", o, (V, out, p) => {
    const ring = ISO.circ(o.x, o.y, o.R, 48), z0 = p.base(), z1 = p.top(); let cr = "";
    (o.bands || []).forEach((f) => { const z = z0 + (z1 - z0) * f; if (z1 - z0 > 4) cr += openD(H.ringAt(V.P, H.run(ring, V.front), z)); });
    return solid(V, out, ring, z0, z1, { top: hiTop(p), cr, lip: ISO.circ(o.x, o.y, o.R * 0.62, 36) });
  });
  // server rack: n units, vent lines + marker LEDs on the visible faces
  ISO.rack = (o) => part("rack", o, (V, out, p) => {
    const z0 = p.base(), z1 = p.top(), zs = [], dz = [], u = (z1 - z0) / (o.units || 6);
    for (let k = 1; k < (o.units || 6); k++) zs.push(z0 + k * u);
    if (z1 - z0 > 20) for (let k = 0; k < (o.units || 6); k++) dz.push(z0 + k * u + u / 2);
    const x0 = o.x - o.w / 2, y0 = o.y - o.d / 2, x1 = o.x + o.w / 2, y1 = o.y + o.d / 2;
    return solid(V, out, foot(o), z0, z1, { top: hiTop(p), cr: faceLines(V, x0, y0, x1, y1, zs, 3), extra: faceDots(V, x0, y0, x1, y1, dz, 7, 4.5) });
  });
  // layer stack: n thin slabs; ISO.explode(stack, t, gap) parts them along z
  ISO.stack = (o) => {
    const st = obj({ gap: 0 }); st.layers = []; st.o = o;
    for (let i = 0; i < o.n; i++) {
      const lo = Object.assign({}, o, { h: o.lh, z: (o.z || 0) + i * o.lh, id: (o.id || "stack") + "-L" + i, layer: 2 });
      const L = part("layer", lo, (V, out, p) => solid(V, out, foot(lo), p.base(), p.top(), { top: hiTop(p, (o.tops && o.tops[i]) || "paper"),
        lip: H.rrect(lo.x - lo.w / 2 + 5, lo.y - lo.d / 2 + 5, lo.x + lo.w / 2 - 5, lo.y + lo.d / 2 - 5, Math.max(0.5, (lo.r ?? 4) - 5), 4) }));
      L.base = () => FLOOR_Z + lo.z + L.s.lift + i * st.s.gap; L.idx = i; L.stack = st; st.layers.push(L);
    }
    st.top = () => st.layers[o.n - 1].top();
    st.center = () => [o.x, o.y, (st.layers[0].base() + st.top()) / 2];
    st.anchor = () => [o.x, o.y, st.top()];
    return st;
  };
  // chip: package slab + die + pins, on a parent part (o.parent) or the floor
  ISO.chip = (o) => part("chip", o, (V, out, p) => {
    const z0 = p.base(), z1 = p.top(), { P } = V, x0 = o.x - o.w / 2, y0 = o.y - o.d / 2, x1 = o.x + o.w / 2, y1 = o.y + o.d / 2;
    let pins = ""; const np = o.pins || 5, pl = o.pinLen || 7;
    for (let k = 0; k < np; k++) {
      const fx = x0 + ((k + 0.5) / np) * o.w, fy = y0 + ((k + 0.5) / np) * o.d;
      [[fx, y1, fx, y1 + pl], [x1, fy, x1 + pl, fy], [fx, y0, fx, y0 - pl], [x0, fy, x0 - pl, fy]].forEach(([a, b, c2, d2]) => { const A = P(a, b, z0 + 1), B = P(c2, d2, z0 + 1); pins += `M${r1(A[0])} ${r1(A[1])}L${r1(B[0])} ${r1(B[1])}`; });
    }
    out.push(`<path class="ln" d="${pins}"/>`);
    const hull = solid(V, out, foot(o), z0, z1, { top: "p" });
    const dw = o.w * 0.5, dd = o.d * 0.5;
    solid(V, out, H.rrect(o.x - dw / 2, o.y - dd / 2, o.x + dw / 2, o.y + dd / 2, 2, 3), z1, z1 + (o.dieH || 3) * p.s.grow, { top: hiTop(p, o.dieTop === "ink" ? "ink" : "paper"), sil: "sc" });
    return hull;
  });
  // link: floor ribbon along world polyline pts [[x,y],...]; state draw (0..1 reveal), ph (dot phase), dots (0/1)
  ISO.link = (o) => { const l = obj({ draw: 0, ph: 0, dots: 0, dir: 1 }); l.o = o; l.kind = "link"; links.push(l); return l; };
  ISO.drawLink = (l, t, o = {}) => go(l, { draw: 1 }, t, o.d || 0.6, "power2.inOut");
  ISO.flow = (l, t, dur, o = {}) => {
    go(l, { dir: o.dir || 1, dots: 1 }, t, 0); go(l, { ph: 0 }, t, 0);
    go(l, { ph: o.laps || dur / 1.6 }, t, dur, "none"); go(l, { dots: 0 }, t + dur, 0);
    l.n = o.n || l.n || 3;
  };
  const tgt = (p) => (p.layers ? p.layers : [p]);
  ISO.show = (p, t) => tgt(p).forEach((q) => go(q, { on: 1 }, t, 0));
  ISO.hide = (p, t) => tgt(p).forEach((q) => go(q, { on: 0 }, t, 0));
  ISO.rise = (p, t, o = {}) => tgt(p).forEach((q, i) => { const ti = t + i * (o.stagger || 0.08); go(q, { on: 1, lift: o.from || 420 }, ti, 0); go(q, { lift: 0 }, ti, o.d || 0.55, "bounce.out"); });
  ISO.extrude = (p, t, o = {}) => tgt(p).forEach((q) => { go(q, { on: 1, grow: 0.001 }, t, 0); go(q, { grow: 1 }, t, o.d || 0.8, o.ease || "power2.out"); });
  ISO.explode = (st, t, gap, o = {}) => go(st, { gap }, t, o.d || 0.9, o.ease || (gap ? "back.out(1.4)" : "power3.inOut"));
  // one hi part at a time: mode "marker" | "alert" | null
  ISO.hi = (p, t, mode) => {
    const v = mode === "alert" ? 2 : mode ? 1 : 0;
    if (v && hiPart && hiPart !== p) go(hiPart, { hi: 0 }, t, 0);
    go(p, { hi: v }, t, 0); hiPart = v ? p : (hiPart === p ? null : hiPart);
  };
  // subject provider for a part (focus + marker): ISO.subjects.rack = ISO.partSubject(rack)
  ISO.partSubject = (p) => () => {
    const o = p.o || p.layers[0].o, z0 = p.base ? p.base() : p.layers[0].base(), z1 = p.top(), pts3 = [];
    [z0, z1].forEach((z) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => pts3.push([o.x + (a * o.w) / 2, o.y + (b * o.d) / 2, z])));
    return { kind: "part", tier: "large", part: p, pts3, fp: [o.x - o.w / 2, o.y - o.d / 2, o.x + o.w / 2, o.y + o.d / 2] };
  };
  function trimPoly(pts, f) {
    if (f >= 1) return pts; const segs = []; let tot = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); tot += l; }
    let rem = tot * f; const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) { const l = segs[i - 1]; if (rem >= l) { out.push(pts[i]); rem -= l; } else { const u = l ? rem / l : 0; out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]); break; } }
    return out;
  }
  function along(pts, f) {
    const segs = []; let tot = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); tot += l; }
    let rem = tot * f;
    for (let i = 1; i < pts.length; i++) { const l = segs[i - 1]; if (rem <= l) { const u = l ? rem / l : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]; } rem -= l; }
    return pts[pts.length - 1];
  }
  // draws floor, links, shadows, parts (back to front) under the current world transform
  function paintParts(V, F, qt) {
    const vis = parts.filter((p) => p.s.on > 0.5), dep = (p) => p.o.x * V.s + p.o.y * V.c;
    if (!vis.length && !links.length) return;
    vis.sort((a, b) => a.layer - b.layer || Math.round(dep(a)) - Math.round(dep(b)) || a.base() - b.base());
    const bufs = [], shad = [], fz = FLOOR_Z + 0.5;
    vis.forEach((p) => {
      const out = [], hull = p.draw(V, out, p), ops = parseOps(ISO.merge(out.join("")));
      if (p.layer !== 0 && p.o.shadow !== false && !(p.stack && p.idx > 0) && hull && hull.length) {
        const k = 1 / (1 + Math.max(0, p.s.lift + p.s.ex) / 160), off = 6 * k, cx = hull.reduce((a, q) => a + q[0], 0) / hull.length, cy = hull.reduce((a, q) => a + q[1], 0) / hull.length;
        const lp = (p.s.lift + p.s.ex) * Math.sqrt(1 - V.C.k * V.C.k);
        shad.push(new Path2D(polyD(hull.map((q) => [cx + (q[0] - cx) * k + off, cy + lp + (q[1] - cy) * k + off]))));
      }
      bufs.push({ p, ops });
    });
    bufs.filter((b) => b.p.layer === 0).forEach((b) => paintOps(ctx, b.ops, F, qt, false));
    links.forEach((l) => {
      if (l.s.draw <= 0.001) return;
      const pts = l.o.pts.map((q) => V.P(q[0], q[1], fz)), tp = trimPoly(pts, l.s.draw), pth = new Path2D(openD(tp)), w = (l.o.w || 14) * 0.55;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = T.ink; ctx.lineWidth = w + 2.4 * F.c; ctx.stroke(pth);
      ctx.strokeStyle = T[l.o.fill || "paper"]; ctx.lineWidth = w; ctx.stroke(pth);
      if (l.s.dots > 0.5) {
        const n = l.n || 3, rr = l.o.dot || 8;
        for (let i = 0; i < n; i++) {
          let f = (l.s.ph + i / n) % 1; if (l.s.dir < 0) f = 1 - f;
          const q = along(pts, f); ctx.beginPath(); ctx.ellipse(q[0], q[1], rr, rr * V.k, 0, 0, Math.PI * 2);
          ctx.fillStyle = T[l.o.dotFill || "marker"]; ctx.fill(); ctx.strokeStyle = T.ink; ctx.lineWidth = F.c * 1.4; ctx.stroke();
        }
      }
    });
    ctx.fillStyle = T.shadow; shad.forEach((s) => ctx.fill(s));
    bufs.filter((b) => b.p.layer !== 0).forEach((b) => paintOps(ctx, b.ops, F, qt, false));
  }

  // ---------- redraw ----------
  ISO.frame = null; ISO.lastSubject = null; ISO.mode = "";
  const ghost = (pth, F) => { ctx.strokeStyle = T.ink; ctx.lineWidth = F.cc; ctx.lineJoin = "round"; ctx.stroke(pth); };
  ISO.redraw = () => {
    if (!ctx) return;
    dirty = false;
    const tA = performance.now(), t = clock.s.t, qt = Math.floor(t / ISO.qdt + 1e-9) * ISO.qdt; tokens();
    const V = ISO.view(cam.az, cam.k), hasW = world.statics.length > 0;
    if (hasW && (!built || Math.abs(built.az - V.az) > 1e-6 || built.k !== V.k)) build(V);
    // camera
    const S0 = cam.S; let S = S0, f = V.P(cam.fx, cam.fy, cam.fz), tx = cam.sx - S * f[0], ty = cam.sy - S * f[1];
    let sub = null; const [fid, fw] = focusAt(t);
    if (fid && fw > 1e-4 && ISO.subjects[fid] && ISO.focusSafe) {
      sub = ISO.subjects[fid](t); sub.id = fid;
      const pp = sub.pts3.map((q) => V.P(q[0], q[1], q[2])), b = bbOf(pp), bw = Math.max(1e-3, b[2] - b[0]), bh = Math.max(1e-3, b[3] - b[1]), sa = ISO.focusSafe;
      const tier = sub.tier || (sub.kind === "static" || sub.kind === "part" ? "large" : "small"), minF = ISO.minFrac[tier][H_ > W ? 1 : 0];
      sub.tier = tier; sub.minFrac = minF;
      const Sfit = Math.min((sa.x1 - sa.x0) / bw, (sa.y1 - sa.y0) / bh) * 0.92, Ssize = Math.sqrt((minF * 1.2 * W * H_) / (bw * bh));
      const St = Math.min(Sfit, Math.max(S, Ssize)), w = fw, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      const p0x = tx + S * cx, p0y = ty + S * cy, S2 = S + (St - S) * w;
      const px = p0x + ((sa.x0 + sa.x1) / 2 - p0x) * w, py = p0y + ((sa.y0 + sa.y1) / 2 - p0y) * w;
      S = S2; tx = px - S * cx; ty = py - S * cy; sub.bb = b; sub.hull = H.hull(pp);
    }
    ISO.lastSubject = sub ? { id: sub.id, w: fw, tier: sub.tier, minFrac: sub.minFrac, poly: sub.hull.map((q) => [tx + S * q[0], ty + S * q[1]]), bb: [tx + S * sub.bb[0], ty + S * sub.bb[1], tx + S * sub.bb[2], ty + S * sub.bb[3]] } : null;
    const rest = restAz.some((a) => Math.abs(a - cam.az) < 1e-6), raster = hasW && rest && S <= R + 1e-9, F = widths(S);
    ISO.mode = raster ? "raster" : "vector"; ISO.stats[ISO.mode]++;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr * S, 0, 0, dpr * S, dpr * tx, dpr * ty);
    ctx.lineJoin = "round";
    const view = [-tx / S - 40, -ty / S - 40, (W - tx) / S + 40, (H_ - ty) / S + 40], Sst = world.statics;
    // ---- x-ray set ----
    const xr = new Set(), cover = [];
    if (sub && hasW && !ISO.noXray) for (const st of Sst) {
      if (st === sub.st || !ovl(st.bb, sub.bb)) continue;
      if (sub.kind === "ground" || (sub.st ? st.rank > sub.st.rank : !behind(st.fp, sub.fp, V))) xr.add(st);
    }
    // ---- live items: movers, dynamic statics, highlights ----
    const items = [];
    if (hasW) {
      for (const d of dynSt) {
        if (d.bbLive || true) { const out = []; const hh = d.draw(V, out, d, t); d.ops2 = parseOps(ISO.merge(out.join(""))); if (d.bbLive && hh && hh.length) d.bb = bbOf(hh); }
        if (ovl(d.bb, view)) items.push({ slot: d.rank, from: d.rank + 1, dpt: d.depth, bb: d.bb, ops: d.ops2, st: d, live: true });
      }
      const list = world.movers ? world.movers(t) : []; let nv = 0, se = null; const ents = [];
      for (const m of list) {
        const c0 = V.P(m.x, m.y, 0), X = tx + S * c0[0], Y = ty + S * c0[1];
        if (X < -160 || X > W + 160 || Y < -160 || Y > H_ + 200) continue;
        m.hot = !!(sub && sub.kind === "mover" && sub.mover === m.id && fw > 0.5);
        const out = [], hull = m.paint(V, out, m), bb = bbOf(hull); bb[2] += ISO.shadowOff; bb[3] += ISO.shadowOff; nv++;
        let lo = -1;
        for (let k = 0; k < order.length; k++) { const s2 = Sst[order[k]]; if (!ovl(s2.bb, bb)) continue; if (!behind(m.fp, s2.fp, V) && behind(s2.fp, m.fp, V)) lo = k; }
        const e = { slot: lo + 1, from: lo + 1, dpt: m.x * V.s + m.y * V.c, bb, ops: parseOps(ISO.merge(out.join(""))), hull, m, live: true };
        if (sub && sub.kind === "mover" && sub.mover === m.id) se = e;
        ents.push(e);
      }
      for (const e of ents) {
        if (e !== se && sub && !ISO.noXray && ovl(e.bb, sub.bb) && (sub.kind === "ground" || (se ? e.slot > se.slot || (e.slot === se.slot && e.dpt > se.dpt) : behind(sub.fp, e.m.fp, V)))) { e.xr = true; e.hullP = new Path2D(polyD(e.hull)); }
        items.push(e);
      }
      ISO.stats.movers = nv;
      // highlights (marker): focused subject (+ ISO.hiFn ids)
      const hot = sub && fw > 0.5 ? sub.hi : null;
      for (const id in hiIdx) {
        if (!(id === hot || ISO.hiFn(id, t))) continue;
        for (const { st, o } of hiIdx[id]) {
          const slot = st ? st.rank + 1 : 0, bb = o.bb;
          items.push({ slot, from: slot, dpt: st ? st.depth + 1e-3 : -1e9, bb, ops: [{ c: "hbm", p: o.p }], hi: true });
        }
      }
    }
    items.sort((a, b) => a.dpt - b.dpt);
    ISO.frame = { t, S, tx, ty, mode: ISO.mode, cover: [] };
    const cvr = ISO.frame.cover, scr = (poly) => poly.map((q) => [tx + S * q[0], ty + S * q[1]]);
    if (sub) {
      const slot = sub.kind === "mover" ? (items.find((e) => e.m && e.m.id === sub.mover) || { slot: 0 }).slot : sub.st ? sub.st.rank + 1 : 0;
      for (const st of Sst) if (st !== sub.st && st.rank >= slot && ovl(st.bb, sub.bb) && !st.dyn && st.hull.length) cvr.push({ k: "static", poly: scr(st.hull), xr: xr.has(st) });
      for (const e of items) if (e.m && !(sub.kind === "mover" && sub.mover === e.m.id) && ovl(e.bb, sub.bb) && e.hull && (e.slot > slot || (e.slot === slot && e.dpt > (items.find((q) => q.m && q.m.id === sub.mover) || { dpt: -1e9 }).dpt))) cvr.push({ k: "mover", poly: scr(e.hull), xr: !!e.xr });
    }
    // ---- paint ----
    if (hasW) {
      if (raster) {
        const b = ensureBase(qt);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
        ctx.drawImage(b.cv, b.x0, b.y0, b.w, b.h);
        if (xr.size) { // repaint the region of the x-rayed statics without them
          let rg = [1e9, 1e9, -1e9, -1e9]; xr.forEach((st) => { rg = [Math.min(rg[0], st.bb[0]), Math.min(rg[1], st.bb[1]), Math.max(rg[2], st.bb[2]), Math.max(rg[3], st.bb[3])]; });
          rg = [Math.max(rg[0] - 2, view[0]), Math.max(rg[1] - 2, view[1]), Math.min(rg[2] + 2, view[2]), Math.min(rg[3] + 2, view[3])];
          if (rg[2] > rg[0] && rg[3] > rg[1]) {
            ctx.save(); ctx.beginPath(); ctx.rect(rg[0], rg[1], rg[2] - rg[0], rg[3] - rg[1]); ctx.clip(); ctx.clearRect(rg[0], rg[1], rg[2] - rg[0], rg[3] - rg[1]);
            const u = ensureUnder(); ctx.drawImage(u.cv, u.x0, u.y0, u.w, u.h);
            for (const i of order) { const st = Sst[i]; if (!st.dyn && !xr.has(st) && ovl(st.bb, rg)) blit(ctx, st, F, qt); }
            ctx.restore();
          }
        }
        for (const it of items) {
          if (it.xr) ghost(it.hullP, F); else paintOps(ctx, it.ops, F, qt, it.live);
          const bb = it.bb;
          for (let k = it.from; k < order.length; k++) {
            const st = Sst[order[k]]; if (st.dyn || xr.has(st) || !ovl(st.bb, bb)) continue;
            ctx.save(); ctx.beginPath(); ctx.rect(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]); ctx.clip(); blit(ctx, st, F, qt); ctx.restore();
          }
        }
      } else {
        paintOps(ctx, groundOps, F, 0, false);
        ctx.fillStyle = T.shadow; for (const st of Sst) if (st.shP && ovl(st.bb, view)) ctx.fill(st.shP);
        const bySlot = new Map(); for (const it of items) { if (!bySlot.has(it.slot)) bySlot.set(it.slot, []); bySlot.get(it.slot).push(it); }
        const drawIt = (it) => { if (it.xr) ghost(it.hullP, F); else paintOps(ctx, it.ops, F, qt, it.live); };
        for (let k = 0; k <= order.length; k++) {
          const a = bySlot.get(k); if (a) a.forEach(drawIt);
          if (k < order.length) { const st = Sst[order[k]]; if (!st.dyn && !xr.has(st) && ovl(st.bb, view)) paintOps(ctx, st.ops, F, qt, true); }
        }
        for (const [k, a] of bySlot) if (k > order.length) a.forEach(drawIt);
      }
      xr.forEach((st) => { if (!st.hullP) st.hullP = new Path2D(polyD(st.hull)); ghost(st.hullP, F); });
      if (sub && xr.size) { // the subject stays on top of the ghost lines
        if (sub.st) paintOps(ctx, sub.st.ops, F, qt, true);
        for (const it of items) if (it.hi || (it.m && sub.kind === "mover" && sub.mover === it.m.id)) paintOps(ctx, it.ops, F, qt, it.live);
      }
    }
    if (parts.length || links.length) paintParts(V, F, qt);
    // ---- labels + leader pins (chips are DOM; leader/pin are drawn on the canvas, screen space) ----
    const safe = ISO.safe || { x0: 16, y0: 16, x1: W - 16, y1: H_ - 16 }, live = [];
    labels.forEach((L) => {
      const a = L.s.a;
      if (a <= 0.01 || (L.sub && !(ISO.lastSubject && ISO.lastSubject.id === L.sub)) || (L.part && L.part.s && L.part.s.on === 0 && !L.part.layers)) { L.el.style.visibility = "hidden"; return; }
      if (typeof L.text === "function") { const s = L.text(t); if (s !== L.txt) { L.txt = s; L.el.textContent = s; } }
      let q;
      if (L.sub && ISO.lastSubject && ISO.lastSubject.id === L.sub) { const b = ISO.lastSubject.bb; q = [(b[0] + b[2]) / 2, b[1]]; }
      else { const an = L.part ? L.part.anchor() : typeof L.at === "function" ? L.at(t) : L.at, q0 = V.P(an[0], an[1], an[2]); q = [tx + S * q0[0], ty + S * q0[1]]; }
      const w = L.el.offsetWidth, h = L.el.offsetHeight, b = { q, a, w, h, x: q[0] + L.dx - w / 2, y: q[1] + L.dy - h };
      b.x = Math.min(Math.max(b.x, safe.x0), safe.x1 - w - 8); b.y = Math.min(Math.max(b.y, safe.y0), safe.y1 - h - 8);
      for (let it = 0; it < 6; it++) { const hit = live.find((o) => b.x < o.x + o.w + 14 && o.x < b.x + w + 14 && b.y < o.y + o.h + 14 && o.y < b.y + h + 14); if (!hit) break; b.y = hit.y - h - 16; if (b.y < safe.y0) b.y = hit.y + hit.h + 16; b.y = Math.min(Math.max(b.y, safe.y0), safe.y1 - h - 8); }
      live.push(b);
      L.el.style.visibility = "visible";
      L.el.style.transform = `translate(${r1(b.x)}px,${r1(b.y)}px) scale(${Math.max(0, a).toFixed(3)})`;
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.strokeStyle = T.ink; ctx.fillStyle = T.ink; ctx.lineWidth = 5; ctx.lineCap = "round";
    live.filter((b) => b.a > 0.6).forEach((b) => {
      const ex = Math.min(Math.max(b.q[0], b.x + 24), b.x + b.w - 24), ey = b.q[1] < b.y ? b.y + 4 : b.y + b.h - 4;
      ctx.beginPath(); ctx.moveTo(b.q[0], b.q[1]); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.beginPath(); ctx.arc(b.q[0], b.q[1], 7, 0, Math.PI * 2); ctx.fill();
    });
    const ms = performance.now() - tA, Z = ISO.stats;
    Z.frames++; Z.sum += ms; Z.last = ms; if (ms > Z.max) Z.max = ms;
  };
  root.ISO = ISO;
})(typeof window !== "undefined" ? window : globalThis);
