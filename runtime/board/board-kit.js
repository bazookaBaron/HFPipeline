/* runtime/board/board-kit.js: "diagram board" mode. ONE persistent paper card (poster theme) on the hue bg; parts are drawn on with stroke-dashoffset, flat fills land after the
 * outline, old parts dim, a camera (pan/zoom of the board content inside the fixed card) frames the narrated subject, B.pull() shows the whole board again. Docs: runtime/BOARD.md.
 * Everything is a PURE FUNCTION of the timeline clock (state records + redraw(t)): no tweens on parts, no Math.random/Date/rAF/CSS animation, any seek order gives the same frame.
 * Colours only via theme CSS vars (ink paper pale deep bg shadow marker alert dot). Labels are DOM (Anton / Inter), never SVG text.
 */
(function (root) {
  const B = {}, NS = "http://www.w3.org/2000/svg", TOK = (c) => "var(--" + c + ")";
  const css = `
.bd-bg{position:absolute;inset:0;background-image:radial-gradient(circle at center,var(--dot) 0 2px,transparent 2.6px);background-size:40px 40px}
.bd-card{position:absolute;box-sizing:border-box;background:var(--paper);border:6px solid var(--ink);border-radius:26px;box-shadow:10px 10px 0 var(--shadow);overflow:hidden}
.bd-world{position:absolute;left:0;top:0;transform-origin:0 0}.bd-svg{position:absolute;left:0;top:0;overflow:visible}
.bd-t{position:absolute;visibility:hidden;font:400 44px/1.04 Anton,sans-serif;letter-spacing:.04em;color:var(--ink);text-transform:uppercase;text-align:center;white-space:nowrap}
.bd-chip{position:absolute;visibility:hidden;font:400 40px/1 Anton,sans-serif;letter-spacing:.04em;color:var(--ink);background:var(--paper);border:6px solid var(--ink);border-radius:16px;box-shadow:8px 8px 0 var(--shadow);padding:10px 22px 6px;white-space:nowrap;text-transform:uppercase}
.bd-chip.marker{background:var(--marker)}.bd-chip.pale{background:var(--pale)}.bd-chip.ink{background:var(--ink);color:var(--paper)}.bd-chip.alert{background:var(--alert);color:var(--paper)}
.bd-card2{font:800 34px/1.15 Inter,sans-serif;border-radius:26px;box-shadow:10px 10px 0 var(--shadow);padding:20px 28px;text-transform:none;white-space:normal;text-align:left}
.bd-t.dim,.bd-chip.dim{color:var(--deep);border-color:var(--deep);box-shadow:none}.bd-chip.dim{background:var(--paper)}`;
  let tl, clock = { t: 0 }, DUR = 30, parts = {}, order = [], beats = [], keys = [], wob = 1.2, REEL = false, FW = 1920, FH = 1080, card, world, svg, G = {}, home, bw, bh, cam = { s: 1, cx: 0, cy: 0 };
  B.parts = parts; B.beats = beats; B.view = null; B.cam = () => cam;
  B.minFrac = { large: [0.06, 0.08], small: [0.015, 0.02] };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), e2 = (p) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p)), e3 = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const back = (p) => { const c = 2.0; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const jit = (id, i, a) => ((hash(id + ":" + i) % 2001) / 1000 - 1) * a;
  const r1 = (v) => Math.round(v * 10) / 10, f2 = (p) => r1(p[0]) + " " + r1(p[1]);
  const la = (e) => { e.setAttribute("data-layout-allow-overlap", ""); e.setAttribute("data-layout-allow-occlusion", ""); e.setAttribute("data-layout-allow-overflow", ""); return e; };
  const sv = (tag, at, par) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); par.appendChild(e); return e; };
  const div = (cls, html, x, y) => { const e = la(document.createElement("div")); e.className = cls; e.innerHTML = html; e.style.left = r1(x) + "px"; e.style.top = r1(y) + "px"; world.appendChild(e); return e; };
  const get = (id) => { const p = parts[id]; if (!p) throw new Error("board: unknown part " + id); return p; };
  const mkPart = (id, kind, bb, dd) => { if (parts[id]) throw new Error("board: duplicate part " + id); const p = (parts[id] = { id, kind, strokes: [], fills: [], chips: [], bb, dd: dd || 0.7, ev: {}, tier: "small", prog: 0 }); order.push(p); return p; };
  const grow = (p, x, y) => { p.bb = p.bb ? [Math.min(p.bb[0], x), Math.min(p.bb[1], y), Math.max(p.bb[2], x), Math.max(p.bb[3], y)] : [x, y, x, y]; };
  // stroke path (+ marker halo twin underneath). col: ink|alert|marker, w: px at zoom 1
  function stroke(p, d, o = {}) {
    const w = o.w || 6, col = o.col || "ink", s = { w, col, L: 0 };
    if (o.halo !== false && col !== "marker") { s.halo = sv("path", { d, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, G.halo); s.halo.style.stroke = TOK("marker"); s.halo.style.visibility = "hidden"; }
    s.el = sv("path", { d, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, o.under ? G.halo : G.stroke); s.el.style.visibility = "hidden"; s.el.style.stroke = TOK(col);
    s.L = (s.el.getTotalLength ? s.el.getTotalLength() : 600) || 1; p.strokes.push(s); return s;
  }
  function fillShape(p, d, col, o = {}) { const el = sv("path", { d }, G.fill); el.style.visibility = "hidden"; el.style.fill = TOK(col); const f = { el, col, cx: o.cx, cy: o.cy }; el.style.transformOrigin = f2([o.cx, o.cy]).replace(" ", "px ") + "px"; p.fills.push(f); return f; }
  const chipText = (p, txt, x, y, cls) => { const el = div(cls || "bd-t", String(txt).replace(/\n/g, "<br>"), x, y); const c = { el, x, y }; p.chips.push(c); return c; };
  const estW = (txt, px) => Math.max(...String(txt).split("\n").map((l) => l.length)) * px * 0.47;

  // ---------- shapes ----------
  const rrect = (x0, y0, x1, y1, r) => `M${r1(x0 + r)} ${r1(y0)}H${r1(x1 - r)}A${r} ${r} 0 0 1 ${r1(x1)} ${r1(y0 + r)}V${r1(y1 - r)}A${r} ${r} 0 0 1 ${r1(x1 - r)} ${r1(y1)}H${r1(x0 + r)}A${r} ${r} 0 0 1 ${r1(x0)} ${r1(y1 - r)}V${r1(y0 + r)}A${r} ${r} 0 0 1 ${r1(x0 + r)} ${r1(y0)}Z`;
  const ell = (cx, cy, rx, ry) => `M${r1(cx - rx)} ${r1(cy)}A${r1(rx)} ${r1(ry)} 0 1 1 ${r1(cx + rx)} ${r1(cy)}A${r1(rx)} ${r1(ry)} 0 1 1 ${r1(cx - rx)} ${r1(cy)}Z`;
  const shapeD = (sh, x, y, w, h) => (sh === "circle" ? ell(x, y, w / 2, h / 2) : rrect(x - w / 2, y - h / 2, x + w / 2, y + h / 2, sh === "pill" ? h / 2 : 18));
  const edge = (p, tx, ty, gap) => { const dx = tx - p.cx, dy = ty - p.cy, L = Math.hypot(dx, dy) || 1, k = p.shape === "circle" ? 1 / Math.hypot(dx / (p.w / 2), dy / (p.h / 2)) : Math.min(p.w / 2 / (Math.abs(dx) || 1e-9), p.h / 2 / (Math.abs(dy) || 1e-9)); return [p.cx + dx * k + (dx / L) * gap, p.cy + dy * k + (dy / L) * gap]; };

  // ---------- setup ----------
  B.timeline = () => gsap.timeline({ paused: true, onUpdate: () => B.redraw() });
  // o: {tl, W, H, dur, root?, wobble?}. LF 1920x1080: card left of the puppet zone (x<=1480); reel 1080x1920: card above the lower puppet zone (y<=1280).
  B.board = (o) => {
    tl = o.tl; DUR = o.dur; FW = o.W; FH = o.H; REEL = FH > FW; if (o.wobble != null) wob = o.wobble;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const host = o.root || document.getElementById("root"), c = REEL ? { x: 40, y: 60, w: 1000, h: 1210 } : { x: 50, y: 50, w: 1420, h: 980 };
    const bg = la(document.createElement("div")); bg.className = "bd-bg"; host.appendChild(bg);
    card = la(document.createElement("div")); card.className = "bd-card"; Object.assign(card.style, { left: c.x + "px", top: c.y + "px", width: c.w + "px", height: c.h + "px", zIndex: 3 }); host.appendChild(card);
    bw = c.w - 12; bh = c.h - 12; B.w = bw; B.h = bh; B.view = { x0: c.x + 6, y0: c.y + 6, x1: c.x + c.w - 6, y1: c.y + c.h - 6 };
    world = la(document.createElement("div")); world.className = "bd-world"; world.style.width = bw + "px"; world.style.height = bh + "px"; card.appendChild(world);
    svg = la(document.createElementNS(NS, "svg")); svg.setAttribute("class", "bd-svg"); svg.setAttribute("width", bw); svg.setAttribute("height", bh); world.appendChild(svg);
    ["halo", "shadow", "fill", "stroke"].forEach((k) => (G[k] = sv("g", {}, svg)));
    G.halo.style.cssText = ""; home = { s: 1, cx: bw / 2, cy: bh / 2 }; keys.push({ t: 0, c: home, r: 0 });
    const proto = Object.getPrototypeOf(tl).render;
    if (typeof proto === "function") tl.render = function () { const r = proto.apply(this, arguments); B.redraw(); return r; };
    tl.fromTo(clock, { t: 0 }, { t: DUR, duration: DUR, ease: "none" }, 0);
    return { w: bw, h: bh, reel: REEL, view: B.view };
  };

  // ---------- parts ----------
  B.node = (id, o) => {
    const lines = String(o.text || "").split("\n").length, h = o.h || (o.shape === "circle" ? 0 : 0) || 108 + (lines - 1) * 46, w = o.w || Math.round(estW(o.text || "", 44) + 84), shape = o.shape || "box", ww = shape === "circle" ? Math.max(w, h) : w, hh = shape === "circle" ? Math.max(w, h) : h;
    const p = mkPart(id, "node", [o.x - ww / 2, o.y - hh / 2, o.x + ww / 2, o.y + hh / 2]); Object.assign(p, { cx: o.x, cy: o.y, w: ww, h: hh, shape });
    const d = shapeD(shape, o.x, o.y, ww, hh); p.fillCol = o.fill || "pale";
    const sh = sv("path", { d: shapeD(shape, o.x + 9, o.y + 9, ww, hh) }, G.shadow); sh.style.visibility = "hidden"; sh.style.fill = TOK("shadow"); sh.style.transformOrigin = o.x + "px " + o.y + "px"; p.shadow = sh;
    fillShape(p, d, p.fillCol, { cx: o.x, cy: o.y }); stroke(p, d, { w: 6, halo: true });
    if (o.text != null) chipText(p, o.text, o.x, o.y, "bd-t").center = true;
    return id;
  };
  const resolve = (x) => (Array.isArray(x) ? { cx: x[0], cy: x[1], w: 0, h: 0, shape: "circle" } : get(x));
  B.arrow = (id, from, to, o = {}) => {
    const A = resolve(from), Z = resolve(to), gap = o.gap == null ? 12 : o.gap;
    const mid = [(A.cx + Z.cx) / 2, (A.cy + Z.cy) / 2], dx = Z.cx - A.cx, dy = Z.cy - A.cy, L = Math.hypot(dx, dy) || 1, cv = o.curve || 0;
    const c = o.ctrl || [mid[0] - (dy / L) * L * cv + jit(id, 0, wob * 3), mid[1] + (dx / L) * L * cv + jit(id, 1, wob * 3)];
    const a = edge(A, c[0], c[1], gap), b = edge(Z, c[0], c[1], gap + (o.head === false ? 0 : 6)), tx = b[0] - c[0], ty = b[1] - c[1], tl_ = Math.hypot(tx, ty) || 1, ux = tx / tl_, uy = ty / tl_, hs = 30, ca = Math.cos(0.5), sa = Math.sin(0.5);
    const h1 = [b[0] - hs * (ux * ca - uy * sa), b[1] - hs * (uy * ca + ux * sa)], h2 = [b[0] - hs * (ux * ca + uy * sa), b[1] - hs * (uy * ca - ux * sa)];
    let d = `M${f2(a)}Q${f2(c)} ${f2(b)}`; if (o.head !== false) d += `M${f2(h1)}L${f2(b)}L${f2(h2)}`;
    const qs = []; for (let i = 0; i <= 12; i++) { const u = i / 12, v = 1 - u; qs.push([v * v * a[0] + 2 * u * v * c[0] + u * u * b[0], v * v * a[1] + 2 * u * v * c[1] + u * u * b[1]]); } if (o.head !== false) qs.push(h1, h2);
    const p = mkPart(id, "arrow", [Math.min(...qs.map((q) => q[0])) - 12, Math.min(...qs.map((q) => q[1])) - 12, Math.max(...qs.map((q) => q[0])) + 12, Math.max(...qs.map((q) => q[1])) + 12]); p.dd = 0.8; stroke(p, d, { w: o.w || 6 });
    return id;
  };
  // cycle of N nodes on an ellipse with curved arrows between them. o:{cx,cy,rx,ry|r,texts[],w,h,shape,fill,start,push}; existing node ids are reused.
  B.loop = (ids, o) => {
    const n = ids.length, rx = o.rx || o.r, ry = o.ry || o.r, st = o.start == null ? -90 : o.start, push = o.push || 1.28, arrows = [];
    ids.forEach((id, i) => { if (!parts[id]) { const a = ((st + (360 * i) / n) * Math.PI) / 180; B.node(id, { x: o.cx + rx * Math.cos(a), y: o.cy + ry * Math.sin(a), text: o.texts ? o.texts[i] : id, w: o.w, h: o.h, shape: o.shape, fill: o.fill }); } });
    ids.forEach((id, i) => { const j = (i + 1) % n, a = ((st + (360 * (i + 0.5)) / n) * Math.PI) / 180; arrows.push(B.arrow(id + ">" + ids[j], id, ids[j], { ctrl: [o.cx + rx * push * Math.cos(a), o.cy + ry * push * Math.sin(a)] })); });
    return { nodes: ids.slice(), arrows, ids: ids.concat(arrows) };
  };
  const dbl = (p, d, inkW, hw) => { stroke(p, d, { w: hw, col: "marker", halo: false }); stroke(p, d, { w: inkW, halo: false }); };
  B.underline = (id, target, o = {}) => {
    const t = get(target), y = o.y != null ? o.y : t.cy + (t.kind === "node" ? 38 : 0), x0 = (o.x0 != null ? o.x0 : t.bb[0] + 26), x1 = o.x1 != null ? o.x1 : t.bb[2] - 26;
    const p = mkPart(id, "underline", [x0 - 10, y - 14, x1 + 10, y + 14], 0.5); const j = (i) => jit(id, i, wob * 2.5);
    dbl(p, `M${r1(x0)} ${r1(y + j(0))}Q${r1((x0 + x1) / 2)} ${r1(y + 8 + j(1))} ${r1(x1)} ${r1(y + j(2))}`, 5, 20); return id;
  };
  B.ring = (id, target, o = {}) => {
    const t = get(target), cx = (t.bb[0] + t.bb[2]) / 2, cy = (t.bb[1] + t.bb[3]) / 2, rx = (t.bb[2] - t.bb[0]) / 2 + (o.pad || 26), ry = (t.bb[3] - t.bb[1]) / 2 + (o.pad || 26), nm = o.name || id;
    const p = mkPart(nm, "ring", [cx - rx - 8, cy - ry - 8, cx + rx + 8, cy + ry + 8], 0.6); let d = "";
    for (let i = 0; i <= 56; i++) { const q = i / 56, a = (-1.9 + q * 6.6), k = 1 + 0.045 * q + jit(nm, i % 9, wob * 0.004); d += (i ? "L" : "M") + f2([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]); }
    dbl(p, d, 5, 18); return nm;
  };
  B.cross = (id, target, o = {}) => {
    const t = Array.isArray(target) ? { cx: target[0], cy: target[1], w: 200, h: 200 } : get(target), c = [t.cx + (o.dx || 0), t.cy + (o.dy || 0)], s = o.size || Math.min(t.w, t.h) * 0.42, nm = o.name || id;
    const p = mkPart(nm, "cross", [c[0] - s - 8, c[1] - s - 8, c[0] + s + 8, c[1] + s + 8], 0.45);
    stroke(p, `M${f2([c[0] - s, c[1] - s + jit(nm, 0, wob)])}L${f2([c[0] + s, c[1] + s])}M${f2([c[0] + s, c[1] - s])}L${f2([c[0] - s, c[1] + s + jit(nm, 1, wob)])}`, { w: 11, col: "alert", halo: false }); return nm;
  };
  B.check = (id, target, o = {}) => {
    const t = Array.isArray(target) ? { cx: target[0], cy: target[1], w: 200, h: 200 } : get(target), c = [t.cx + (o.dx || 0), t.cy + (o.dy || 0)], s = o.size || Math.min(t.w, t.h) * 0.4, nm = o.name || id;
    const p = mkPart(nm, "check", [c[0] - s - 12, c[1] - s - 12, c[0] + s + 12, c[1] + s + 12], 0.45); dbl(p, `M${f2([c[0] - s, c[1]])}L${f2([c[0] - s * 0.3, c[1] + s * 0.7])}L${f2([c[0] + s, c[1] - s * 0.8])}`, 8, 22); return nm;
  };
  B.label = (id, text, o) => { const p = mkPart(id, "label", [o.x, o.y, o.x, o.y], 0.01); const c = chipText(p, text, o.x, o.y, "bd-chip" + (o.fill ? " " + o.fill : "") + (o.card ? " bd-card2" : "")); c.center = true; if (o.card) c.el.style.width = (o.w || 420) + "px"; const r = c.el.getBoundingClientRect(); void r; p.bb = [o.x - 120, o.y - 34, o.x + 120, o.y + 34]; if (o.w) p.bb = [o.x - o.w / 2, o.y - 34, o.x + o.w / 2, o.y + 34]; return id; };
  B.bracket = (id, ids, text, o = {}) => {
    const bb = ids.map((i) => get(i).bb).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]), side = o.side || "bottom", off = o.off || 34, k = 16, p = mkPart(id, "bracket", null, 0.7); p.tier = "large"; let d, lx, ly;
    if (side === "bottom" || side === "top") { const y = side === "bottom" ? bb[3] + off : bb[1] - off, s = side === "bottom" ? -1 : 1; d = `M${f2([bb[0], y + s * k])}Q${f2([bb[0], y])} ${f2([bb[0] + k, y])}H${r1(bb[2] - k)}Q${f2([bb[2], y])} ${f2([bb[2], y + s * k])}`; lx = (bb[0] + bb[2]) / 2; ly = y - s * 52; grow(p, bb[0], y - 6); grow(p, bb[2], y + 6); }
    else { const x = side === "right" ? bb[2] + off : bb[0] - off, s = side === "right" ? -1 : 1; d = `M${f2([x + s * k, bb[1]])}Q${f2([x, bb[1]])} ${f2([x, bb[1] + k])}V${r1(bb[3] - k)}Q${f2([x, bb[3]])} ${f2([x + s * k, bb[3]])}`; lx = x - s * -120 * (side === "right" ? -1 : -1) * 0 + (side === "right" ? 130 : -130); ly = (bb[1] + bb[3]) / 2; grow(p, x - 6, bb[1]); grow(p, x + 6, bb[3]); }
    stroke(p, d, { w: 7 }); if (text) { const c = chipText(p, text, lx, ly, "bd-chip marker"); c.center = true; grow(p, lx - estW(text, 40) / 2 - 30, ly - 34); grow(p, lx + estW(text, 40) / 2 + 30, ly + 34); } return id;
  };
  B.axis = (id, o) => {
    const { x, y, w, h } = o, p = mkPart(id, "axis", [x - 20, y - h - 24, x + w + 24, y + 24], 0.9); p.tier = "large"; p.rect = o;
    stroke(p, `M${r1(x)} ${r1(y - h)}V${r1(y)}H${r1(x + w)}M${f2([x - 14, y - h + 20])}L${f2([x, y - h])}L${f2([x + 14, y - h + 20])}M${f2([x + w - 20, y - 14])}L${f2([x + w, y])}L${f2([x + w - 20, y + 14])}`, { w: 6, halo: false });
    if (o.xl) { const c = chipText(p, o.xl, x + w - 60, y + 54, "bd-chip pale"); c.center = true; grow(p, x + w - 200, y + 20); grow(p, x + w, y + 90); }
    if (o.yl) { const c = chipText(p, o.yl, x + 70, y - h - 34, "bd-chip pale"); c.center = true; grow(p, x - 20, y - h - 70); grow(p, x + 200, y - h); }
    return id;
  };
  // pts: [[0..1,0..1],...] mapped into axis rect (inset); smooth Catmull-Rom line, drawn on
  B.curve = (id, pts, o = {}) => {
    const r = typeof o.axis === "string" ? get(o.axis).rect : o.axis, ins = 24, X = (u) => r.x + ins + u * (r.w - 2 * ins), Y = (v) => r.y - ins - v * (r.h - 2 * ins), q = pts.map((a, i) => [X(a[0]) + jit(id, i, wob), Y(a[1]) + jit(id, i + 40, wob)]);
    let d = "M" + f2(q[0]); for (let i = 0; i < q.length - 1; i++) { const p0 = q[Math.max(0, i - 1)], p1 = q[i], p2 = q[i + 1], p3 = q[Math.min(q.length - 1, i + 2)]; d += `C${f2([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${f2([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${f2(p2)}`; }
    const p = mkPart(id, "curve", [Math.min(...q.map((a) => a[0])) - 12, Math.min(...q.map((a) => a[1])) - 12, Math.max(...q.map((a) => a[0])) + 12, Math.max(...q.map((a) => a[1])) + 12], 1.2); p.tier = "large"; stroke(p, d, { w: o.w || 8, col: o.col || "ink" }); return id;
  };
  const ICONS = (P, k) => {
    const c = (x, y, rr) => ell(...P(x, y), rr * k, rr * k), m = (x, y) => "M" + f2(P(x, y)), l = (x, y) => "L" + f2(P(x, y));
    return {
      coin: [{ d: c(50, 50, 42), fill: "marker" }, { d: c(50, 50, 27) }, { d: m(50, 36) + l(50, 64) }],
      person: [{ d: c(50, 28, 19), fill: "pale" }, { d: m(14, 94) + "Q" + f2(P(14, 56)) + " " + f2(P(50, 56)) + "Q" + f2(P(86, 56)) + " " + f2(P(86, 94)) + "Z", fill: "pale" }],
      doc: [{ d: m(22, 8) + l(60, 8) + l(80, 28) + l(80, 94) + l(22, 94) + "Z", fill: "paper" }, { d: m(60, 8) + l(60, 28) + l(80, 28) }, { d: m(34, 50) + l(68, 50) + m(34, 64) + l(68, 64) + m(34, 78) + l(54, 78) }],
      gear: [{ d: (() => { let s = ""; for (let i = 0; i < 8; i++) { const a = (i * 45 * Math.PI) / 180, w = (13 * Math.PI) / 180, pt = (rr, da) => P(50 + rr * Math.cos(a + da), 50 + rr * Math.sin(a + da)); s += (i ? "L" : "M") + f2(pt(33, -w * 1.5)) + "L" + f2(pt(45, -w * 0.8)) + "L" + f2(pt(45, w * 0.8)) + "L" + f2(pt(33, w * 1.5)); } return s + "Z"; })(), fill: "pale" }, { d: c(50, 50, 13) }],
      bulb: [{ d: m(34, 64) + "C" + f2(P(14, 48)) + " " + f2(P(20, 10)) + " " + f2(P(50, 8)) + "C" + f2(P(80, 10)) + " " + f2(P(86, 48)) + " " + f2(P(66, 64)) + "Z", fill: "marker" }, { d: m(36, 64) + l(36, 80) + l(64, 80) + l(64, 64) }, { d: m(42, 92) + l(58, 92) }],
    };
  };
  B.icon = (id, kind, o) => {
    const s = o.size || 120, k = s / 100, ox = o.x - s / 2, oy = o.y - s / 2, P = (x, y) => [ox + x * k, oy + y * k], sh = ICONS(P, k)[kind]; if (!sh) throw new Error("board: icon " + kind);
    const p = mkPart(id, "icon", [ox - 6, oy - 6, ox + s + 6, oy + s + 6], 0.8); p.auto = true;
    sh.forEach((q) => { if (q.fill) fillShape(p, q.d, q.fill, { cx: o.x, cy: o.y }); }); sh.forEach((q) => stroke(p, q.d, { w: 5, halo: false })); return id;
  };

  // ---------- verbs (tl accepted for API symmetry; state is clock-driven) ----------
  const L = (ids) => [].concat(ids);
  B.draw = (tl_, id, t, dur) => L(id).forEach((i) => { const p = get(i); if (p.ev.draw) throw new Error("board: part drawn twice " + i); p.ev.draw = { t, d: dur || p.dd }; });
  B.fill = (tl_, id, t, color) => L(id).forEach((i) => { const p = get(i); p.ev.fill = { t }; if (color) { p.fillCol = color; p.fills.forEach((f) => { f.col = color; }); } });
  B.dim = (tl_, ids, t) => L(ids).forEach((i) => { get(i).ev.dim = t; });
  B.hide = (tl_, ids, t) => L(ids).forEach((i) => { get(i).ev.hide = t; });
  const unionBB = (ids) => L(ids).map((i) => get(i).bb).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  // camera frames the subject (id | [ids]) from t0 to t1; ramps in over o.ramp (default 1.2 s) BEFORE t0, so be fully drawn by t0.
  B.focus = (tl_, ids, t0, t1, o = {}) => {
    ids = L(ids); const bb = unionBB(ids), sw = bb[2] - bb[0] + (o.pad || 0), sh = bb[3] - bb[1] + (o.pad || 0), grp = ids.length > 1 || ids.some((i) => get(i).tier === "large"), tier = o.tier || (grp ? "large" : "small");
    const mf = B.minFrac[tier][REEL ? 1 : 0], need = Math.sqrt((1.3 * mf * FW * FH) / (sw * sh)), fit = Math.min((0.8 * bw) / sw, (0.8 * bh) / sh), s = Math.min(Math.max(need, o.zoom || 1.12), fit, o.max || 2.4);
    const cx = clamp((bb[0] + bb[2]) / 2 + (o.dx || 0), bw / (2 * s), bw - bw / (2 * s)), cy = clamp((bb[1] + bb[3]) / 2 + (o.dy || 0), bh / (2 * s), bh - bh / (2 * s)), c = { s, cx, cy }, r = o.ramp || 1.2;
    keys.push({ t: t0, c, r }, { t: t1, c, r: 0 }); beats.push({ id: ids.join("+"), ids, t0, t1, tier, s, need }); if (s < need - 1e-6) console.warn("board: zoom capped for " + ids.join("+") + " need " + need.toFixed(2) + " got " + s.toFixed(2));
  };
  B.pull = (tl_, t, o = {}) => { const r = (o && o.d) || 1.2; keys.push({ t: t + r, c: home, r }); };

  // ---------- state: pure function of t ----------
  function camAt(t) {
    const ks = keys.slice().sort((a, b) => a.t - b.t); let i = -1; for (let q = 0; q < ks.length; q++) if (ks[q].t <= t) i = q;
    if (i < 0) return home; const a = ks[i], b = ks[i + 1]; if (!b) return a.c; const rs = Math.max(a.t, b.t - b.r); if (t <= rs || b.t <= rs) return a.c;
    const u = e3(clamp((t - rs) / (b.t - rs), 0, 1)); return { s: Math.exp(Math.log(a.c.s) * (1 - u) + Math.log(b.c.s) * u), cx: a.c.cx + (b.c.cx - a.c.cx) * u, cy: a.c.cy + (b.c.cy - a.c.cy) * u };
  }
  const focused = (p, t) => beats.some((b) => t >= b.t0 - 0.05 && t <= b.t1 + 0.25 && b.ids.includes(p.id));
  function paint(p, t) {
    const d = p.ev.draw; let prog = 0, chipU = 0;
    if (d) { prog = e3(clamp((t - d.t) / d.d, 0, 1)); chipU = clamp((t - (d.t + d.d * 0.85)) / 0.22, 0, 1); }
    const h = p.ev.hide; if (h != null && t >= h) { const u = e2(clamp((t - h) / 0.35, 0, 1)); prog = Math.min(prog, 1 - u); chipU = 0; }
    const dim = p.ev.dim != null ? clamp((t - p.ev.dim) / 0.4, 0, 1) : 0, dimOn = dim > 0.5, foc = !dimOn && focused(p, t) && prog > 0;
    const ft = p.ev.fill ? p.ev.fill.t : p.auto && d ? d.t + d.d : null, fu = ft == null || (h != null && t >= h) ? 0 : clamp((t - ft) / 0.26, 0, 1);
    const key = [prog.toFixed(4), chipU.toFixed(3), dim.toFixed(3), foc ? 1 : 0, fu.toFixed(3)].join();
    if (p._k === key) return; p._k = key; p.prog = prog;
    p.strokes.forEach((s) => {
      const vis = prog > 0.0005, e = s.el.style; e.visibility = vis ? "visible" : "hidden"; e.strokeWidth = r1(s.w * (1 - 0.42 * dim)); e.stroke = dimOn ? TOK("deep") : TOK(s.col);
      if (prog >= 0.9995) { e.strokeDasharray = "none"; e.strokeDashoffset = 0; } else { e.strokeDasharray = r1(s.L + 2); e.strokeDashoffset = r1(s.L * (1 - prog)); }
      if (s.halo) { const q = s.halo.style; q.visibility = foc && vis ? "visible" : "hidden"; q.strokeWidth = s.w + 18; if (prog >= 0.9995) { q.strokeDasharray = "none"; q.strokeDashoffset = 0; } else { q.strokeDasharray = r1(s.L + 2); q.strokeDashoffset = r1(s.L * (1 - prog)); } }
    });
    p.fills.forEach((f) => { const e = f.el.style, on = fu > 0 && prog > 0.02; e.visibility = on ? "visible" : "hidden"; e.fill = TOK(dimOn && (f.col === "marker" || f.col === "bg") ? "pale" : f.col); e.transform = "scale(" + r1(0.5 + 0.5 * back(fu)) + ")"; if (p.shadow) { const q = p.shadow.style, so = on && !dimOn; q.visibility = so ? "visible" : "hidden"; q.transform = e.transform; } });
    p.chips.forEach((c) => { const e = c.el, on = chipU > 0; e.style.visibility = on ? "visible" : "hidden"; e.style.transform = "translate(-50%,-50%) scale(" + r1(0.8 + 0.2 * back(chipU)) + ")"; e.classList.toggle("dim", dimOn); });
  }
  B.redraw = () => {
    if (!world) return; const t = clock.t; Object.assign(cam, camAt(t));
    world.style.transform = `translate(${r1(bw / 2 - cam.cx * cam.s)}px,${r1(bh / 2 - cam.cy * cam.s)}px) scale(${Math.round(cam.s * 10000) / 10000})`;
    order.forEach((p) => paint(p, t)); B.t = t;
  };
  // gate probe (screen-space, from the real DOM): bbox of the drawn geometry + chips of the subject, draw progress, share of the bbox covered by OTHER parts' chips
  B.probe = (ids) => {
    ids = L(ids); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, prog = 1; const mine = new Set(), g = (r, pad) => { x0 = Math.min(x0, r.left - pad); y0 = Math.min(y0, r.top - pad); x1 = Math.max(x1, r.right + pad); y1 = Math.max(y1, r.bottom + pad); };
    ids.forEach((i) => { const p = get(i); prog = Math.min(prog, p.prog); p.strokes.forEach((s) => s.el.style.visibility === "visible" && g(s.el.getBoundingClientRect(), (s.w * cam.s) / 2)); p.chips.forEach((c) => { mine.add(c.el); c.el.style.visibility === "visible" && g(c.el.getBoundingClientRect(), 0); }); });
    const A = Math.max(1, (x1 - x0) * (y1 - y0)); let ov = 0;
    order.forEach((p) => p.chips.forEach((c) => { if (mine.has(c.el) || c.el.style.visibility !== "visible") return; const r = c.el.getBoundingClientRect(), w = Math.min(x1, r.right) - Math.max(x0, r.left), h = Math.min(y1, r.bottom) - Math.max(y0, r.top); if (w > 0 && h > 0) ov += w * h; }));
    return { bb: [x0, y0, x1, y1], prog, occl: Math.min(1, ov / A), cam: Object.assign({}, cam) };
  };
  root.B = B; root.BOARD = B;
})(typeof window !== "undefined" ? window : globalThis);
