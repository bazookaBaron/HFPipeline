// DIALOGUE MG: deterministic iso world. SVG boxes (3 faces + edge), fixed azimuth, camera = pan/zoom of the view.
// Everything is a pure function of t (no clock, no random). Projection = hairline iso maths (MIT, (c) 2026 Lucas Marques; same
// formula as runtime/vendor/hairline/hl-geom.js proj(), inlined because that file is a global script, not an ES module).
// Usage inside a beat:  const w = b.iso({ t0: bt.at, cam:{x,y,z,zoom}, S:44 });  w.box('a',{x,y,z,w,d,h,color}); w.rise('a',at,.6); w.camTo(at,{x,y,z,zoom});
// All times passed to the verbs are GLOBAL seconds; render(t) is driven by a builder item with t0 + beat-local time.
import { clamp01, prog, ease, lerp, mixHex } from './motion.js';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, at = {}) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
const DEF = { grow: 1, solid: 1, ghost: 0, dz: 0, dx: 0, dy: 0, tint: 0 };
const EZ = { p2io: ease.p2io, p3out: ease.p3out, p2in: ease.p2in, linear: ease.linear, expoOut: ease.expoOut };
let ISO_N = 0;
export const EMBER = '#D65F2A';   // ONLY for the broken rack
export function createIsoWorld(b, o = {}) {
  const C = b.C, W = b.W, H = b.H, S0 = o.S ?? 44, K = o.k ?? .55, ZF = Math.sqrt(1 - K * K), CA = Math.SQRT1_2, t0 = o.t0 ?? 0, DR = o.drift ?? .015;
  const view = { x: W / 2, y: b.box.y + b.box.h / 2 + 6 };   // screen point the camera target maps to (middle of the card body)
  const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }); svg.style.cssText = 'position:absolute;left:0;top:0;overflow:hidden';
  const cid = 'isoclip' + (++ISO_N), defs = el('defs'), cp = el('clipPath', { id: cid }); cp.appendChild(el('rect', { x: b.box.x, y: b.box.y + 66, width: b.box.w, height: Math.max(0, b.box.h - 66 - 52) })); defs.appendChild(cp);   // world viewport = between the card's header and footer rules
  const gWorld = el('g', { 'clip-path': `url(#${cid})` }), gLead = el('g'); svg.append(defs, gWorld, gLead); b.media.appendChild(svg);
  const nodes = [], byId = {}, over = [], ink = C.ink, paper = C.paper;
  // ---- camera: eased travel to a target, then 1-2 % drift while holding ------------------------------------------------------------
  const cam0 = { x: 0, y: 0, z: 0, zoom: 1, ...(o.cam || {}) }, camKeys = [];
  const hold = (s, dt) => ({ ...s, zoom: s.zoom * (1 + DR * clamp01(dt / 4)) });
  function camAt(t) {
    let st = cam0, tEnd = camKeys.length ? camKeys[0].at : 0;
    for (const k of camKeys) {
      if (t < k.at) return hold(st, t - tEnd);
      if (t < k.at + k.d) { const f = hold(st, k.at - tEnd), p = k.ez(prog(t, k.at, k.at + k.d)); return { x: lerp(f.x, k.to.x, p), y: lerp(f.y, k.to.y, p), z: lerp(f.z, k.to.z, p), zoom: lerp(f.zoom, k.to.zoom, p) }; }
      st = k.to; tEnd = k.at + k.d;
    }
    return hold(st, t - tEnd);
  }
  const projFor = t => { const c = camAt(t), S = S0 * c.zoom, raw = (x, y, z) => [S * (x - y) * CA, S * ((x + y) * CA * K - z * ZF)]; const o0 = raw(c.x, c.y, c.z); return (x, y, z) => { const q = raw(x, y, z); return [view.x + q[0] - o0[0], view.y + q[1] - o0[1]]; }; };
  // ---- nodes: boxes and discs ------------------------------------------------------------------------------------------------------
  function add(id, n) { n.id = id; n.init = {}; n.keys = {}; n.gEl = el('g'); n.faces = [el('path'), el('path'), el('path')]; n.gh = el('path', { fill: 'none', 'stroke-dasharray': '7 6', 'stroke-width': 2, 'stroke-linejoin': 'round' }); n.gEl.append(...n.faces, n.gh); gWorld.appendChild(n.gEl); nodes.push(n); byId[id] = n; return n; }
  function val(n, prop, t) { const ks = n.keys[prop]; let v = n.init[prop] ?? DEF[prop]; if (!ks) return v; for (const k of ks) { if (t < k.at) return v; const f = k.from ?? v; if (t < k.at + k.dur) return lerp(f, k.to, k.ez(prog(t, k.at, k.at + k.dur))); v = k.to; } return v; }
  function geom(n, t) {
    if (n.type === 'disc') { const p = byId[n.on], pg = geom(p, t), r = n.r * val(n, 'grow', t), cx = (pg.x0 + pg.x1) / 2 + n.ox, cy = (pg.y0 + pg.y1) / 2 + n.oy; return { x0: cx - r, x1: cx + r, y0: cy - r, y1: cy + r, z0: pg.z1, z1: pg.z1, cx, cy, r, pv: pg.z1 - pg.z0 > .02 ? val(p, 'solid', t) : 0 }; }
    const gr = val(n, 'grow', t), dx = val(n, 'dx', t), dy = val(n, 'dy', t), dz = val(n, 'dz', t), z0 = n.z + dz;
    return { x0: n.x + dx, x1: n.x + dx + n.w, y0: n.y + dy, y1: n.y + dy + n.d, z0, z1: z0 + n.h * gr };
  }
  const f1 = v => v.toFixed(1), pt = p => f1(p[0]) + ',' + f1(p[1]);
  function draw(n, g, solid, gh, P, t) {
    if (n.type === 'disc') {
      const pts = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pts.push(P(g.cx + g.r * Math.cos(a), g.cy + g.r * Math.sin(a), g.z1)); }
      const f = n.faces[0]; f.setAttribute('d', 'M' + pts.map(pt).join('L') + 'Z'); f.setAttribute('fill', mixHex(ink, n.color, .5)); f.setAttribute('stroke', n.color); f.setAttribute('stroke-width', 1.5); n.faces[1].style.display = n.faces[2].style.display = 'none'; n.gh.style.display = 'none';
      const ang = n.spinAt == null || t < n.spinAt ? 0 : (t - n.spinAt) * n.rate, bl = [], q0 = P(g.cx, g.cy, g.z1);
      for (let k = 0; k < 4; k++) { const a = ang + k * Math.PI / 2, q1 = P(g.cx + g.r * .9 * Math.cos(a), g.cy + g.r * .9 * Math.sin(a), g.z1); bl.push(`M${pt(q0)}L${pt(q1)}`); }
      n.bl.setAttribute('d', bl.join('')); n.bl.setAttribute('stroke', n.color); n.gEl.style.opacity = (solid * g.pv).toFixed(3); return;
    }
    const c = n.keys.tint ? mixHex(n.color, n.tintColor, val(n, 'tint', t)) : n.color, edge = mixHex(c, ink, .62), { x0, x1, y0, y1, z0, z1 } = g;
    const top = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], lf = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], rt = [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)];
    [[top, mixHex(c, paper, .2)], [lf, c], [rt, mixHex(c, ink, .38)]].forEach(([q, fill], i) => { const f = n.faces[i]; f.style.display = solid > .003 ? '' : 'none'; f.setAttribute('d', 'M' + q.map(pt).join('L') + 'Z'); f.setAttribute('fill', fill); f.setAttribute('stroke', edge); f.style.opacity = solid.toFixed(3); });
    if (gh > .003) {   // dashed ghost wireframe at full height
      const zt = z0 + n.h, gt = [P(x0, y0, zt), P(x1, y0, zt), P(x1, y1, zt), P(x0, y1, zt)], gl = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, zt), P(x0, y1, zt)], gr = [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, zt), P(x1, y0, zt)];
      n.gh.style.display = ''; n.gh.setAttribute('d', [gt, gl, gr].map(q => 'M' + q.map(pt).join('L') + 'Z').join('')); n.gh.setAttribute('stroke', n.ghostColor); n.gh.style.opacity = gh.toFixed(3);
    } else n.gh.style.display = 'none';
  }
  // painter order: topological sort on separating axes (A is behind B when A ends before B starts along x, y or z), ties by depth key
  let lastSig = '';
  function order(es) {
    const E = 1e-6, behind = (a, c) => a.x1 <= c.x0 + E || a.y1 <= c.y0 + E || a.z1 <= c.z0 + E, n = es.length;
    es.sort((a, c) => (a.g.x0 + a.g.y0 + a.g.z0 * .5) - (c.g.x0 + c.g.y0 + c.g.z0 * .5));
    const ind = Array(n).fill(0), out = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && behind(es[i].g, es[j].g) && !behind(es[j].g, es[i].g)) { out[i].push(j); ind[j]++; }
    const done = Array(n).fill(false), seq = [];
    for (let r = 0; r < n; r++) { let k = -1; for (let i = 0; i < n; i++) if (!done[i] && ind[i] === 0) { k = i; break; } if (k < 0) for (let i = 0; i < n; i++) if (!done[i]) { k = i; break; } done[k] = true; seq.push(es[k]); out[k].forEach(j => ind[j]--); }
    const sig = seq.map(e => e.n.id).join(','); if (sig !== lastSig) { lastSig = sig; seq.forEach(e => gWorld.appendChild(e.n.gEl)); }
  }
  const anchorOf = (a, t, P) => { if (Array.isArray(a)) return P(...a); const g = geom(byId[a], t); return P((g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2, g.z1); };
  // ---- public verbs ----------------------------------------------------------------------------------------------------------------
  const w = {
    box(id, s) { add(id, { type: 'box', x: s.x, y: s.y, z: s.z, w: s.w, d: s.d, h: s.h, color: s.color, ghostColor: s.ghostColor || paper, tintColor: EMBER }).faces.forEach(f => f.setAttribute('stroke-width', 1.5)); return w; },
    disc(id, s) { const n = add(id, { type: 'disc', on: s.on, r: s.r ?? .38, color: s.color || paper, ox: s.ox ?? 0, oy: s.oy ?? 0, rate: s.rate ?? 6, spinAt: s.spinAt }); n.bl = el('path', { fill: 'none', 'stroke-width': 2, 'stroke-linecap': 'round' }); n.gEl.appendChild(n.bl); return w; },
    // set(id, prop, at, dur, to, {from, ez}): piecewise eased tracks. props: grow solid ghost dz dx dy tint
    set(id, prop, at, dur, to, s = {}) { const n = byId[id], ks = n.keys[prop] ??= []; if (!ks.length && s.from != null) n.init[prop] = s.from; ks.push({ at, dur, to, from: ks.length ? s.from : undefined, ez: EZ[s.ez] || ease.p3out }); ks.sort((a, c) => a.at - c.at); return w; },
    rise(id, at, dur = .6) { return w.set(id, 'grow', at, dur, 1, { from: 0 }); },                                  // extrude up from 0
    lift(id, at, dur = .7, dz = 2.4) { w.set(id, 'dz', at, dur, dz, { ez: 'p2io' }); return w.set(id, 'solid', at + dur * .35, dur * .65, 0, { ez: 'p2in' }); },   // roof up + fade
    drop(id, at, dur = .45, from = 1.4) { w.set(id, 'dz', at, dur, 0, { from, ez: 'p3out' }); return w.set(id, 'solid', at, dur * .5, 1, { from: 0, ez: 'linear' }); },
    stack(ids, at, s = {}) { ids.forEach((id, i) => w.drop(id, at + i * (s.step ?? .08), s.dur ?? .4, s.drop ?? 1.4)); return w; },   // slabs drop on one by one
    ghost(id, at, dur = .3, s = {}) { w.set(id, 'ghost', at, dur, 1, { from: 0, ez: 'linear' }); return s.until != null ? w.set(id, 'ghost', s.until, s.fade ?? .3, 0, { ez: 'linear' }) : w; },   // dashed outline
    fade(id, at, dur = .3, to = 0) { return w.set(id, 'solid', at, dur, to, { ez: 'linear' }); },
    tint(id, at, color, dur = .3) { if (color) byId[id].tintColor = color; return w.set(id, 'tint', at, dur, 1, { from: 0, ez: 'linear' }); },
    camTo(at, to, s = {}) { camKeys.push({ at, d: s.d ?? .6, to: { x: to.x ?? cam0.x, y: to.y ?? cam0.y, z: to.z ?? cam0.z, zoom: to.zoom ?? 1 }, ez: EZ[s.ease] || ease.p2io }); camKeys.sort((a, c) => a.at - c.at); return w; },
    // flow(p, q, {at, until, color}): dashed airflow line, dashes run p -> q (world points)
    flow(p, q, s = {}) {
      const path = el('path', { fill: 'none', stroke: C[s.color || 'accent2'], 'stroke-width': 3, 'stroke-dasharray': '6 10', 'stroke-linecap': 'round' }); gLead.appendChild(path); const a = s.at ?? 0;
      over.push({ upd: t => { const pr = ease.p3out(prog(t, a, a + .3)) * (1 - (s.until != null ? ease.p2in(prog(t, s.until, s.until + .3)) : 0)); path.style.display = pr <= 0 ? 'none' : ''; path.style.opacity = pr.toFixed(3); const P = projFor(t), A = P(...p), B = P(...q); path.setAttribute('d', `M${pt(A)}L${pt(B)}`); path.style.strokeDashoffset = (-(t - a) * 46).toFixed(1); } }); return w;
    },
    // tag(anchor, text, {at, until, dx, dy, color}): mono-caps chip pinned to a world point or a box id (its top centre), clamped inside the card
    tag(anchor, text, s = {}) {
      const chip = document.createElement('div'); chip.dataset.safe = '1'; const col = C[s.color] || s.color || paper, at = s.at ?? 0, dy = s.dy ?? -70;
      chip.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;font:500 24px/1 "Geist Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:${paper};background:${ink};border:1.5px solid ${col};border-radius:3px;padding:9px 14px 8px;opacity:0`;
      const body = document.createElement('span'); chip.appendChild(body); b.text.appendChild(chip); b.words(s.words ?? text);
      const ln = el('line', { stroke: col, 'stroke-width': 1.5 }), dt = el('circle', { r: 5, fill: col }); gLead.append(ln, dt); let shown = null;
      over.push({ upd: t => {
        const p = ease.p3out(prog(t, at, at + .35)), q = s.until != null ? ease.p2in(prog(t, s.until, s.until + .3)) : 0, op = p * (1 - q);
        chip.style.opacity = op <= 0 ? '0' : op.toFixed(3); ln.style.display = dt.style.display = op <= 0 ? 'none' : ''; ln.style.opacity = dt.style.opacity = op.toFixed(3); if (op <= 0) return;
        const txt = typeof text === 'function' ? text(t) : text; if (txt !== shown) { shown = txt; body.innerHTML = txt; }
        const P = projFor(t), a = anchorOf(anchor, t, P), cw = chip.offsetWidth, ch = chip.offsetHeight, lo = b.box.x - 8;
        const cx = Math.min(W - lo - cw / 2, Math.max(lo + cw / 2, a[0] + (s.dx ?? 0))), top = Math.min(H - 56 - ch, Math.max(66, a[1] + dy - (dy > 0 ? 0 : ch)));
        chip.style.transform = `translate(${(cx - cw / 2).toFixed(1)}px,${(top + (1 - p) * 8).toFixed(1)}px)`;
        ln.setAttribute('x1', f1(a[0])); ln.setAttribute('y1', f1(a[1])); ln.setAttribute('x2', f1(cx)); ln.setAttribute('y2', f1(dy > 0 ? top : top + ch)); dt.setAttribute('cx', f1(a[0])); dt.setAttribute('cy', f1(a[1]));
      } }); return w;
    },
    // counter(anchor, from, to, {at, dur, label, switchAt, to2}): number-counter tag; counts from -> to, then jumps to to2 in the accent colour at switchAt
    counter(anchor, from, to, s = {}) {
      const at = s.at ?? 0, lab = s.label || '', sw = s.switchAt ?? 1e9;
      return w.tag(anchor, t => { const hot = t >= sw, v = hot ? s.to2 : Math.round(lerp(from, to, ease.p3out(prog(t, at + .1, at + .1 + (s.dur ?? .9))))); return `<b style="font-weight:500;color:${hot ? C.accent : paper}">${v}</b> ${lab}`; }, { ...s, at, words: `${to} ${lab}` });
    },
    // ring(anchor, {at, until, r, n, period, color}): radio rings, flat circles in the ground plane that grow from a world point and fade (repeat every period)
    ring(anchor, s = {}) {
      const at = s.at ?? 0, n = s.n ?? 3, per = s.period ?? .9, R = s.r ?? 2.2, col = C[s.color || 'accent2'] || s.color, ps = [];
      for (let i = 0; i < n; i++) { const p = el('path', { fill: 'none', stroke: col, 'stroke-width': 3 }); gLead.appendChild(p); ps.push(p); }
      over.push({ upd: t => { const P = projFor(t), g = Array.isArray(anchor) ? anchor : (() => { const q = geom(byId[anchor], t); return [(q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, q.z1]; })(), off = s.until != null ? 1 - ease.p2in(prog(t, s.until, s.until + .3)) : 1;
        ps.forEach((p, i) => { const lt = t - at - i * per / n; if (lt < 0 || off <= 0) { p.style.display = 'none'; return; } const ph = (lt % per) / per, r = R * ease.p3out(ph), op = (1 - ph) * off * clamp01(lt / .2); const pts = []; for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; pts.push(P(g[0] + r * Math.cos(a), g[1] + r * Math.sin(a), g[2])); } p.style.display = ''; p.setAttribute('d', 'M' + pts.map(pt).join('L') + 'Z'); p.style.opacity = op.toFixed(3); }); } }); return w;
    },
    // check(anchor, {at, dy}): round check badge pinned to a world point
    check(anchor, s = {}) {
      const g = el('g'), at = s.at ?? 0; g.append(el('circle', { r: 20, fill: C.accent2 }), el('polyline', { points: '-9,0 -3,7 10,-8', fill: 'none', stroke: ink, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })); gLead.appendChild(g);
      over.push({ upd: t => { const p = ease.p3out(prog(t, at, at + .35)); g.style.display = p <= 0 ? 'none' : ''; const a = anchorOf(anchor, t, projFor(t)); g.setAttribute('transform', `translate(${f1(a[0])},${f1(a[1] + (s.dy ?? -34))}) scale(${p.toFixed(3)})`); } }); return w;
    },
    cam: camAt, val: (id, prop, t) => val(byId[id], prop, t), anchor: (a, t) => anchorOf(a, t, projFor(t)), ids: () => nodes.map(n => n.id),
    // screen bbox (card-local px) of a node at global time t
    bbox(id, t) { const g = geom(byId[id], t), P = projFor(t), pts = []; for (const x of [g.x0, g.x1]) for (const y of [g.y0, g.y1]) for (const z of [g.z0, g.z1]) pts.push(P(x, y, z)); return { x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1])) }; },
    render(t) {
      const P = projFor(t), es = [];
      for (const n of nodes) { const g = geom(n, t), v = val(n, 'solid', t), gh = val(n, 'ghost', t), vis = (v > .003 || gh > .003) && (n.type === 'disc' ? g.r > .01 && g.pv > .003 : g.z1 - g.z0 > .003); n.gEl.style.display = vis ? '' : 'none'; if (vis) { draw(n, g, v, gh, P, t); es.push({ n, g }); } }
      order(es); over.forEach(it => it.upd(t));
    },
  };
  b.items.push({ upd: lt => w.render(t0 + lt) });
  return w;
}
