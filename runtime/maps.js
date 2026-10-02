/* Poster-style animated maps (seek-safe GSAP). Needs gsap, runtime/geo/geo.js (window.MAPS_GEO) and the theme CSS vars.
 * Doc: runtime/MAPS.md. Every performance is M.verb(args, t, opts) on the paused timeline passed as opts.tl.
 * Geometry is data-driven: tweens only move small state objects, draw() re-renders SVG from state (camera, arcs, lift),
 * so strokes/shadows stay constant in screen px at any zoom. */
(function (root) {
  const NS = "http://www.w3.org/2000/svg", S = 5000;
  const Maps = { tl: null };
  const REGIONS = {
    asia: [58, -11, 146, 52], "south-asia": [60, 5, 98, 38], "east-asia": [95, 18, 146, 50], "southeast-asia": [92, -11, 142, 24],
    "middle-east": [32, 12, 63, 42], europe: [-12, 35, 40, 62], africa: [-20, -36, 52, 38], "north-america": [-130, 14, -60, 55],
    "south-america": [-82, -56, -34, 13], oceania: [110, -48, 180, -8], "indian-ocean": [40, -15, 100, 32],
  };
  const CITIES = {
    mumbai: [72.88, 19.08], delhi: [77.21, 28.61], bengaluru: [77.59, 12.97], chennai: [80.27, 13.08], kolkata: [88.36, 22.57], hyderabad: [78.49, 17.39],
    karachi: [67.01, 24.86], islamabad: [73.05, 33.68], dhaka: [90.41, 23.81], colombo: [79.86, 6.93], kathmandu: [85.32, 27.72],
    beijing: [116.41, 39.9], shanghai: [121.47, 31.23], "hong kong": [114.17, 22.32], singapore: [103.82, 1.35], tokyo: [139.69, 35.69], seoul: [126.98, 37.57],
    jakarta: [106.85, -6.21], bangkok: [100.5, 13.76], dubai: [55.27, 25.2], "abu dhabi": [54.37, 24.45], riyadh: [46.68, 24.71], doha: [51.53, 25.29],
    tehran: [51.39, 35.69], istanbul: [28.98, 41.01], moscow: [37.62, 55.76], london: [-0.13, 51.51], paris: [2.35, 48.86], frankfurt: [8.68, 50.11],
    "new york": [-74.01, 40.71], "san francisco": [-122.42, 37.77], "sao paulo": [-46.63, -23.55], lagos: [3.38, 6.52], nairobi: [36.82, -1.29],
    johannesburg: [28.05, -26.2], cairo: [31.24, 30.04], sydney: [151.21, -33.87], mecca: [39.83, 21.42], jeddah: [39.17, 21.54], muscat: [58.41, 23.59],
  };
  function project(lon, lat) {
    const lam = lon * Math.PI / 180, phi = lat * Math.PI / 180, p2 = phi * phi, p4 = p2 * p2;
    const x = lam * (0.8707 - 0.131979 * p2 - 0.013791 * p4 + 0.003971 * p2 * p4 * p4 - 0.001529 * p4 * p4 * p4);
    const y = phi * (1.007226 + 0.015085 * p2 - 0.044475 * p2 * p4 + 0.028874 * p4 * p4 - 0.005916 * p2 * p4 * p4);
    return [x * S, -y * S];
  }
  Maps.project = project; Maps.CITIES = CITIES; Maps.REGIONS = REGIONS;
  const hex = (c) => { c = String(c).trim(); if (c[0] !== "#") return [255, 255, 255]; if (c.length === 4) c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); };
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const mk = (tag, at, par) => { const e = document.createElementNS(NS, tag); for (const k in at || {}) e.setAttribute(k, at[k]); if (par) par.appendChild(e); return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const title = (n) => String(n).replace(/\b\w/g, (m) => m.toUpperCase());

  Maps.mount = function (id, o) {
    o = o || {};
    const G = root.MAPS_GEO; if (!G) throw new Error("maps: load runtime/geo/geo.js first");
    const tl = o.tl || Maps.tl; if (!tl) throw new Error("maps: pass opts.tl (paused gsap timeline)");
    const host = typeof id === "string" ? document.getElementById(id.replace(/^#/, "")) : id;
    const wide = o.layout !== "9x16";
    const W = o.w || (wide ? 1920 : 1080), H = o.h || (wide ? 1080 : 1920), X = o.x || 0, Y = o.y || 0;
    const cs = getComputedStyle(document.documentElement), V = (n, d) => (cs.getPropertyValue("--" + n).trim() || d);
    const T = Object.assign({ ink: V("ink", "#111111"), paper: V("paper", "#FBF7EE"), bg: V("bg", "#4DAF4A"), deep: V("deep", "#2E7D32"), pale: V("pale", "#CDE8C4"), shadow: V("shadow", "#3F6FC0"), marker: V("marker", "#F6DA1C"), alert: V("alert", "#E8553E"), dot: V("dot", "rgba(0,0,0,.13)") }, o.theme || {});
    const land = o.land === "pale" ? T.pale : T.paper, SH = o.shadow == null ? 9 : o.shadow, ids = (host.id || "m") + "_";
    const water = o.water === "deep" ? T.deep : T.bg;
    host.setAttribute("data-layout-allow-overflow", ""); host.setAttribute("data-layout-allow-overlap", "");
    host.style.cssText += `;position:absolute;left:${X}px;top:${Y}px;width:${W}px;height:${H}px;overflow:hidden;background-color:${water};background-image:radial-gradient(circle at center,${T.dot} 0 1.8px,transparent 2.4px);background-size:36px 36px;${o.frame ? `border:6px solid ${T.ink};box-sizing:border-box;box-shadow:10px 10px 0 ${T.shadow};border-radius:22px;` : ""}`;
    const svg = mk("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: "position:absolute;left:0;top:0;overflow:hidden" }, host);
    const defs = mk("defs", {}, svg), isos = Object.keys(G.countries);
    isos.forEach((k) => { mk("path", { id: ids + k, d: G.countries[k].d, pathLength: 1, "fill-rule": "evenodd" }, defs); if (G.countries[k].s) mk("path", { id: ids + k + "_s", d: G.countries[k].s, "fill-rule": "evenodd" }, defs); });
    const grat = mk("path", { fill: "none", stroke: T.ink, "stroke-opacity": 0.15, "stroke-linecap": "butt" }, svg);
    { const parts = []; for (let lo = -180; lo <= 180; lo += 15) { const p = []; for (let la = -75; la <= 85; la += 5) p.push(project(lo, la)); parts.push("M" + p.map((q) => q[0].toFixed(0) + " " + q[1].toFixed(0)).join("L")); }
      for (let la = -75; la <= 75; la += 15) { const p = []; for (let lo = -180; lo <= 180; lo += 5) p.push(project(lo, la)); parts.push("M" + p.map((q) => q[0].toFixed(0) + " " + q[1].toFixed(0)).join("L")); }
      grat.setAttribute("d", parts.join("")); if (o.graticule === false) grat.style.display = "none"; }
    const layer = (at) => mk("g", at, svg);
    const shadowG = layer({ fill: T.shadow, stroke: T.shadow, "stroke-linejoin": "round" }), coastG = layer({ fill: T.ink, stroke: T.ink, "stroke-linejoin": "round" });
    const fillsG = layer({ fill: land, stroke: "none" }), linesG = layer({ fill: "none", stroke: T.ink, "stroke-linejoin": "round", "stroke-linecap": "round" }), topG = layer({});
    const use = (par, k, at) => mk("use", Object.assign({ href: "#" + ids + k }, at || {}), par);
    const fillUse = {};
    isos.forEach((k) => { use(shadowG, G.countries[k].s ? k + "_s" : k); use(coastG, k); fillUse[k] = use(fillsG, k); use(linesG, k); });
    const ov = mk("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: "position:absolute;left:0;top:0;overflow:hidden;pointer-events:none" }, host);
    gsap.set(linesG, { attr: { "stroke-dasharray": 1, "stroke-dashoffset": o.drawBorders ? 1 : 0 } });

    // ---------- camera ----------
    const asp = W / H, M = { el: host, svg, ov, T, W, H, tl, cam: null };
    const bboxOf = (spec) => {
      const cc = (k) => { const c = G.countries[String(k).toUpperCase()]; if (!c) throw new Error("maps: unknown country " + k); return c.b; };
      if (spec === "world") return [-13497, project(0, 84)[1], 13571, project(0, -57)[1]];
      if (typeof spec === "string" && REGIONS[spec]) spec = REGIONS[spec];
      if (typeof spec === "string") return cc(spec);
      if (Array.isArray(spec) && typeof spec[0] === "string") { const bs = spec.map(cc); return [Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))]; }
      if (spec && !Array.isArray(spec) && spec.lon) spec = [spec.lon[0], spec.lat[0], spec.lon[1], spec.lat[1]];
      if (Array.isArray(spec) && spec.length === 4) { const p = []; for (let i = 0; i <= 16; i++) { const u = i / 16, lo = spec[0] + (spec[2] - spec[0]) * u, la = spec[1] + (spec[3] - spec[1]) * u; p.push(project(lo, spec[1]), project(lo, spec[3]), project(spec[0], la), project(spec[2], la)); }
        return [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))]; }
      throw new Error("maps: bad view " + JSON.stringify(spec));
    };
    const fit = (spec, pad) => {
      if (spec && spec.cx != null) return { cx: spec.cx, cy: spec.cy, w: spec.w };
      const b = bboxOf(spec), p = pad == null ? (spec === "world" ? 0.01 : 0.08) : pad, bw = (b[2] - b[0]) * (1 + 2 * p), bh = (b[3] - b[1]) * (1 + 2 * p);
      return { cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, w: Math.max(bw, bh * asp) };
    };
    M.fit = fit;
    let v0 = o.view || "world"; if (v0 === "region") v0 = o.region || "asia";
    M.cam = fit(v0, o.pad);
    const pt = (p) => { if (typeof p === "string") { const c = CITIES[p.toLowerCase()]; if (c) return project(c[0], c[1]); const k = G.countries[p.toUpperCase()]; if (k) return k.c; throw new Error("maps: unknown place " + p); } return project(p[0], p[1]); };
    M.pt = pt;

    // ---------- anchored screen-space overlay ----------
    const anchors = [], arcs = [], focuses = [];
    const anchor = (x, y) => { const g = mk("g", {}, ov), a = { g, x, y }; anchors.push(a); return a; };
    const chip = (par, text, c) => {
      c = c || {}; const fs = c.size || 36, w = Math.ceil(String(text).length * fs * 0.5 + (c.pad || 14) * 2), h = Math.ceil(fs * 1.2 + 12), g = mk("g", {}, par);
      mk("rect", { x: -w / 2 + 4, y: -h / 2 + 4, width: w, height: h, rx: 9, fill: T.shadow }, g);
      mk("rect", { x: -w / 2, y: -h / 2, width: w, height: h, rx: 9, fill: c.fill || T.paper, stroke: T.ink, "stroke-width": 3.5 }, g);
      const t = mk("text", { x: 0, y: 1, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Anton,Impact,sans-serif", "font-size": fs, "letter-spacing": fs * 0.03, fill: c.color || T.ink }, g); t.textContent = String(text).toUpperCase();
      return { g, w, h, t };
    };
    M.chip = chip;
    const hide = (e) => { e.style.opacity = 0; return e; };
    const O0 = (e) => { gsap.set(e, { transformOrigin: "0px 0px" }); return e; };
    const pop = (e, t, d) => { tl.set(e, { opacity: 1 }, t); tl.fromTo(e, { scale: 0, rotation: -6 }, { scale: 1, rotation: 0, duration: d || 0.28, ease: "back.out(2.6)", immediateRender: false }, t); };

    // ---------- draw: pure function of state ----------
    function draw() {
      const c = M.cam, w = c.w, h = w / asp, s = w / W, vx = c.cx - w / 2, vy = c.cy - h / 2;
      svg.setAttribute("viewBox", `${vx} ${vy} ${w} ${h}`);
      grat.setAttribute("stroke-width", 1.6 * s); grat.setAttribute("stroke-dasharray", `${9 * s} ${9 * s}`);
      shadowG.setAttribute("stroke-width", 6 * s); shadowG.setAttribute("transform", `translate(${SH * s} ${SH * s})`);
      coastG.setAttribute("stroke-width", 6 * s); linesG.setAttribute("stroke-width", (o.border || 2.8) * s);
      focuses.forEach((f) => {
        const k = f.p, sc = 1 + 0.04 * k, ce = f.c, off = (SH + 11 * k) * s, lift = 6 * k * s, tf = `translate(${ce[0]} ${ce[1]}) scale(${sc}) translate(${-ce[0]} ${-ce[1]})`;
        f.sh.setAttribute("transform", `translate(${off} ${off}) ${tf}`); f.sh.setAttribute("stroke-width", 6 * s);
        f.body.setAttribute("transform", `translate(${-lift} ${-lift}) ${tf}`); f.coast.setAttribute("stroke-width", 6 * s); f.line.setAttribute("stroke-width", (o.border || 2.8) * 1.15 * s);
      });
      arcs.forEach((A) => {
        const N = A.pts.length - 1, show = A.p > 0.001;
        A.g.style.display = show ? "" : "none"; if (!show) return;
        const f = A.p * N, n = Math.floor(f), pts = A.pts.slice(0, n + 1); if (f > n && n < N) pts.push([A.pts[n][0] + (A.pts[n + 1][0] - A.pts[n][0]) * (f - n), A.pts[n][1] + (A.pts[n + 1][1] - A.pts[n][1]) * (f - n)]);
        const d = "M" + pts.map((q) => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L"), dash = `0.01 ${19 * s}`;
        [A.sh, A.ln].forEach((e) => { e.setAttribute("d", d); e.setAttribute("stroke-width", 9 * s); e.setAttribute("stroke-dasharray", dash); e.setAttribute("stroke-dashoffset", -A.off * s); });
        A.sh.setAttribute("transform", `translate(${3.5 * s} ${3.5 * s})`);
        const tip = pts[pts.length - 1], pr = pts[Math.max(0, pts.length - 4)], ang = Math.atan2(tip[1] - pr[1], tip[0] - pr[0]), L = 32 * s, Wd = 20 * s, ca = Math.cos(ang), sa = Math.sin(ang);
        const P = (u, v) => `${(tip[0] + ca * u - sa * v).toFixed(1)},${(tip[1] + sa * u + ca * v).toFixed(1)}`;
        A.ah.setAttribute("points", `${P(L * 0.45, 0)} ${P(-L * 0.55, -Wd)} ${P(-L * 0.25, 0)} ${P(-L * 0.55, Wd)}`); A.ah.setAttribute("stroke-width", 4 * s);
        A.ahs.setAttribute("points", A.ah.getAttribute("points")); A.ahs.setAttribute("transform", `translate(${3.5 * s} ${3.5 * s})`);
        A.dots.forEach((D, i) => {
          const q = (A.q + i / A.dots.length) % 1, on = A.dotOn && A.p >= 0.999, ff = q * N, nn = Math.min(N - 1, Math.floor(ff)), r = ff - nn;
          const x = A.pts[nn][0] + (A.pts[nn + 1][0] - A.pts[nn][0]) * r, y = A.pts[nn][1] + (A.pts[nn + 1][1] - A.pts[nn][1]) * r;
          D.style.display = on ? "" : "none"; D.setAttribute("transform", `translate(${x} ${y})`);
          D.firstChild.setAttribute("r", 12 * s); D.firstChild.setAttribute("stroke-width", 4 * s); D.firstChild.setAttribute("cx", 3.5 * s); D.firstChild.setAttribute("cy", 3.5 * s);
          D.lastChild.setAttribute("r", 12 * s); D.lastChild.setAttribute("stroke-width", 4 * s);
        });
      });
      anchors.forEach((a) => a.g.setAttribute("transform", `translate(${((a.x - vx) / s).toFixed(2)} ${((a.y - vy) / s).toFixed(2)})`));
    }
    M.draw = draw;
    const run = (t, d, ease, fn, ex) => {
      const st = { p: 0 };
      tl.to(st, Object.assign({ p: 1, duration: d, ease, immediateRender: false, onUpdate: () => { fn(st.p); draw(); }, onComplete: () => { fn(1); draw(); }, onReverseComplete: () => { fn(0); draw(); } }, ex), t);
      return st;
    };

    // ---------- performances ----------
    M.drawBorders = (t, d) => { d = d || 1.4; tl.fromTo(linesG, { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: d, ease: "power2.inOut", immediateRender: false }, t); tl.set(linesG, { attr: { "stroke-dasharray": "none" } }, t + d + 0.01); };
    M.zoom = (view, t, d, z) => {
      z = z || {}; d = d || 1.6; const a = M._next || fit(v0, o.pad), b = fit(view, z.pad), ia = 1 / a.w, ib = 1 / b.w, same = Math.abs(ia - ib) < 1e-12; M._next = b;
      run(t, d, z.ease || "power2.inOut", (p) => {
        const w = Math.exp(Math.log(a.w) + (Math.log(b.w) - Math.log(a.w)) * p), u = same ? p : 1 - (1 - p) * (1 - p);
        M.cam = { cx: a.cx + (b.cx - a.cx) * u, cy: a.cy + (b.cy - a.cy) * u, w };
      });
      return M;
    };
    M.focus = (iso, t, f) => {
      f = f || {}; iso = iso.toUpperCase(); const ce = G.countries[iso].c, d = f.dur || 0.7, col = f.color || T.marker;
      const g = mk("g", { opacity: 0 }, topG), sh = mk("g", { fill: T.shadow, stroke: T.shadow, "stroke-linejoin": "round" }, g), body = mk("g", {}, g);
      use(sh, iso); const coast = mk("g", { fill: T.ink, stroke: T.ink, "stroke-linejoin": "round" }, body); use(coast, iso);
      const fl = use(mk("g", { fill: land }, body), iso), line = mk("g", { fill: "none", stroke: T.ink, "stroke-linejoin": "round" }, body); use(line, iso);
      const F = { p: 0, c: ce, sh, body, coast, line }; focuses.push(F);
      tl.set(g, { opacity: 1 }, t);
      run(t, d, "back.out(1.7)", (p) => { F.p = p; });
      tl.fromTo(fl.parentNode, { fill: land }, { fill: col, duration: d * 0.8, ease: "power2.out", immediateRender: false }, t);
      if (f.dim !== false) tl.fromTo(fillsG, { fill: land }, { fill: mix(land, T.bg, f.dimAmt == null ? 0.3 : f.dimAmt), duration: d, ease: "power2.out", immediateRender: false }, t);
      if (f.label !== false) M.label(iso, t + d * 0.6, { text: f.label === true || f.label == null ? G.countries[iso].n : f.label, dx: f.dx, dy: f.dy, size: 40 });
      return M;
    };
    M.clear = (t, d) => { d = d || 0.4; const kids = Array.from(ov.children).concat(Array.from(topG.children)); if (kids.length) tl.to(kids, { opacity: 0, duration: d, ease: "power2.in" }, t); tl.to(fillsG, { fill: land, duration: d }, t); return M; };
    M.label = (where, t, l) => {
      l = l || {}; const p = pt(where), a = anchor(p[0], p[1]), w = mk("g", { transform: `translate(${l.dx || 0} ${l.dy || 0})` }, a.g), inner = O0(hide(mk("g", {}, w)));
      chip(inner, l.text || (typeof where === "string" ? title(where) : ""), l); pop(inner, t, 0.26); return M;
    };
    M.pin = (where, t, p) => {
      p = p || {}; const xy = pt(where), a = anchor(xy[0], xy[1]), k = p.size || 1.3, inner = hide(mk("g", {}, a.g));
      const sh = O0(mk("ellipse", { cx: 5, cy: 2, rx: 16 * k, ry: 5.5 * k, fill: T.shadow }, inner));
      const body = O0(mk("g", {}, inner)); mk("path", { d: "M0 0C-5 -13 -20 -24 -20 -40a20 20 0 1 1 40 0C20 -24 5 -13 0 0z", transform: `scale(${k})`, fill: p.color || T.marker, stroke: T.ink, "stroke-width": 4.5 / k, "stroke-linejoin": "round" }, body);
      mk("circle", { cx: 0, cy: -40 * k, r: 7.5 * k, fill: T.ink }, body);
      tl.set(inner, { opacity: 1 }, t);
      tl.fromTo(sh, { scale: 0.2 }, { scale: 1, duration: 0.22, ease: "power2.in", immediateRender: false }, t);
      tl.fromTo(body, { y: -170, scaleX: 0.9, scaleY: 1.12 }, { y: 0, scaleX: 1, scaleY: 1, duration: 0.22, ease: "power3.in", immediateRender: false }, t);
      tl.to(body, { scaleX: 1.22, scaleY: 0.72, duration: 0.06, ease: "power2.out" }, t + 0.22);
      tl.to(body, { scaleX: 1, scaleY: 1, y: -22 * k, duration: 0.13, ease: "power2.out" }, t + 0.28);
      tl.to(body, { y: 0, duration: 0.11, ease: "power2.in" }, t + 0.41);
      tl.to(body, { scaleX: 1.1, scaleY: 0.88, duration: 0.05 }, t + 0.52); tl.to(body, { scaleX: 1, scaleY: 1, duration: 0.12, ease: "back.out(3)" }, t + 0.57);
      if (p.label !== false) { const side = p.side || "r", lt = p.label || title(where), wrap = mk("g", {}, a.g), c0 = chip(wrap, lt, { size: p.fs || 34 }), inn = c0.g;
        const ox = { r: c0.w / 2 + 26 * k, l: -c0.w / 2 - 26 * k, t: 0, b: 0 }[side], oy = { r: -38 * k, l: -38 * k, t: -92 * k - c0.h / 2, b: c0.h / 2 + 18 }[side];
        wrap.setAttribute("transform", `translate(${(p.dx || 0) + ox} ${(p.dy || 0) + oy})`); hide(inn); O0(inn); pop(inn, t + 0.5, 0.26); }
      return M;
    };
    const arcPts = (a, b, bend) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), c = [(a[0] + b[0]) / 2 - dy * bend, (a[1] + b[1]) / 2 + dx * bend], out = [];
      for (let i = 0; i <= 90; i++) { const u = i / 90, v = 1 - u; out.push([v * v * a[0] + 2 * u * v * c[0] + u * u * b[0], v * v * a[1] + 2 * u * v * c[1] + u * u * b[1]]); } return out; };
    const rings = (where, t, n, col) => { const xy = pt(where), a = anchor(xy[0], xy[1]), g = mk("g", {}, a.g), base = O0(mk("circle", { r: 9, fill: col || T.marker, stroke: T.ink, "stroke-width": 4.5, opacity: 0 }, g));
      tl.fromTo(base, { scale: 0, opacity: 1 }, { scale: 1, opacity: 1, duration: 0.25, ease: "back.out(3)", immediateRender: false }, t);
      [0, 0.32].forEach((dl) => { const r = O0(mk("circle", { r: 14, fill: "none", stroke: T.ink, "stroke-width": 4, opacity: 0 }, g));
        tl.fromTo(r, { scale: 0.5, opacity: 1 }, { scale: 2.6, opacity: 0, duration: 0.9, ease: "power1.out", repeat: n, repeatDelay: 0.15, immediateRender: false }, t + 0.2 + dl); }); };
    function makeArc(from, to, t, r) {
      r = r || {}; const A = { pts: arcPts(pt(from), pt(to), r.bend == null ? 0.22 : r.bend), p: 0, q: 0, off: 0, dotOn: 0, dots: [] }, col = r.color || T.marker;
      A.g = mk("g", { "stroke-linecap": "round" }, topG); A.sh = mk("path", { fill: "none", stroke: T.shadow }, A.g); A.ln = mk("path", { fill: "none", stroke: T.ink }, A.g);
      A.ahs = mk("polygon", { fill: T.shadow, stroke: T.shadow, "stroke-linejoin": "round" }, A.g); A.ah = mk("polygon", { fill: col, stroke: T.ink, "stroke-linejoin": "round" }, A.g);
      for (let i = 0; i < (r.dots || 1); i++) { const D = mk("g", { style: "display:none" }, A.g); mk("circle", { fill: T.shadow, stroke: T.shadow }, D); mk("circle", { fill: col, stroke: T.ink }, D); A.dots.push(D); }
      arcs.push(A); const d = r.dur || 1.1;
      tl.to(A, { p: 1, duration: d, ease: "power2.inOut", immediateRender: false, onUpdate: draw, onComplete: draw, onReverseComplete: draw }, t);
      const loops = r.loops || 2, per = r.per || 1.4;
      tl.to(A, { off: 15 * 6 * (d + loops * per), duration: d + loops * per, ease: "none", immediateRender: false, onUpdate: draw }, t);
      tl.set(A, { dotOn: 1 }, t + d);
      tl.to(A, { q: 1, duration: per, ease: "none", repeat: loops - 1, immediateRender: false, onUpdate: draw, onComplete: () => { A.q = 0.999; draw(); } }, t + d);
      return A;
    }
    M.route = (from, to, t, r) => { r = r || {}; makeArc(from, to, t, r); const n = r.rings == null ? 1 : r.rings; rings(from, t, n); rings(to, t + (r.dur || 1.1) * 0.9, n);
      if (r.labels !== false) { if (r.fromLabel !== "") M.label(from, t + 0.1, { text: r.fromLabel || (typeof from === "string" ? title(from) : ""), dy: -50 }); M.label(to, t + (r.dur || 1.1), { text: r.toLabel || (typeof to === "string" ? title(to) : ""), dy: -50 }); } return M; };
    M.tradeFlow = (hub, targets, t, r) => { r = r || {}; targets.forEach((tg, i) => { const at = t + i * (r.gap || 0.28); makeArc(hub, tg, at, { dur: 0.9, bend: i % 2 ? -0.2 : 0.2, loops: r.loops || 2, per: r.per || 1.3, dots: 2 }); rings(tg, at + 0.8, 0);
      if (r.labels !== false) M.label(tg, at + 0.9, { text: typeof tg === "string" ? title(tg) : "", dy: -48, size: 26 }); }); rings(hub, t, 0); return M; };
    M.choropleth = (data, t, c) => {
      c = c || {}; const keys = Object.keys(data).sort((a, b) => data[a] - data[b]), vals = keys.map((k) => data[k]), lo = Math.min(...vals), hi = Math.max(...vals);
      const ramp = c.ramp || [T.pale, mix(T.pale, T.marker, 0.5), T.marker, mix(T.marker, T.deep, 0.5), T.deep];
      const cls = (v) => clamp(Math.floor(((v - lo) / (hi - lo || 1)) * 5), 0, 4), gap = c.stagger || 0.3, unit = c.unit || "";
      keys.forEach((k, i) => { const at = t + i * gap, e = fillUse[k.toUpperCase()]; tl.fromTo(e, { fill: land }, { fill: ramp[cls(data[k])], duration: 0.3, ease: "power2.out", immediateRender: false }, at);
        if (c.values !== false) { const ce = G.countries[k.toUpperCase()].c, a = anchor(ce[0], ce[1]), w = mk("g", { transform: `translate(${(c.off && c.off[k]) ? c.off[k][0] : 0} ${(c.off && c.off[k]) ? c.off[k][1] : 0})` }, a.g), inn = O0(hide(mk("g", {}, w)));
          chip(inn, (c.fmt ? c.fmt(data[k]) : data[k]) + unit, { size: 30 }); pop(inn, at + 0.1, 0.25); } });
      const lx = c.legendX == null ? 48 : c.legendX, ly = c.legendY == null ? H - 120 : c.legendY, lgw = mk("g", { transform: `translate(${lx} ${ly - 40}) scale(1.4)` }, ov), lg = O0(hide(mk("g", {}, lgw))), lw = Math.max(5 * 46 + 34, (c.title || '').length * 15 + 36);
      mk("rect", { x: 4, y: 4, width: lw, height: 92, rx: 12, fill: T.shadow }, lg); mk("rect", { width: lw, height: 92, rx: 12, fill: T.paper, stroke: T.ink, "stroke-width": 4 }, lg);
      const tt = mk("text", { x: 18, y: 30, "font-family": "Anton,Impact,sans-serif", "font-size": 24, "letter-spacing": 0.8, fill: T.ink }, lg); tt.textContent = (c.title || "").toUpperCase();
      ramp.forEach((col, i) => mk("rect", { x: 18 + i * 46, y: 42, width: 44, height: 24, fill: col, stroke: T.ink, "stroke-width": 3 }, lg));
      [["LOW " + lo + unit, 18, "start"], ["HIGH " + hi + unit, 18 + 5 * 46 - 2, "end"]].forEach((q) => { const e = mk("text", { x: q[1], y: 86, "text-anchor": q[2], "font-family": "Anton,Impact,sans-serif", "font-size": 20, fill: T.ink }, lg); e.textContent = q[0]; }); tl.set(lg, { opacity: 1 }, t); tl.fromTo(lg, { scale: 0.6, y: 20 }, { scale: 1, y: 0, duration: 0.3, ease: "back.out(2)", immediateRender: false }, t); return M;
    };
    M.count = (where, n, t, c) => {
      c = c || {}; const xy = pt(where), a = anchor(xy[0], xy[1]);
      let DX = c.dx, DY = c.dy == null ? -60 : c.dy, EX = 0; const wd0 = Math.max(200, ((c.prefix || "") + Math.round(n).toLocaleString("en-US") + (c.suffix || "")).length * 40 + 44), cc = typeof where === "string" && G.countries[where.toUpperCase()];
      if (cc && DX == null) { // auto-place on the side with free room; stem ends inside the outline, away from the label
        const cam = M._next || fit(v0, o.pad), sc = cam.w / W, b = cc.b, sx = (xy[0] - (cam.cx - cam.w / 2)) / sc, rx = (b[2] - xy[0]) / sc, lx = (xy[0] - b[0]) / sc, side = W - (sx + rx) >= sx - lx ? 1 : -1, e = side > 0 ? rx : lx;
        DX = side * (e + 34 + wd0 / 2); DX = clamp(DX, -(sx - wd0 / 2 - 24), W - sx - wd0 / 2 - 24); EX = side * Math.max(e * 0.6, 90);
      } else if (DX == null) { DX = 70; DY = c.dy == null ? -90 : c.dy; }
      const w = mk("g", { transform: `translate(${DX} ${DY})` }, a.g), inn = O0(hide(mk("g", {}, w))), fmt = (v) => (c.prefix || "") + Math.round(v).toLocaleString("en-US") + (c.suffix || "");
      const wd = Math.max(200, fmt(n).length * 40 + 44), hh = c.label ? 148 : 84; mk("line", { x1: 0, y1: 0, x2: EX - DX, y2: -DY, stroke: T.ink, "stroke-width": 4, "stroke-linecap": "round" }, inn);
      mk("circle", { cx: EX - DX, cy: -DY, r: 8, fill: T.ink }, inn);
      const st = mk("g", { transform: `rotate(${c.tilt == null ? -4 : c.tilt})` }, inn);
      mk("rect", { x: -wd / 2 + 6, y: -hh / 2 + 6, width: wd, height: hh, rx: 14, fill: T.shadow }, st); mk("rect", { x: -wd / 2, y: -hh / 2, width: wd, height: hh, rx: 14, fill: T.marker, stroke: T.ink, "stroke-width": 5 }, st);
      const num = mk("text", { x: 0, y: c.label ? -28 : 2, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Anton,Impact,sans-serif", "font-size": 58, fill: T.ink }, st); num.textContent = fmt(0);
      if (c.label) { const lb = mk("text", { x: 0, y: 48, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Anton,Impact,sans-serif", "font-size": 24, "letter-spacing": 1, fill: T.ink }, st); lb.textContent = String(c.label).toUpperCase(); }
      pop(inn, t, 0.3); const s = { v: 0 }; tl.to(s, { v: n, duration: c.dur || 0.9, ease: "power2.out", immediateRender: false, onUpdate: () => { num.textContent = fmt(s.v); }, onComplete: () => { num.textContent = fmt(n); }, onReverseComplete: () => { num.textContent = fmt(0); } }, t + 0.1); return M;
    };
    draw();
    return M;
  };
  root.Maps = Maps;
})(this);
