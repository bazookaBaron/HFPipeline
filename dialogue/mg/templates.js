// DIALOGUE MG template kit: an episode's motion graphics from a short DATA LIST instead of hand-written cues.
//   import { addBeats } from '../../mg/templates.js';   addBeats(mg, beats, { ratio })    // call before `await mg.build()`
// beats = [{ t, tpl, ...fields }]   (t = global episode seconds of the word the beat lands on)
//   flow    { nodes:[label|{label,kind}], step=.9 }                  iso boxes in a row, camera travels node to node, dashed flow line between
//   counter { from, to?, label, switchAt? }                          slab stack drops on, number counts 0 -> from, then jumps to `to` (accent) with one more slab
//   tags    { items:[..], step=.55 }                                 a row of racks, one mono-caps chip per item
//   map     { from, to, route:'undersea'|'air'|'land'|text, dur }    SCHEMATIC two-landmass iso map (no real outlines), packet travels the route
//   image   { src, caption, credit, aspect=1.4 }                     framed still + caption; `credit` is REQUIRED (our own / CC0 only; never real people, never AI images)
//   check   { target, on? }    broken { target?, on?, safe=true }    check badge / ember tint on a rack (or on an earlier node id via `on`)
// common: id (beat key, default b<i>), dur (card length, auto by template), lead (card starts this long before t, .3), title (card header tag)
// Node ids made by templates (usable in `on`): <key>_n<i> (flow), <key>_i<i> (tags), <key>_r<i> (check/broken racks), <key>_c<i> (counter slabs).
// Camera continuity is automatic: every beat's camera key starts where the previous beat's ended. Each beat's camera target + zoom is FITTED so the
// subjects (and room for their chips) sit inside the card, for both 9x16 and 16x9 card sizes. Returns { data, checks, warnings } (render-tpl.mjs checks them).
import { mixHex } from './motion.js';
import { EMBER } from './iso.js';

const SC = 44, K = .55, ZF = Math.sqrt(1 - K * K), CA = Math.SQRT1_2;                 // same projection constants as iso.js
const wc = s => String(s).split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const TITLE = { flow: 'THE PATH', counter: 'THE COUNT', tags: 'WHO', map: 'THE ROUTE', image: 'FIGURE', check: 'CHECK', broken: 'WHEN IT BREAKS' };

export function addBeats(mg, beats, opts = {}) {
  const C = mg.C, warnings = [], warn = m => { warnings.push(m); console.warn('[templates] ' + m); };
  const card = mg.layoutRects('auto').card, cw = card.w, ch = card.h, VY = ch / 2 + 18;   // view centre y (card-local) = iso.js view.y
  const COL = { ground: mixHex(C.ink, C.muted, .22), rack: mixHex(C.muted, C.ink, .12), node: mixHex(C.muted, C.paper, .18), roof: mixHex(C.muted, C.paper, .35), land: mixHex(C.muted, C.ink, .25), water: mixHex(C.ink, C.accent2, .3) };

  // ---- camera fit: target + zoom so the world boxes (plus chip headroom) sit inside the card body ----
  const raw = (x, y, z) => [SC * (x - y) * CA, SC * ((x + y) * CA * K - z * ZF)];
  function fit(boxes, o = {}) {
    const top = o.top ?? 0, bot = o.bot ?? 0, zmax = o.zmax ?? 2, zmin = o.zmin ?? .5;
    const X0 = Math.min(...boxes.map(g => g.x0)), X1 = Math.max(...boxes.map(g => g.x1)), Y0 = Math.min(...boxes.map(g => g.y0)), Y1 = Math.max(...boxes.map(g => g.y1)), Z0 = Math.min(...boxes.map(g => g.z0)), Z1 = Math.max(...boxes.map(g => g.z1));
    const c = [(X0 + X1) / 2, (Y0 + Y1) / 2, (Z0 + Z1) / 2], r0 = raw(...c), pts = [];
    for (const x of [X0, X1]) for (const y of [Y0, Y1]) for (const z of [Z0, Z1]) { const p = raw(x, y, z); pts.push([p[0] - r0[0], p[1] - r0[1]]); }
    const nx = Math.min(...pts.map(p => p[0])), xx = Math.max(...pts.map(p => p[0])), ny = Math.min(...pts.map(p => p[1])), xy = Math.max(...pts.map(p => p[1]));
    const hx = Math.max(1, (xx - nx) / 2), hy = Math.max(1, (xy - ny) / 2), aw = cw - 56, ytop = 70 + top, ybot = ch - 52 - bot, ah = ybot - ytop, ay = (ytop + ybot) / 2 - VY;
    const zoom = Math.max(zmin, Math.min(zmax, .96 * aw / 2 / hx, .96 * ah / 2 / hy));
    const sx = (nx + xx) / 2, sy = (ny + xy) / 2 - ay / zoom;                            // screen shift (zoom 1) that centres the boxes in the usable region
    const sum = sy / (SC * CA * K), dif = sx / (SC * CA);                                // -> world dx+dy, dx-dy
    return { x: +(c[0] + (sum + dif) / 2).toFixed(3), y: +(c[1] + (sum - dif) / 2).toFixed(3), z: +c[2].toFixed(3), zoom: +zoom.toFixed(3) };
  }
  const ext = s => ({ x0: s.x, x1: s.x + s.w, y0: s.y, y1: s.y + s.d, z0: s.z, z1: s.z + s.h });

  // ---- normalise + timing ----
  const list = beats.map((b, i) => ({ ...b, i, key: b.id ?? 'b' + i })).sort((a, c) => a.t - c.t);
  const DUR = {
    flow: b => { const n = b.nodes.length; return Math.max(2.6, n * (b.step ?? .9) + 1.7 + (n > 3 ? .9 : 0)); }, counter: () => 3.0, tags: b => Math.max(2.6, b.items.length * (b.step ?? .55) + 1.9),
    map: b => (b.dur ?? 4.6), image: () => 3.0, check: () => 2.6, broken: () => 3.6,
  };
  list.forEach(b => { if (!DUR[b.tpl]) throw new Error(`templates: unknown tpl "${b.tpl}" (beat t=${b.t})`); b.at = Math.max(0, +(b.t - (b.lead ?? .3)).toFixed(3)); });
  list.forEach((b, i) => { const nx = list[i + 1], want = b.at + (b.dur ?? DUR[b.tpl](b)); b.end = +(nx ? Math.min(want, nx.at) : want).toFixed(3); if (b.end - b.at < 1.5 - 1e-6) warn(`beat ${b.key} (${b.tpl} t=${b.t}): card only ${(b.end - b.at).toFixed(2)} s (< 1.5 s); next beat too close`); });

  // ---- templates: each fills a plan P: nodes (world boxes/discs), tl (global state timeline), ov (this card's overlays), cams, checks ----
  const reg = {};                                                                            // node id -> box spec (for `on`)
  const dropB = (P, id, at) => P.tl.push(w => w.drop(id, at, .4, 1.2));
  const kindOf = label => {
    const L = String(label).toUpperCase();
    if (/CABLE|FIBER|FIBRE|WIRE|SEA/.test(L)) return { parts: [{ w: 2.2, d: .5, h: .35, color: C.accent2 }] };
    if (/TOWER|ANTENNA|MAST/.test(L)) return { parts: [{ w: .5, d: .5, h: 2.8, color: COL.node }, { w: .9, d: .9, h: .25, color: C.accent2, z: 2.8, extra: true }] };
    if (/DATA ?CEN|SERVER|CLOUD|BUILDING|OFFICE/.test(L)) return { parts: [{ w: 2.2, d: 1.6, h: 1.5, color: COL.node }, { w: 2.4, d: 1.8, h: .2, color: COL.roof, z: 1.5, extra: true }] };
    if (/FRIEND|PERSON|USER|PEOPLE|YOU|FAMILY/.test(L)) return { parts: [{ w: .8, d: .8, h: 1.2, color: C.paper }, { w: .55, d: .55, h: .55, color: C.paper, z: 1.2, extra: true }] };
    if (/PHONE|DEVICE|LAPTOP|COMPUTER|TABLET/.test(L)) return { parts: [{ w: .9, d: .55, h: 1.3, color: C.paper }] };
    return { parts: [{ w: 1.3, d: 1.3, h: 1.1, color: COL.node }] };
  };
  const T = {
    flow(P, b, X) {
      const nodes = b.nodes.map(n => typeof n === 'string' ? { label: n } : n), n = nodes.length, step = b.step ?? .9, SP = 3.6, Y = 2.5, tau = i => b.t + i * step, els = [];
      nodes.forEach((nd, i) => {
        const cx = X + 1.2 + i * SP, kind = nd.kind ? kindOf(nd.kind) : kindOf(nd.label), id = `${b.key}_n${i}`, ex = [];
        kind.parts.forEach((p, k) => { const s = { x: cx - p.w / 2, y: Y - p.d / 2, z: p.z ?? 0, w: p.w, d: p.d, h: p.h, color: p.color }, pid = k ? id + 'x' + k : id; P.box(pid, s); (k ? ex : els).push(s); if (!k) reg[id] = s; if (k) P.tl.push(w => w.drop(pid, tau(i) + .25, .4, 1.2)); });
        P.tl.push(w => w.rise(id, tau(i), .5));
        const all = [els[i], ...ex]; els[i] = { main: els[i], ext: { x0: Math.min(...all.map(s => s.x)), x1: Math.max(...all.map(s => s.x + s.w)), y0: Math.min(...all.map(s => s.y)), y1: Math.max(...all.map(s => s.y + s.d)), z0: 0, z1: Math.max(...all.map(s => s.z + s.h)) } };
        const tc = i === n - 1 ? 'accent' : undefined, dy = i % 2 ? 100 : -80, ovT = tau(n - 1) + 1.0 + .35;   // with camera travel (n > 3) a chip is hidden when its node leaves the frame and shown again on the overview
        if (n > 3) { const gone = i + 2 < n ? tau(i + 2) - .3 : undefined; P.ov.push(w => w.tag(id, nd.label, { at: tau(i) + .15, until: gone, dy, color: tc })); if (gone != null) P.ov.push(w => w.tag(id, nd.label, { at: ovT, dy, color: tc, words: '' })); }
        else P.ov.push(w => w.tag(id, nd.label, { at: tau(i) + .15, dy, color: tc })); P.words += wc(nd.label);
        if (i) P.ov.push(w => w.flow([els[i - 1].main.x + els[i - 1].main.w + .15, Y, .1], [els[i].main.x - .15, Y, .1], { at: tau(i) - .05, color: 'accent2' }));
        P.chk(tau(i) + .8, [id]);
      });
      const E = i => els[i].ext, win = i => { const a = Math.max(0, i - 1), z = Math.min(n - 1, i + 1), r = []; for (let k = a; k <= z; k++) r.push(E(k)); return r; }, all = els.map((_, i) => E(i)), fo = { top: 100, bot: 100, zmax: 2 };
      if (n <= 3) P.cam(b.at, .7, all, fo); else { P.cam(b.at, .7, win(0), fo); for (let i = 1; i < n; i++) P.cam(tau(i) - .15, .6, win(i), fo); P.cam(tau(n - 1) + 1.0, .7, all, fo); P.chk(b.end - .3, els.map((_, i) => `${b.key}_n${i}`)); }
      if (n <= 3) P.chk(b.end - .3, els.map((_, i) => `${b.key}_n${i}`));
      P.width = (n - 1) * SP + 2.6;
    },
    counter(P, b, X) {
      const from = b.from ?? 0, to = b.to, lab = b.label || '', nb = Math.min(8, Math.max(2, Math.round(from))), extra = to != null && to !== from, sw = b.switchAt ?? b.t + 1.1, ids = [];
      const ped = { x: X, y: .9, z: 0, w: 1.5, d: 1.1, h: 1.0, color: COL.rack }; P.box(`${b.key}_ped`, ped); P.tl.push(w => w.rise(`${b.key}_ped`, b.t - .1, .4));
      const bx = [ext(ped)], slab = (i, accent) => ({ x: X + .1, y: 1.0, z: 1.0 + (i - 1) * .17, w: 1.3, d: .9, h: .16, color: accent ? C.accent : (i % 2 ? C.paper : mixHex(C.paper, C.accent2, .35)) });
      for (let i = 1; i <= nb; i++) { const id = `${b.key}_c${i}`, s = slab(i); P.box(id, s); reg[id] = s; bx.push(ext(s)); ids.push(id); P.tl.push(w => w.drop(id, b.t + (i - 1) * .05, .4, 1.4)); }
      if (extra) { const s = slab(nb + 1, true); P.box(`${b.key}_cx`, s); bx.push(ext(s)); ids.push(`${b.key}_cx`); P.tl.push(w => w.drop(`${b.key}_cx`, sw, .45, 1.8)); }
      P.ov.push(w => w.counter(`${b.key}_c${nb}`, 0, from, { at: b.t - .1, dur: .8, label: lab, switchAt: extra ? sw : undefined, to2: to, dy: -95 })); P.words += wc(`${extra ? to : from} ${lab}`);
      P.cam(b.at, .7, bx, { top: 120, zmax: 2.2 }); P.chk(b.t + 1.0, [`${b.key}_ped`, `${b.key}_c${nb}`]); if (extra) P.chk(sw + 1.0, [`${b.key}_ped`, `${b.key}_cx`]); P.chk(b.end - .3, [`${b.key}_ped`, ids[ids.length - 1]]);
      P.width = 3;
    },
    tags(P, b, X) {
      const it = b.items, n = it.length, step = b.step ?? .55, D = 1.5, Y0 = 1.0 + (n - 1) * D, RK = { w: 1.4, d: 1.0, h: 1.7 }, L = n > 4 ? 3 : 2, lv = [-80, -150, -220], bx = [], ids = [];
      it.forEach((label, i) => {
        const id = `${b.key}_i${i}`, s = { x: X + i * D, y: Y0 - i * D, z: 0, ...RK, color: COL.rack }; P.box(id, s); reg[id] = s; bx.push(ext(s)); ids.push(id);
        P.tl.push(w => w.rise(id, b.t + i * step - .1, .5)); P.ov.push(w => w.tag(id, label, { at: b.t + i * step, dy: lv[i % L] })); P.words += wc(label);
      });
      P.cam(b.at, .7, bx, { top: 70 + L * 70, zmax: 1.9 }); P.chk(b.t + n * step + .3, ids); P.chk(b.end - .3, ids); P.width = (n - 1) * D + 2;
    },
    map(P, b, X) {
      const route = b.route || 'undersea', rt = b.t + (b.routeAt ?? .8), rd = b.routeDur ?? 1.6, Ym = 2.8, ids = [], bx = [];
      const land = (id, s, at) => { P.box(id, { ...s, z: 0, h: .4, color: COL.land }); const e = ext({ ...s, z: 0, h: .4 }); bx.push(e); ids.push(id); P.tl.push(w => w.rise(id, at, .5)); };
      if (route !== 'land') { P.box(`${b.key}_sea`, { x: X + 5.5, y: -.8, z: 0, w: 7, d: 7, h: .12, color: COL.water }); P.tl.push(w => w.rise(`${b.key}_sea`, b.t - .1, .5)); }
      land(`${b.key}_la`, { x: X, y: .2, w: 5.5, d: 4.8 }, b.t); land(`${b.key}_la2`, { x: X + .8, y: -.7, w: 2.6, d: .9 }, b.t + .1);
      land(`${b.key}_lb`, { x: X + 12.5, y: .6, w: 5.5, d: 4.8 }, b.t + .15); land(`${b.key}_lb2`, { x: X + 14.6, y: 5.4, w: 2.4, d: 1.0 }, b.t + .25);
      const cA = { x: X + 4.5, y: Ym - .3, z: .4, w: .6, d: .6, h: .9, color: C.accent }, cB = { x: X + 12.9, y: Ym - .3, z: .4, w: .6, d: .6, h: .9, color: C.accent };
      P.box(`${b.key}_ca`, cA); P.box(`${b.key}_cb`, cB); bx.push(ext(cA), ext(cB)); ids.push(`${b.key}_ca`, `${b.key}_cb`);
      P.tl.push(w => w.drop(`${b.key}_ca`, b.t + .35, .4, 1.2), w => w.drop(`${b.key}_cb`, b.t + .5, .4, 1.2));
      const pk = { x: cA.x + .05, y: cA.y + .05, z: .4, w: .5, d: .5, h: .35, color: C.paper }, dxm = cB.x - cA.x; P.box(`${b.key}_pk`, pk); ids.push(`${b.key}_pk`);
      const air = route === 'air';
      P.tl.push(w => { w.set(`${b.key}_pk`, 'solid', rt - .05, .15, 1, { from: 0, ez: 'linear' }); w.set(`${b.key}_pk`, 'dx', rt, rd, dxm, { from: 0, ez: 'p2io' }); if (air) { w.set(`${b.key}_pk`, 'dz', rt, rd / 2, 2.6, { from: 0, ez: 'p2io' }); w.set(`${b.key}_pk`, 'dz', rt + rd / 2, rd / 2, 0, { ez: 'p2io' }); } w.fade(`${b.key}_pk`, rt + rd + .5, .3); });
      const p0 = [cA.x + .8, Ym, air ? 1.4 : .25], p1 = [cB.x - .2, Ym, air ? 1.4 : .25], mid = [(p0[0] + p1[0]) / 2, Ym, air ? 3.6 : .25];
      P.ov.push(w => { w.tag(`${b.key}_ca`, String(b.from), { at: b.t + .45, dy: -85 }); w.tag(`${b.key}_cb`, String(b.to), { at: b.t + .6, dy: -85, color: 'accent' }); });
      if (air) P.ov.push(w => { w.flow(p0, mid, { at: rt, color: 'accent2' }); w.flow(mid, p1, { at: rt + rd / 2, color: 'accent2' }); }); else P.ov.push(w => w.flow(p0, p1, { at: rt, color: 'accent2' }));
      const lab = route === 'undersea' ? 'UNDERSEA CABLE' : route.toUpperCase(); P.ov.push(w => w.tag(mid, lab, { at: rt + .2, dy: 110, color: 'accent2' }));
      P.words += wc(b.from) + wc(b.to) + wc(lab); P.cam(b.at, .7, bx, { top: 110, bot: 130, zmax: 1.5 }); P.chk(b.t + 1.0, ids.filter(i => !i.endsWith('_pk'))); P.chk(b.end - .3, ids.filter(i => !i.endsWith('_pk'))); P.width = 18;
    },
    image(P, b) {
      if (!b.credit) throw new Error(`templates: image beat ${b.key} needs "credit" (our own art or CC0; never real people / AI images)`);
      P.words += wc(b.caption || ''); P.noWorld = true;
      P.custom = bb => {
        const a = b.aspect ?? 1.4, bw = bb.box.w, bh = bb.box.h - 80, w = Math.min(bw - 28, bh * a), h = w / a, x = bb.box.x + (bw - w) / 2, y = bb.box.y + 6, at = bb.take(0), pad = 9;
        const fr = document.createElement('div'); fr.style.cssText = `position:absolute;left:${x - pad}px;top:${y - pad}px;width:${w + 2 * pad}px;height:${h + 2 * pad}px;background:${C.paper};box-shadow:0 18px 40px rgba(0,0,0,.45);opacity:0;border-radius:2px`; bb.media.appendChild(fr);
        const E = (p => p * p * (3 - 2 * p)); bb.items.push({ upd: t => { const p = Math.min(1, Math.max(0, (t - at) / .5)); fr.style.opacity = E(p).toFixed(3); fr.style.transform = `scale(${(.96 + .04 * E(p)).toFixed(4)})`; } });
        bb.photo(b.src, { x, y, w, h, duotone: false, dim: 0, at, base: b.base });
        if (b.caption) bb.label(b.caption, { x: bb.box.x, y: y + h + pad + 14, w: bw, h: 56, align: 'center', size: 26, color: 'paper', at: at + .3 });
      };
    },
    check(P, b, X) { rackScene(P, b, X, false); }, broken(P, b, X) { rackScene(P, b, X, true); },
  };
  function rackScene(P, b, X, broken) {
    const lab = String(b.target ?? (broken ? 'OFFLINE' : 'OK')), RK = { w: 1.4, d: 1.0, h: 1.7 }, ember = EMBER;
    if (b.on) {                                                                                // act on a node made by an earlier beat
      const s = reg[b.on]; if (!s) throw new Error(`templates: beat ${b.key}: on="${b.on}" is not a known node id (beats must come earlier)`); P.refId = b.on;
      if (broken) P.tl.push(w => w.tint(b.on, b.t)); else P.ov.push(w => w.check(b.on, { at: b.t, dy: -34 }));
      P.ov.push(w => w.tag(b.on, lab, { at: b.t + .15, dy: -110, color: broken ? ember : 'accent2' })); P.words += wc(lab); P.cam(b.at, .7, [ext(s)], { top: 150, zmax: 2.2 }); P.chk(b.t + 1.0, [b.on]); P.chk(b.end - .3, [b.on]); P.width = 0; return;
    }
    const R = [0, 1, 2].map(i => ({ id: `${b.key}_r${i}`, s: { x: X + i * 3, y: 3.6 - i * 1.5, z: 0, ...RK, color: COL.rack } })), ti = b.index ?? 0;
    R.forEach((r, i) => { P.box(r.id, r.s); reg[r.id] = r.s; P.tl.push(w => w.rise(r.id, b.t - .1 + i * .1, .5)); });
    const tgt = R[ti].id; if (broken) P.tl.push(w => w.tint(tgt, b.t + .5)); P.ov.push(w => w.tag(tgt, lab, { at: b.t + (broken ? .5 : .2), dy: -110, color: broken ? ember : 'accent2' })); P.words += wc(lab);
    if (!broken) P.ov.push(w => w.check(tgt, { at: b.t + .25, dy: -34 }));
    if (broken && b.safe !== false) R.forEach((r, i) => { if (i !== ti) P.ov.push(w => w.check(r.id, { at: b.t + 1.5, dy: -34 })); });
    P.cam(b.at, .7, R.map(r => ext(r.s)), { top: 150, zmax: 2 }); const ids = R.map(r => r.id); P.chk(b.t + 1.0, ids); P.chk(b.end - .3, ids); P.width = 9;
  }

  // ---- compile every beat ----
  let X = 0; const plans = list.map(b => {
    const P = { b, nodes: [], tl: [], ov: [], cams: [], checks: [], words: 0, width: 0,
      box: (id, s) => P.nodes.push({ id, s }), chk: (t, ids) => P.checks.push({ t: +t.toFixed(3), ids }), cam: (at, d, boxes, o) => P.cams.push({ at, d, boxes, o }) };
    T[b.tpl](P, b, X); if (P.width) X += P.width + 4;
    if (P.words > 12) warn(`beat ${b.key} (${b.tpl} t=${b.t}): ${P.words} words (max 12 per card)`);
    return P;
  });
  // camera keys: global, in order, never overlapping (each travel starts where the previous one ended)
  const keys = []; let prevEnd = -1;
  for (const P of plans) for (const c of P.cams) { const at = Math.max(c.at, prevEnd), to = fit(c.boxes, c.o); keys.push({ at: +at.toFixed(3), d: c.d, to, beat: P.b.i }); prevEnd = at + c.d; }
  const cam0 = keys.length ? keys[0].to : { x: 0, y: 0, z: 0, zoom: 1 };
  const allNodes = plans.flatMap(P => P.nodes), gx0 = Math.min(0, ...allNodes.map(n => n.s.x)) - 4, gx1 = Math.max(10, ...allNodes.map(n => n.s.x + n.s.w)) + 4, gy0 = Math.min(-4, ...allNodes.map(n => n.s.y)) - 3, gy1 = Math.max(8, ...allNodes.map(n => n.s.y + n.s.d)) + 4;

  const CHECKS = plans.flatMap((P, pi) => P.noWorld ? [] : P.checks.map(c => ({ cue: P.b.i + 1, t: c.t, ids: c.ids })));
  const DATA = { episode: opts.episode ?? 'tpl', ratio: opts.ratio ?? mg.ratio, layout: 'stack', camEase: 'power2.inOut', camTravel: .7, cam0,
    cues: plans.map(P => ({ id: P.b.i + 1, name: (P.b.title ?? TITLE[P.b.tpl]), tpl: P.b.tpl, at: P.b.at, end: P.b.end, cam: keys.filter(k => k.beat === P.b.i).map(k => ({ at: k.at, d: k.d, to: k.to })), beats: [{ t: P.b.t, word: P.b.word ?? '', verb: P.b.tpl }], tags: [] })) };

  mg.iso = { worlds: [], DATA, CHECKS };
  function world(b, P) {
    const w = b.iso({ t0: P.b.at, cam: cam0, S: SC });
    w.box('ground', { x: gx0, y: gy0, z: -.3, w: gx1 - gx0, d: gy1 - gy0, h: .3, color: COL.ground });
    for (const Q of plans) for (const n of Q.nodes) w.box(n.id, n.s);
    for (const k of keys) w.camTo(k.at, k.to, { d: k.d });
    for (const Q of plans) for (const f of Q.tl) f(w);
    for (const f of P.ov) f(w);
    return w;
  }
  for (const P of plans) {
    const spec = { at: P.b.at, dur: +(P.b.end - P.b.at).toFixed(3), layout: 'auto', tag: P.b.title ?? TITLE[P.b.tpl] };
    if (P.custom) mg.beat(spec, b => P.custom(b)); else mg.beat(spec, b => { mg.iso.worlds.push({ cue: P.b.i + 1, at: P.b.at, w: world(b, P), W: b.W, H: b.H }); });
  }
  return { data: DATA, checks: CHECKS, warnings };
}
