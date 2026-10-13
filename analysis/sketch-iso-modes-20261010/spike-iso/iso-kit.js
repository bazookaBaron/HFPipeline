/* iso-kit.js (spike): poster-monochrome isometric world on HLG geometry (vendor/hl-geom.js), driven by a paused GSAP timeline.
 * Model: every part/link/label/camera has a plain state object `s`. Verbs are GSAP fromTo tweens on those objects (lazy:false,
 * immediateRender:false, explicit from = the authoring-time value, so any seek order is exact). After EVERY render of the timeline
 * (seek/totalTime/progress/parent render) the patched tl.render calls I.redraw(), which reprojects everything and repaints
 * back-to-front (painter's order). Nothing reads the clock: no rAF, no Date, no Math.random, no CSS animation/transition.
 *
 * I.init(tl, {svg, under, over, labels, W, H, theme})      svg = <svg> world layer; labels = DOM div for chips
 * I.cam({az,k,S,fx,fy,fz,sx,sy})                          home camera (focus world point fx,fy,fz lands on screen sx,sy)
 * Parts: I.floor / I.box / I.tower / I.cyl / I.rack / I.stack / I.chip / I.link / I.label  (see each fn)
 * Verbs (t = absolute timeline seconds):
 *   I.rise(p,t,{from,d})  drop from above + settle      I.extrude(p,t,{d})  h 0 -> h           I.show(p,t)
 *   I.explode(stack,t,gap,{d})  layers part along z (gap 0 = close)
 *   I.flow(link,t,dur,{n,dir,laps})  dots travel along link   I.drawLink(link,t,{d})
 *   I.hi(p,t,mode)  "marker" | "alert" | null   (one hi part at a time; previous one is cleared at the same t)
 *   I.orbit(t,az,{d})  I.zoomTo(p|[x,y,z],t,{S,sx,sy,d})  I.home(t,{d})  I.camTo(t,{...},{d})
 *   I.label(p,text,t,{out,dx,dy,fill})  DOM .lf-chip pinned to proj(anchor) with an ink leader line
 */
(function (root) {
  const H = root.HLG, NS = "http://www.w3.org/2000/svg", I = {};
  let tl, T, svg, under, over, labelsEl, W, H_;
  const parts = [], links = [], labels = [];
  let cam = { az: 45, k: 0.5, S: 2, fx: 0, fy: 0, fz: 0, sx: 960, sy: 540 }, camA = {};
  let HOME = null, hiPart = null;
  const SIL = 5, CR = 2.5;
  const r1 = (n) => Math.round(n * 10) / 10;
  const ptsS = (a) => a.map((p) => r1(p[0]) + " " + r1(p[1])).join("L");
  const polyD = (a) => (a.length ? "M" + ptsS(a) + "Z" : "");
  const openD = (a) => (a.length > 1 ? "M" + ptsS(a) : "");
  const tok = (k) => `var(--${k})`;

  // ---------- timeline plumbing ----------
  const TW = (target, from, to, t) => tl.fromTo(target, from, Object.assign({ immediateRender: false, lazy: false, overwrite: false }, to), t);
  const SET = (target, v, t) => tl.set(target, Object.assign({ immediateRender: false, lazy: false }, v), t);
  // tween state prop(s) from the authoring-time value to v; remembers v as the new authoring value
  function go(o, v, t, d, ease) {
    const from = {}, to = {};
    for (const k in v) { from[k] = o.a[k]; to[k] = v[k]; o.a[k] = v[k]; }
    if (!d) return SET(o.s, to, t);
    return TW(o.s, from, Object.assign(to, { duration: d, ease: ease || "power3.inOut" }), t);
  }
  // reactive state: every GSAP write goes through a setter; a change marks the world dirty and queues ONE microtask redraw
  // (fallback layer 3: catches any seek path, runs before page.evaluate/screenshot returns). Sync layers 1-2 clear the flag first.
  let dirty = false, queued = false;
  const kick = () => { dirty = true; if (!queued) { queued = true; queueMicrotask(() => { queued = false; if (dirty) I.redraw(); }); } };
  const obj = (init) => {
    const back = Object.assign({}, init), s = {};
    for (const k in back) Object.defineProperty(s, k, { enumerable: true, get: () => back[k], set: (v) => { if (back[k] !== v) { back[k] = v; kick(); } } });
    return { s, a: Object.assign({}, init) };
  };

  // layer 1: the timeline's own onUpdate (fires after all children rendered, on every seek with events on: HyperFrames renderSeek)
  I.timeline = () => gsap.timeline({ paused: true, onUpdate: () => I.redraw() });
  I.init = (timeline, o) => {
    tl = timeline; svg = o.svg; under = o.under; over = o.over; labelsEl = o.labels; W = o.W; H_ = o.H; T = o.theme;
    // the seek hook: every render of this timeline (any entry point) ends with a full repaint from state
    // layer 2: patch render on the real GSAP timeline (works for tl.seek(t) with suppressEvents=true, nested or not).
    // HyperFrames' renderer wraps gsap.timeline() in a forwarding proxy object, so this can be absent there: layer 1 covers it.
    const proto = Object.getPrototypeOf(tl).render;
    if (typeof proto === "function") tl.render = function () { const r = proto.apply(this, arguments); I.redraw(); return r; };
    I.camObj = obj(cam); cam = I.camState = I.camObj.s;
  };
  I.cam = (c) => { Object.assign(cam, c); Object.assign(I.camObj.a, c); HOME = Object.assign({}, cam); };

  // ---------- camera ----------
  function makeP() {
    const C = H.Cam(cam.az, cam.k, cam.S); const P0 = H.proj(C), f = P0(cam.fx, cam.fy, cam.fz);
    C.ox = cam.sx - f[0]; C.oy = cam.sy - f[1];
    return { C, P: H.proj(C), front: H.facing(C), c: Math.cos(C.az), s: Math.sin(C.az) };
  }
  I.orbit = (t, az, o = {}) => go(I.camObj, { az }, t, o.d || 3, o.ease || "sine.inOut");
  I.camTo = (t, v, o = {}) => go(I.camObj, v, t, o.d || 1.2, o.ease || "power3.inOut");
  I.zoomTo = (p, t, o = {}) => {
    const c = Array.isArray(p) ? p : p.center();
    return I.camTo(t, { fx: c[0], fy: c[1], fz: c[2], S: o.S || cam.S * 1.8, sx: o.sx ?? W * 0.42, sy: o.sy ?? H_ * 0.55 }, o);
  };
  I.home = (t, o = {}) => I.camTo(t, { fx: HOME.fx, fy: HOME.fy, fz: HOME.fz, S: HOME.S, sx: HOME.sx, sy: HOME.sy, ...(o.az != null ? { az: o.az } : {}) }, o);

  // ---------- solid painter ----------
  // ring = HLG rrect/circ samples; returns svg strings: side bands (left pale / right deep), top, creases, silhouette.
  function solid(V, out, ring, z0, z1, f) {
    const { P, c, s } = V, n = ring.length, top = H.ringAt(P, ring, z1), bot = H.ringAt(P, ring, z0), hgt = z1 - z0;
    const topFill = f.hi === "marker" ? tok("marker") : f.hi === "alert" ? tok("alert") : tok(f.top || "paper");
    const sideL = tok(f.L || "pale"), sideR = tok(f.R || "deep");
    let seams = [];
    if (hgt > 0.4) {
      // classify each ring segment: front-facing? left or right?
      const seg = [];
      for (let i = 0; i < n; i++) {
        const a = ring[i], b = ring[(i + 1) % n], nu = a.nu + b.nu, nv = a.nv + b.nv;
        const fr = nu * s + nv * c > 1e-6, sx = nu * c - nv * s;
        seg.push(fr ? (sx < 0 ? 1 : 2) : 0);
      }
      let st = seg.findIndex((v, i) => v !== seg[(i + n - 1) % n]); if (st < 0) st = 0;
      let i = 0;
      while (i < n) {
        const k = (st + i) % n, v = seg[k]; let j = i; while (j < n && seg[(st + j) % n] === v) j++;
        if (v) {
          const idx = []; for (let q = i; q <= j; q++) idx.push((st + q) % n);
          const pts = idx.map((q) => top[q]).concat(idx.slice().reverse().map((q) => bot[q]));
          out.push(`<path d="${polyD(pts)}" fill="${v === 1 ? sideL : sideR}" stroke="${v === 1 ? sideL : sideR}" stroke-width="1" stroke-linejoin="round"/>`);
          if (v === 1 && seg[(st + j) % n] === 2) seams.push((st + j) % n);
        }
        i = j;
      }
    }
    out.push(`<path d="${polyD(top)}" fill="${topFill}" stroke="none"/>`);
    let cr = "";
    if (hgt > 0.4) {
      cr += openD(H.ringAt(P, H.run(ring, V.front), z1));
      seams.forEach((q) => { cr += openD([top[q], bot[q]]); });
    }
    if (f.lip) cr += polyD(H.ringAt(P, f.lip, z1));
    if (f.cr) cr += f.cr;
    if (cr) out.push(`<path d="${cr}" fill="none" stroke="${tok("ink")}" stroke-width="${CR}" stroke-linecap="round" stroke-linejoin="round"/>`);
    if (f.extra) out.push(f.extra);
    out.push(`<path d="${polyD(H.hull(top.concat(bot)))}" fill="none" stroke="${tok("ink")}" stroke-width="${f.sil || SIL}" stroke-linejoin="round"/>`);
    return H.hull(top.concat(bot));
  }
  // lines on the visible axis faces of a box: zs = heights (absolute), m = margin from corners
  function faceLines(V, x0, y0, x1, y1, zs, m) {
    const { P, front } = V; let d = "";
    const faces = [[1, 0, x1, null], [-1, 0, x0, null], [0, 1, null, y1], [0, -1, null, y0]];
    faces.forEach(([nu, nv, X, Y]) => {
      if (!front({ nu, nv })) return;
      zs.forEach((z) => {
        const a = X != null ? P(X, y0 + m, z) : P(x0 + m, Y, z), b = X != null ? P(X, y1 - m, z) : P(x1 - m, Y, z);
        d += `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`;
      });
    });
    return d;
  }
  function faceDots(V, x0, y0, x1, y1, zs, m, r) {
    const { P, front } = V; let out = "";
    [[1, 0, x1, null], [0, 1, null, y1], [-1, 0, x0, null], [0, -1, null, y0]].forEach(([nu, nv, X, Y]) => {
      if (!front({ nu, nv })) return;
      zs.forEach((z) => { const q = X != null ? P(X, y1 - m, z) : P(x1 - m, Y, z); out += `<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="${r}" fill="${tok("marker")}" stroke="${tok("ink")}" stroke-width="2"/>`; });
    });
    return out;
  }

  // ---------- parts ----------
  // common state: on (0/1), lift (z offset, rise), grow (0..1 extrude), ex (explode offset), hi (null|"marker"|"alert"), z (base)
  let FLOOR_Z = 0;
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
  const hiOf = (p) => (p.s.hi === 1 ? "marker" : p.s.hi === 2 ? "alert" : null);

  I.floor = (o) => { FLOOR_Z = o.h; const p = part("floor", Object.assign({ layer: 0, z: -o.h, on: 1 }, o), (V, out, p) => {
    const ring = H.rrect(o.x - o.w / 2, o.y - o.d / 2, o.x + o.w / 2, o.y + o.d / 2, o.r ?? 16, 6), lip = H.rrect(o.x - o.w / 2 + 10, o.y - o.d / 2 + 10, o.x + o.w / 2 - 10, o.y + o.d / 2 - 10, Math.max(1, (o.r ?? 16) - 10), 6);
    return solid(V, out, ring, p.base(), p.top(), { top: o.top || "pale", L: "paper", R: "deep", lip });
  }); p.base = () => p.s.lift + 0; p.top = () => o.h * p.s.grow; return p; };
  I.box = (o) => part("box", o, (V, out, p) => solid(V, out, foot(o), p.base(), p.top(), { hi: hiOf(p), lip: o.lip ? H.rrect(o.x - o.w / 2 + o.lip, o.y - o.d / 2 + o.lip, o.x + o.w / 2 - o.lip, o.y + o.d / 2 - o.lip, Math.max(0.5, (o.r ?? 4) - o.lip), 4) : null, top: o.top, L: o.L, R: o.R }));
  I.tower = (o) => part("tower", o, (V, out, p) => {
    const z0 = p.base(), z1 = p.top(), zs = []; for (let z = z0 + (o.band || 22); z < z1 - 8; z += o.band || 22) zs.push(z);
    return solid(V, out, foot(o), z0, z1, { hi: hiOf(p), cr: faceLines(V, o.x - o.w / 2, o.y - o.d / 2, o.x + o.w / 2, o.y + o.d / 2, zs, 0) });
  });
  I.cyl = (o) => part("cyl", o, (V, out, p) => {
    const ring = H.circ(o.R, 48).map((q) => ({ u: q.u + o.x, v: q.v + o.y, nu: q.nu, nv: q.nv })), z0 = p.base(), z1 = p.top();
    let cr = ""; (o.bands || []).forEach((f) => { const z = z0 + (z1 - z0) * f; if (z1 - z0 > 4) cr += openD(H.ringAt(V.P, H.run(ring, V.front), z)); });
    const lip = H.circ(o.R * 0.62, 36).map((q) => ({ u: q.u + o.x, v: q.v + o.y, nu: q.nu, nv: q.nv }));
    return solid(V, out, ring, z0, z1, { hi: hiOf(p), cr, lip });
  });
  I.rack = (o) => part("rack", o, (V, out, p) => {
    const z0 = p.base(), z1 = p.top(), zs = [], dz = []; const u = (z1 - z0) / (o.units || 6);
    for (let k = 1; k < (o.units || 6); k++) zs.push(z0 + k * u);
    if (z1 - z0 > 20) for (let k = 0; k < (o.units || 6); k++) dz.push(z0 + k * u + u / 2);
    const x0 = o.x - o.w / 2, y0 = o.y - o.d / 2, x1 = o.x + o.w / 2, y1 = o.y + o.d / 2;
    return solid(V, out, foot(o), z0, z1, { hi: hiOf(p), cr: faceLines(V, x0, y0, x1, y1, zs, 3), extra: faceDots(V, x0, y0, x1, y1, dz, 7, 4.5) });
  });
  // layer stack: n thin slabs sharing a footprint; ex state on the stack drives the gap between layers
  I.stack = (o) => {
    const st = obj({ gap: 0 }); st.layers = []; st.o = o;
    for (let i = 0; i < o.n; i++) {
      const lo = Object.assign({}, o, { h: o.lh, z: (o.z || 0) + i * o.lh, id: (o.id || "stack") + "-L" + i, layer: 2 });
      const L = part("layer", lo, (V, out, p) => solid(V, out, foot(lo), p.base(), p.top(), { hi: hiOf(p), top: (o.tops && o.tops[i]) || "paper", lip: H.rrect(lo.x - lo.w / 2 + 5, lo.y - lo.d / 2 + 5, lo.x + lo.w / 2 - 5, lo.y + lo.d / 2 - 5, Math.max(0.5, (lo.r ?? 4) - 5), 4) }));
      L.base = () => FLOOR_Z + lo.z + L.s.lift + i * st.s.gap; L.idx = i; L.stack = st; st.layers.push(L);
    }
    st.top = () => st.layers[o.n - 1].top();
    st.center = () => [o.x, o.y, (st.layers[0].base() + st.top()) / 2];
    st.anchor = () => [o.x, o.y, st.top()];
    return st;
  };
  // chip: package slab + die + pins, sitting on a parent part (o.parent) or the floor
  I.chip = (o) => part("chip", o, (V, out, p) => {
    const z0 = p.base(), z1 = p.top(), { P } = V, x0 = o.x - o.w / 2, y0 = o.y - o.d / 2, x1 = o.x + o.w / 2, y1 = o.y + o.d / 2;
    let pins = ""; const np = o.pins || 5, pl = o.pinLen || 7;
    for (let k = 0; k < np; k++) {
      const fx = x0 + ((k + 0.5) / np) * o.w, fy = y0 + ((k + 0.5) / np) * o.d;
      [[fx, y1, fx, y1 + pl], [x1, fy, x1 + pl, fy], [fx, y0, fx, y0 - pl], [x0, fy, x0 - pl, fy]].forEach(([a, b, c2, d2]) => { const A = P(a, b, z0 + 1), B = P(c2, d2, z0 + 1); pins += `M${r1(A[0])} ${r1(A[1])}L${r1(B[0])} ${r1(B[1])}`; });
    }
    out.push(`<path d="${pins}" stroke="${tok("ink")}" stroke-width="4" stroke-linecap="round" fill="none"/>`);
    const hull = solid(V, out, foot(o), z0, z1, { top: "paper", L: "pale", R: "deep" });
    const dw = o.w * 0.5, dd = o.d * 0.5, die = H.rrect(o.x - dw / 2, o.y - dd / 2, o.x + dw / 2, o.y + dd / 2, 2, 3);
    solid(V, out, die, z1, z1 + (o.dieH || 3) * p.s.grow, { hi: hiOf(p), top: "ink" === o.dieTop ? "ink" : "paper", sil: 3.5 });
    return hull;
  });
  // link: floor ribbon along world polyline pts [[x,y],...]; state draw (0..1 reveal), ph (dot phase), dots (0/1)
  I.link = (o) => { const l = obj({ draw: 0, ph: 0, dots: 0, dir: 1 }); l.o = o; l.kind = "link"; links.push(l); return l; };
  I.drawLink = (l, t, o = {}) => go(l, { draw: 1 }, t, o.d || 0.6, "power2.inOut");
  I.flow = (l, t, dur, o = {}) => {
    go(l, { dir: o.dir || 1, dots: 1 }, t, 0); go(l, { ph: 0 }, t, 0);
    go(l, { ph: o.laps || dur / 1.6 }, t, dur, "none"); go(l, { dots: 0 }, t + dur, 0);
    l.n = o.n || l.n || 3;
  };

  // ---------- verbs on parts ----------
  const tgt = (p) => (p.layers ? p.layers : [p]);
  I.show = (p, t) => tgt(p).forEach((q) => go(q, { on: 1 }, t, 0));
  I.hide = (p, t) => tgt(p).forEach((q) => go(q, { on: 0 }, t, 0));
  I.rise = (p, t, o = {}) => {
    tgt(p).forEach((q, i) => {
      const ti = t + i * (o.stagger || 0.08);
      go(q, { on: 1, lift: o.from || 420 }, ti, 0);
      go(q, { lift: 0 }, ti, o.d || 0.55, "bounce.out");
    });
  };
  I.extrude = (p, t, o = {}) => tgt(p).forEach((q) => { go(q, { on: 1, grow: 0.001 }, t, 0); go(q, { grow: 1 }, t, o.d || 0.8, o.ease || "power2.out"); });
  I.explode = (st, t, gap, o = {}) => go(st, { gap }, t, o.d || 0.9, o.ease || (gap ? "back.out(1.4)" : "power3.inOut"));
  I.hi = (p, t, mode) => {
    const v = mode === "alert" ? 2 : mode ? 1 : 0;
    if (v && hiPart && hiPart !== p) go(hiPart, { hi: 0 }, t, 0);
    go(p, { hi: v }, t, 0); hiPart = v ? p : (hiPart === p ? null : hiPart);
  };

  // ---------- labels ----------
  I.label = (p, text, t, o = {}) => {
    const el = document.createElement("div");
    el.className = "lf-chip iso-chip" + (o.fill ? " " + o.fill : "");
    el.textContent = text;
    ["data-layout-allow-overlap", "data-layout-allow-occlusion", "data-layout-allow-overflow"].forEach((a) => el.setAttribute(a, ""));
    el.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;transform-origin:50% 100%" + (o.size ? `;font-size:${o.size}px` : "");
    labelsEl.appendChild(el);
    const L = obj({ a: 0 }); Object.assign(L, { p, el, dx: o.dx ?? 0, dy: o.dy ?? -110, at: o.at });
    labels.push(L);
    go(L, { a: 1 }, t, 0.28, "back.out(2.2)");
    if (o.out != null) go(L, { a: 0 }, o.out, 0.18, "power2.in");
    return L;
  };

  // ---------- redraw ----------
  const depth = (V, x, y) => x * V.s + y * V.c;
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
  I.redraw = () => {
    if (!svg) return; dirty = false;
    const V = makeP(), { P } = V, out0 = [], outSh = [], outL = [], outS = [], fz = FLOOR_Z + 0.5;
    const vis = parts.filter((p) => p.s.on > 0.5);
    vis.sort((a, b) => a.layer - b.layer || Math.round(depth(V, a.o.x, a.o.y)) - Math.round(depth(V, b.o.x, b.o.y)) || a.base() - b.base());
    // pass 1: floor; pass 2: links; pass 3: shadows of all solids; pass 4: solids back to front
    vis.forEach((p) => {
      if (p.layer === 0) { p.draw(V, out0, p); return; }
      const buf = [], hull = p.draw(V, buf, p);
      if (p.o.shadow !== false && !(p.stack && p.idx > 0) && hull && hull.length) {
        // hard poster shadow: the resting silhouette offset down-right in screen px, shrunk toward its footprint while lifted
        const k = 1 / (1 + Math.max(0, p.s.lift + p.s.ex) / 160), off = 13 * k;
        const cx = hull.reduce((a, q) => a + q[0], 0) / hull.length, cy = hull.reduce((a, q) => a + q[1], 0) / hull.length;
        const liftPx = (p.s.lift + p.s.ex) * V.C.S * Math.sqrt(1 - V.C.k * V.C.k);
        const sh = hull.map((q) => [cx + (q[0] - cx) * k + off, cy + liftPx + (q[1] - cy) * k + off]);
        outSh.push(`<path d="${polyD(sh)}" fill="${tok("shadow")}"/>`);
      }
      outS.push(buf.join(""));
    });
    links.forEach((l) => {
      if (l.s.draw <= 0.001) return;
      const pts = l.o.pts.map((q) => P(q[0], q[1], fz)), tp = trimPoly(pts, l.s.draw), d = openD(tp), w = (l.o.w || 14) * V.C.S * 0.55;
      outL.push(`<path d="${d}" fill="none" stroke="${tok("ink")}" stroke-width="${r1(w + 2 * CR + 2)}" stroke-linecap="round" stroke-linejoin="round"/>`);
      outL.push(`<path d="${d}" fill="none" stroke="${tok(l.o.fill || "paper")}" stroke-width="${r1(w)}" stroke-linecap="round" stroke-linejoin="round"/>`);
      if (l.s.dots > 0.5) {
        const n = l.n || 3, rr = (l.o.dot || 8) * V.C.S;
        for (let i = 0; i < n; i++) {
          let f = (l.s.ph + i / n) % 1; if (l.s.dir < 0) f = 1 - f;
          const q = along(pts, f);
          outL.push(`<ellipse cx="${r1(q[0])}" cy="${r1(q[1])}" rx="${r1(rr)}" ry="${r1(rr * V.C.k)}" fill="${tok(l.o.dotFill || "marker")}" stroke="${tok("ink")}" stroke-width="3"/>`);
        }
      }
    });
    under.innerHTML = out0.join("") + outL.join("") + outSh.join("");
    svg.innerHTML = outS.join("");
    // labels
    // labels: anchor = proj(part top); chip box = anchor + (dx,dy), clamped into the safe rect, then later chips are pushed up
    // until no two live chips overlap (deterministic: label creation order). Leader: anchor dot -> chip bottom centre.
    const safe = I.safe || { x0: 16, y0: 16, x1: W - 16, y1: H_ - 16 }, live = [];
    labels.forEach((L) => {
      const a = L.s.a;
      if (a <= 0.01 || (L.p.s && L.p.s.on === 0 && !L.p.layers)) { L.el.style.visibility = "hidden"; return; }
      const an = L.at ? L.at() : L.p.anchor(), q = P(an[0], an[1], an[2]), w = L.el.offsetWidth, h = L.el.offsetHeight;
      const b = { L, q, a, w, h, x: q[0] + L.dx - w / 2, y: q[1] + L.dy - h };
      const clamp = () => { b.x = Math.min(Math.max(b.x, safe.x0), safe.x1 - w - 8); b.y = Math.min(Math.max(b.y, safe.y0), safe.y1 - h - 8); };
      clamp();
      for (let it = 0; it < 6; it++) {
        const hit = live.find((o) => b.x < o.x + o.w + 14 && o.x < b.x + w + 14 && b.y < o.y + o.h + 14 && o.y < b.y + h + 14);
        if (!hit) break;
        b.y = hit.y - h - 16; if (b.y < safe.y0) { b.y = hit.y + hit.h + 16; } clamp();
      }
      live.push(b);
      L.el.style.visibility = "visible";
      L.el.style.transform = `translate(${r1(b.x)}px,${r1(b.y)}px) scale(${Math.max(0, a).toFixed(3)})`;
    });
    let lead = "", dots = "";
    live.filter((b) => b.a > 0.6).forEach((b) => {
      const ex = Math.min(Math.max(b.q[0], b.x + 24), b.x + b.w - 24), ey = b.q[1] < b.y ? b.y + 4 : b.y + b.h - 4;
      lead += `M${r1(b.q[0])} ${r1(b.q[1])}L${r1(ex)} ${r1(ey)}`;
      dots += `<circle cx="${r1(b.q[0])}" cy="${r1(b.q[1])}" r="7" fill="${tok("ink")}"/>`;
    });
    over.innerHTML = lead ? `<path d="${lead}" stroke="${tok("ink")}" stroke-width="5" stroke-linecap="round" fill="none"/>` + dots : "";
  };
  I.parts = parts; I.links = links; I.labels = labels; I.camState = cam;
  root.I = I;
})(typeof window !== "undefined" ? window : globalThis);
