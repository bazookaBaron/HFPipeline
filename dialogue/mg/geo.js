// Geo primitive: Natural Earth admin-0 / admin-1 -> equirectangular (cos-lat scaled) SVG map with camera, regions, pins, routes.
import { clamp01, prog, ease, lerp, hexA } from './motion.js';
const NS = 'http://www.w3.org/2000/svg';
const CODES = {}, ADMIN1 = {}; const ALIAS = { usa: 'US', 'united states': 'US', america: 'US' };
export const PLACES = { 'San Francisco': [-122.42, 37.77], 'Los Angeles': [-118.24, 34.05], 'New York': [-74.0, 40.71], Chicago: [-87.63, 41.88], Seattle: [-122.33, 47.61], Miami: [-80.19, 25.76], Houston: [-95.37, 29.76], Washington: [-77.04, 38.91], 'Mexico City': [-99.13, 19.43], Toronto: [-79.38, 43.65], Vancouver: [-123.12, 49.28], Havana: [-82.37, 23.11], 'Golden Gate': [-122.48, 37.82] };

const polys = f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);
function entry(id, name, f) {
  const P = polys(f); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const poly of P) for (const ring of poly) for (const [x, y] of ring) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { id, name, polys: P, bbox: [x0, y0, x1, y1], dcache: {} };
}
// Builds the id -> region registry. geo = {countries, admin1:[geojson...]} (parsed GeoJSON objects).
export function buildRegistry(geo) {
  const reg = new Map(); const add = e => { reg.set(e.id, e); reg.set(e.name.toLowerCase(), e); };
  for (const f of geo.countries?.features || []) add(entry(f.properties.id || CODES[f.properties.name] || f.properties.name, f.properties.name, f)); for (const k in ALIAS) if (reg.has(ALIAS[k])) reg.set(k, reg.get(ALIAS[k]));
  for (const g of geo.admin1 || []) for (const f of g.features) add(entry(f.properties.id || ADMIN1[f.properties.name] || f.properties.name, f.properties.name, f));
  return reg;
}
export async function loadGeo(base, geo) {
  const get = async x => (typeof x === 'string' ? (await fetch(new URL(x, base))).json() : x);
  const g = geo || {}; const countries = await get(g.countries || 'data/americas.geojson');
  const admin1 = await Promise.all((g.admin1 || []).map(get));
  return buildRegistry({ countries, admin1 });
}
const pathD = (e, C) => e.dcache[C] ??= e.polys.map(poly => poly.map(r => 'M' + r.map(([x, y]) => `${(x * C).toFixed(3)},${(-y).toFixed(3)}`).join('L') + 'Z').join('')).join('');
const svgEl = (tag, at = {}) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };

// b = beat builder (provides b.C palette, b.media layer, b.items, b.nextAt, b.res, b.reg, b.W/H)
export function makeMap(b, o = {}) {
  const reg = b.reg; if (!reg) throw new Error('map: geo registry not loaded');
  const get = id => { const e = reg.get(id) || reg.get(String(id).toLowerCase()); if (!e) throw new Error('map: unknown region ' + id); return e; };
  const R = o.box || { x: 10, y: 10, w: b.W - 20, h: b.H - 20 }; const w = R.w, h = R.h, aspect = w / h;
  const fromE = get(o.from || o.focus || 'US'); const lat0 = o.lat0 ?? (fromE.bbox[1] + fromE.bbox[3]) / 2; const C = Math.cos(lat0 * Math.PI / 180);
  const host = document.createElement('div'); host.className = 'mg-map'; Object.assign(host.style, { overflow: 'hidden', borderRadius: '6px', left: R.x + 'px', top: R.y + 'px', width: w + 'px', height: h + 'px' }); b.media.appendChild(host);
  const svg = svgEl('svg', { xmlns: NS }); svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; host.appendChild(svg);
  const ov = svgEl('svg'); ov.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible'; host.appendChild(ov);
  const pinHost = document.createElement('div'); pinHost.style.cssText = 'position:absolute;inset:0'; host.appendChild(pinHost);
  const fit = (id, pad = 1.5) => { const e = get(id), [x0, y0, x1, y1] = e.bbox; return { c: [(x0 + x1) / 2, (y0 + y1) / 2], h: Math.max(y1 - y0, (x1 - x0) * C / aspect) * pad }; };
  const v0 = o.view ? { c: o.view.c, h: o.view.h } : fit(o.from || o.focus || 'US', o.pad0 ?? 1.15);
  const moves = []; const zoomAt = o.zoomAt ?? 1.15;
  const m = { host };
  m.zoom = (to, z = {}) => { const v = typeof to === 'string' ? fit(to, z.pad ?? 1.5) : to.c ? to : { c: to, h: z.h || 8 }; moves.push({ at: z.at ?? b.take(0), dur: z.dur ?? 1.05, to: v }); moves.sort((a, c) => a.at - c.at); return m; };
  m.pan = (c, z = {}) => m.zoom({ c, h: z.h ?? (moves.length ? moves[moves.length - 1].to.h : v0.h) }, z);
  const camAt = t => { let cur = v0; for (const mv of moves) { const p = ease.p2io(prog(t, mv.at, mv.at + mv.dur)); if (p <= 0) break; if (p >= 1) { cur = mv.to; continue; } return { c: [lerp(cur.c[0], mv.to.c[0], p), lerp(cur.c[1], mv.to.c[1], p)], h: Math.exp(lerp(Math.log(cur.h), Math.log(mv.to.h), p)) }; } return cur; };
  const strokes = []; // {el, sw(px), op, a, d(dur), kind}
  const addPath = (d, stroke, sw, op, at, dur) => { const p = svgEl('path', { d, fill: 'none', stroke, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', pathLength: 1 }); p.style.strokeDasharray = '1 1'; svg.appendChild(p); const s = { el: p, sw, op, at, dur }; strokes.push(s); return s; };
  const dAt = o.drawAt ?? 0.1, dDur = o.drawDur ?? 1.1;
  // graticule every 5 deg (muted, faint)
  if (o.graticule !== false) { let gd = ''; const [bx0, by0, bx1, by1] = [-175, -75, -45, 5]; for (let lon = -170; lon <= -50; lon += 5) gd += `M${(lon * C).toFixed(2)},${-75}L${(lon * C).toFixed(2)},${-5}`; for (let lat = 5; lat <= 75; lat += 5) gd += `M${(bx0 * C).toFixed(2)},${-lat}L${(bx1 * C).toFixed(2)},${-lat}`; addPath(gd, b.C.muted, 0.8, 0.22, dAt, dDur - 0.1); }
  const lands = []; host.style.background = hexA(b.C.accent2, .05);
  const seen = new Set();
  for (const e of reg.values()) { if (seen.has(e.id) || e.id.includes('-')) continue; seen.add(e.id); const prim = e === fromE; const lf = svgEl('path', { d: pathD(e, C), fill: b.C.muted, 'fill-opacity': 0, stroke: 'none' }); svg.appendChild(lf); lands.push({ lf, at: (prim ? dAt + 0.1 : dAt + 0.15) + .4, prim }); addPath(pathD(e, C), prim ? b.C.paper : b.C.muted, prim ? 2.2 : 1.3, prim ? 1 : 0.62, prim ? dAt + 0.1 : dAt + 0.15, prim ? dDur - 0.15 : dDur); }
  const regions = [];
  m.region = (id, r = {}) => { const e = get(id), d = pathD(e, C); const at = r.at ?? zoomAt + 0.35, dur = r.dur ?? 0.9;
    const fill = svgEl('path', { d, fill: b.C.accent, 'fill-opacity': 0, stroke: 'none' }); svg.appendChild(fill); const s = addPath(d, b.C.paper, 2.4, 1, at, dur); regions.push({ fill, at: at + dur * 0.6, dur: 0.7, fo: r.fillOpacity ?? 0.2, none: r.fill === false }); return m; };
  if (o.focus && o.focus !== (o.from || '')) { m.zoom(o.focus, { at: zoomAt, pad: o.pad ?? 1.5 }); m.region(o.focus); } else if (o.focus) m.region(o.focus, { at: dAt + 0.6 });
  // pins + route
  const pins = [], routes = [];
  const ll = p => (typeof p === 'string' ? (PLACES[p] || (() => { throw new Error('map: unknown place ' + p); })()) : p);
  m.pin = (where, p = {}) => { const at = p.at ?? b.take(0.1); const lonlat = ll(where); const name = p.label ?? (typeof where === 'string' ? where : '');
    const el = document.createElement('div'); el.className = 'mg-pin'; el.innerHTML = '<i class="ring"></i><i class="dot"></i>'; pinHost.appendChild(el);
    const lb = document.createElement('div'); lb.className = 'mg-pinlabel'; const parts = name.split(' · '); lb.textContent = parts[0]; if (parts[1]) { const s = document.createElement('span'); s.textContent = ' · ' + parts.slice(1).join(' · '); lb.appendChild(s); } if (!name) lb.style.display = 'none'; if (p.size) lb.style.fontSize = p.size + 'px'; pinHost.appendChild(lb); b.words(name.replace(/ · /g, ' '));
    const ln = svgEl('line', { stroke: b.C.paper, 'stroke-width': 1.5 }); ov.appendChild(ln); pins.push({ lonlat, at, el, lb, ln, ring: el.querySelector('.ring'), dot: el.querySelector('.dot'), side: p.side, off: p.offset || [70, -110], until: p.until }); return m; };
  m.route = (a, c, r = {}) => { const A = ll(a), B = ll(c), at = r.at ?? b.take(0.2), dur = r.dur ?? 1.2; const p = svgEl('path', { fill: 'none', stroke: b.C.accent, 'stroke-linecap': 'round', pathLength: 1 }); p.style.strokeDasharray = '1 1'; svg.appendChild(p);
    const lead = document.createElement('i'); lead.className = 'mg-lead'; pinHost.appendChild(lead); routes.push({ A, B, p, lead, at, dur, bend: r.bend ?? 0.25 }); return m; };
  const proj = (lonlat, v, ww, hh) => { const vh = v.h, vw = vh * ww / hh; return [((lonlat[0] * C) - (v.c[0] * C - vw / 2)) / vw * ww, ((-lonlat[1]) - (-v.c[1] - vh / 2)) / vh * hh]; };
  // detail layer: lat/lon edge labels, centre-coordinate readout, scale bar (all follow the camera)
  const mk = () => { const e = document.createElement('div'); e.className = 'mg-meta'; e.style.fontSize = '12px'; e.style.opacity = 0; pinHost.appendChild(e); return e; };
  const latL = [...Array(7)].map(mk), lonL = [...Array(7)].map(mk), coord = mk(), sbl = mk(); Object.assign(coord.style, { right: '24px', top: '62px', fontSize: '13px' }); sbl.style.textAlign = 'center';
  const edge = svgEl('path', { fill: 'none', stroke: b.C.muted, 'stroke-width': 1.2, opacity: .8 }), sbar = svgEl('path', { fill: 'none', stroke: b.C.paper, 'stroke-width': 1.6 }); ov.append(edge, sbar);
  const nice = (min, arr) => arr.find(v => v >= min) ?? arr[arr.length - 1]; const dm = (v, p, n) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? p : n}`;
  const detail = (t, v, ppu, vw) => { const e = ease.p3out(prog(t, o.detailAt ?? 1.3, (o.detailAt ?? 1.3) + .6)); let d = '';
    const ls = nice(70 / ppu, [.5, 1, 2, 5, 10, 20]); let i = 0; for (let lat = Math.ceil((v.c[1] - v.h / 2) / ls) * ls; lat <= v.c[1] + v.h / 2 && i < 7; lat += ls, i++) { const y = ((-lat) - (-v.c[1] - v.h / 2)) / v.h * h; if (y < 60 || y > h - 70) { latL[i].style.opacity = 0; continue; } d += `M0,${y.toFixed(1)}h9`; Object.assign(latL[i].style, { left: '14px', top: (y - 6).toFixed(1) + 'px', opacity: e * .9 }); latL[i].textContent = dm(lat, 'N', 'S'); }
    for (; i < 7; i++) latL[i].style.opacity = 0;
    const lonStep = nice(110 / (ppu * C), [.5, 1, 2, 5, 10, 20]); i = 0; const x0 = v.c[0] - vw / (2 * C); for (let lon = Math.ceil(x0 / lonStep) * lonStep; lon <= v.c[0] + vw / (2 * C) && i < 7; lon += lonStep, i++) { const x = ((lon * C) - (v.c[0] * C - vw / 2)) / vw * w; if (x < 110 || x > w - 130) { lonL[i].style.opacity = 0; continue; } d += `M${x.toFixed(1)},${h - 62}v-8`; Object.assign(lonL[i].style, { left: (x - 30).toFixed(1) + 'px', top: (h - 58) + 'px', width: '60px', textAlign: 'center', opacity: e * .9 }); lonL[i].textContent = dm(lon, 'E', 'W'); }
    for (; i < 7; i++) lonL[i].style.opacity = 0; edge.setAttribute('d', d); edge.style.opacity = e;
    coord.textContent = `${dm(v.c[1], 'N', 'S')}  ${dm(v.c[0], 'E', 'W')}`; coord.style.opacity = e;
    const km = nice(90 * 111.19 / ppu, [5, 10, 20, 50, 100, 200, 500, 1000, 2000]), L = km / 111.19 * ppu, sx = w - 34 - L, sy = h - 96; sbar.setAttribute('d', `M${sx},${sy}h${L}M${sx},${sy - 6}v12M${sx + L},${sy - 6}v12`); sbar.style.opacity = e; Object.assign(sbl.style, { left: (sx - 20) + 'px', top: (sy + 12) + 'px', width: (L + 40) + 'px', opacity: e }); sbl.textContent = `${km} km`; };
  const placed = []; // pin ids placed in order; labels flip to stay inside
  b.items.push({ upd(t) {
    const v = camAt(t), vh = v.h, vw = vh * w / h; svg.setAttribute('viewBox', `${(v.c[0] * C - vw / 2).toFixed(3)} ${(-v.c[1] - vh / 2).toFixed(3)} ${vw.toFixed(3)} ${vh.toFixed(3)}`); const ppu = h / vh; detail(t, v, ppu, vw);
    for (const s of strokes) { const p = ease.p2io(prog(t, s.at, s.at + s.dur)); s.el.style.strokeDashoffset = String(1 - p); s.el.setAttribute('stroke-width', (s.sw / ppu).toFixed(4)); s.el.setAttribute('stroke-opacity', s.op); s.el.style.display = p <= 0 ? 'none' : ''; }
    for (const L of lands) L.lf.setAttribute('fill-opacity', ((L.prim ? .0 : .13) * ease.p2io(prog(t, L.at, L.at + .9))).toFixed(3));
    for (const r of regions) r.fill.setAttribute('fill-opacity', r.none ? 0 : (r.fo * ease.p2io(prog(t, r.at, r.at + r.dur))).toFixed(3));
    for (const r of routes) { const [ax, ay] = proj(r.A, v, w, h), [bx, by] = proj(r.B, v, w, h); // route in projected map units so it follows the camera
      const u = (ll => [ll[0] * C, -ll[1]]); const a = u(r.A), c = u(r.B); const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, dx = c[0] - a[0], dy = c[1] - a[1]; const cx = mx - dy * r.bend, cy = my + dx * r.bend;
      r.p.setAttribute('d', `M${a[0].toFixed(3)},${a[1].toFixed(3)}Q${cx.toFixed(3)},${cy.toFixed(3)} ${c[0].toFixed(3)},${c[1].toFixed(3)}`); const p = ease.p2io(prog(t, r.at, r.at + r.dur));
      r.p.style.strokeDashoffset = String(1 - p); r.p.setAttribute('stroke-width', (2.4 / ppu).toFixed(4)); r.p.style.display = p <= 0 ? 'none' : '';
      const q = 1 - p, qx = q * q * a[0] + 2 * q * p * cx + p * p * c[0], qy = q * q * a[1] + 2 * q * p * cy + p * p * c[1]; const sx = ((qx - (v.c[0] * C - vw / 2)) / vw) * w, sy = ((qy - (-v.c[1] - vh / 2)) / vh) * h; r.lead.style.cssText = `left:${sx}px;top:${sy}px;opacity:${p > 0 ? 1 : 0}`; }
    for (const P of pins) { const [sx, sy] = proj(P.lonlat, v, w, h); const pp = ease.p3out(prog(t, P.at, P.at + 0.5)); const ex = P.until != null ? ease.p2in(prog(t, P.until, P.until + 0.4)) : 0; const vis = (1 - ex);
      P.el.style.cssText = `left:${sx}px;top:${sy - 14 * (1 - pp)}px;opacity:${pp * vis}`; P.dot.style.transform = `scale(${0.6 + 0.4 * pp})`;
      const rp = prog(t, P.at + 0.05, P.at + 0.8); P.ring.style.transform = `scale(${1 + 2.2 * ease.p3out(rp)})`; P.ring.style.opacity = rp <= 0 ? 0 : 1 - rp;
      const lp = ease.p3out(prog(t, P.at + 0.3, P.at + 0.9)) * vis; const lw = P.lb.offsetWidth || 230, lh = P.lb.offsetHeight || 56; let lx = sx + P.off[0], ly = sy + P.off[1];
      if (P.side === 'left') lx = sx - P.off[0] - lw; if (lx + lw > w - 20) lx = sx - Math.abs(P.off[0]) - lw; if (lx < 20) lx = 20; if (ly < 70) ly = sy + Math.abs(P.off[1]) * 0.55; if (ly + lh > h - 20) ly = h - 20 - lh;
      P.lb.style.left = lx + 'px'; P.lb.style.top = (ly + 10 * (1 - lp)) + 'px'; P.lb.style.opacity = lp;
      const ex2 = lx > sx ? lx : lx + lw, ey = ly + lh / 2; P.ln.setAttribute('x1', sx); P.ln.setAttribute('y1', sy - 11); P.ln.setAttribute('x2', sx + (ex2 - sx) * lp); P.ln.setAttribute('y2', (sy - 11) + (ey - (sy - 11)) * lp); P.ln.setAttribute('opacity', lp > 0 ? 1 : 0); }
  } });
  m.project = (lonlat, t) => proj(ll(lonlat), camAt(t), w, h);
  return m;
}
