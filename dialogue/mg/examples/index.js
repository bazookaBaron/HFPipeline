// Section 12d example beats, written only with the public API. Each: (mg, {at, dur, k}); k scales internal timings (k=1 = real pacing, holds >= 2.5 s).
// `still` = beat-local time where the finished composition makes a good still. International content only (no regional names).
const D = 7;
export const examples = {
  // 1. map zoom + pin: United States -> San Francisco Bay, route to Los Angeles, scale bar + coordinates + edge labels
  map: { still: 6.2, fn: (mg, { at = 0, dur = D, k = 1 }) => mg.beat({ at, dur, tag: 'United States', src: 'Natural Earth', rules: false }, b => {
    const m = b.map({ from: 'US', lat0: 38, view: { c: [-96, 40], h: 33 }, drawAt: .15 * k, drawDur: 1.3 * k, detailAt: 1.2 * k });
    m.region('US', { at: .8 * k, dur: 1.1 * k, fillOpacity: .1 });
    m.zoom({ c: [-121.2, 36.6], h: 8.6 }, { at: 2.3 * k, dur: 1.5 * k });
    m.pin('San Francisco', { label: 'San Francisco · 1937', at: 4.0 * k });
    m.route('San Francisco', 'Los Angeles', { at: 4.5 * k, dur: 1.3 * k, bend: .18 });
    m.pin('Los Angeles', { label: 'Los Angeles', at: 5.5 * k, side: 'left', offset: [60, 40] });
    b.legend([{ kind: 'dot', label: 'Landmark' }, { kind: 'line', label: 'Route' }], { x: b.W / 2 - 110, y: 31, at: 3.4 * k });
    b.caption('The bridge opened in 1937.', { at: 3.6 * k, dur: 3 * k });
  }) },
  // 2. dot-grid compare (reference reel: 3/100 vs 40/100) + legend, ratio chip, mono notes
  dotgrid: { still: 5.2, fn: (mg, { at = 0, dur = D, k = 1 }) => mg.beat({ at, dur, tag: 'Interview rate', src: 'Illustrative data' }, b => {
    b.legend([{ kind: 'dot', label: 'Reached', color: 'paper' }, { kind: 'ring', label: 'Not reached', color: 'muted' }], { x: b.W / 2 - 150, y: 31, at: .9 * k });
    b.at(.5 * k); b.dotGrid({ total: 100, lit: 3, label: 'Apply alone' }).compareWith({ lit: 40, label: 'With a referral' });
    b.chip('13×', { x: b.W / 2 - 38, y: b.H - 148, at: 4.3 * k });
    b.meta('per 100 applicants · reaching an interview', { x: b.W / 2 - 250, y: b.H - 36, w: 500, align: 'center', at: 1.8 * k, parent: b.lines.parentNode });
    b.caption('Forty out of a hundred.', { at: 3.8 * k, dur: 3 * k });
  }) },
  // 3. number count + context (proportional bars on a tick axis)
  number: { still: 5.4, fn: (mg, { at = 0, dur = D, k = 1 }) => mg.beat({ at, dur, tag: 'Golden Gate Bridge', src: 'Public record' }, b => {
    const [top, mid, low] = b.rows([.8, 2.1, 2.5], { gap: 6 }), W3 = 3000, ax = low.x, aw = low.w;
    b.at(.6 * k); b.label('Total length', { box: top, valign: 'center' });
    b.meta('≈ 8,981 ft', { keep: true, x: top.x + top.w - 200, y: top.y + top.h / 2 - 7, w: 200, align: 'right', at: 1.6 * k });
    b.at(.8 * k); b.number(2737, { box: mid, size: 150, unit: 'm', countDur: 1.8 * k, valign: 'center' });
    [[2737, 'Whole bridge', 'paper'], [1280, 'Main span', 'accent']].forEach(([v, lab, c], i) => { const y = low.y + 40 + i * 72, at0 = (2.7 + i * .5) * k;
      b.body(lab, { x: ax, y: y - 40, w: 400, h: 30, size: 22, color: i ? 'accent' : 'muted', at: at0 });
      b.bar({ x: ax, y, w: aw * v / W3, h: 22, fill: c, fillOpacity: i ? 1 : .55, at: at0 + .1 * k });
      b.meta(`${v.toLocaleString('en-US')} m`, { keep: true, x: ax + aw * v / W3 - 120, y: y - 24, w: 120, align: 'right', at: at0 + .8 * k, color: c }); });
    b.ticks({ x: ax, y: low.y + 150, w: aw, n: 12, major: 4, len: 12, side: 'down', at: 3.3 * k, labels: ['0', '1,000', '2,000', '3,000'] });
  }) },
  // 4. timeline (proportional scale, decade ticks)
  timeline: { still: 5.0, fn: (mg, { at = 0, dur = D, k = 1 }) => mg.beat({ at, dur, tag: 'Golden Gate', src: 'Public record' }, b => {
    const tl = b.timeline({ at: .7 * k, drawDur: 2.2 * k, scale: 'time', events: [{ at: 1933, text: 'Construction starts' }, { at: 1937, text: 'Opens to traffic', hl: true }, { at: 1987, text: '50th anniversary walk' }] });
    const by = tl.ay + 190; [[1933, 1937, '4 yrs', 'accent'], [1937, 1987, '50 yrs', 'muted']].forEach(([a, c, lab, col], i) => { const x1 = tl.X(a), x2 = tl.X(c), at0 = (3.3 + i * .6) * k; b.path(`M${x1},${by - 7}v14M${x1},${by}H${x2}M${x2},${by - 7}v14`, { color: col, width: 1.5, at: at0, drawDur: .8 * k }); b.meta(lab, { keep: true, x: (x1 + x2) / 2 - 50, y: by + 14, w: 100, align: 'center', at: at0 + .6 * k, color: col }); });
    b.meta('span · 54 years', { x: b.W / 2 - 150, y: b.H - 36, w: 300, align: 'center', at: 3.4 * k, parent: b.lines.parentNode });
  }) },
  // 5. photo duotone (CC0 Wikimedia image, see CREDITS.md) inside a framed inset
  photo: { still: 5.0, fn: (mg, { at = 0, dur = D, k = 1 }) => mg.beat({ at, dur, tag: 'Golden Gate', src: 'Goldrock95 · CC0', rules: false }, b => {
    b.photo('examples/gg_cc0.jpg', { x: 28, y: 56, w: b.W - 56, h: b.H - 56 - 60, radius: 6, at: .3 * k, duotone: 'accent', dim: .28, pos: '34% 64%', kenBurns: { s: [1.04, 1.1], dx: [0, -14], dy: [0, 8] } });
    b.meta('37.82° N · 122.48° W', { x: 48, y: 76, w: 300, at: 1.3 * k, color: 'paper' });
    b.title('Two towers, 227 m high', { x: 48, y: b.H - 190, w: b.W - 96, h: 100, size: 52, valign: 'bottom', at: 1.5 * k });
    b.underline({ x: 48, y: b.H - 84, w: 200, at: 2.4 * k });
  }) },
  // 6. free-form composition: nothing but primitives (icons, rings, arrows, ticks, mono annotations, underline)
  freeform: { still: 5.8, fn: (mg, { at = 0, dur = D, k = 1 }) => mg.beat({ at, dur, tag: 'The route in', src: 'Illustrative' }, b => {
    const row = b.rect({ y: b.box.y + 30, h: b.box.h - 110 }); const cells = b.cols(3, { box: row, gap: 150 });
    const nodes = [['user', 'You', 'applicant'], ['handshake', 'A friend', 'referrer'], ['building-2', 'Hiring manager', 'decision']];
    const rings = cells.map((c, i) => { const cx = c.x + c.w / 2, cy = c.y + c.h * .42, R = 62, hot = i === 2, a0 = (.7 + i * .6) * k;
      b.meta(`0${i + 1}`, { x: cx - 30, y: cy - R - 34, w: 60, align: 'center', at: a0, color: hot ? 'accent' : 'muted' });
      b.ring({ x: cx, y: cy, r: R + 12, at: a0 + .1 * k, color: 'muted', width: 1, opacity: .5 }); b.ring({ x: cx, y: cy, r: R, at: a0, color: hot ? 'accent' : 'paper' });
      b.icon(nodes[i][0], { x: cx - 30, y: cy - 30, size: 60, color: hot ? 'accent' : 'paper', at: a0 + .25 * k });
      b.body(nodes[i][1], { x: cx - 130, y: cy + R + 28, w: 260, h: 44, align: 'center', at: a0 + .4 * k, color: hot ? 'accent' : 'paper' });
      b.meta(nodes[i][2], { x: cx - 100, y: cy + R + 76, w: 200, align: 'center', at: a0 + .6 * k }); return { x: cx - R, y: cy - R, w: 2 * R, h: 2 * R, cx, cy }; });
    b.arrow(rings[0], rings[1], { at: 1.5 * k, drawDur: .9 * k }); b.arrow(rings[1], rings[2], { at: 2.2 * k, drawDur: .9 * k });
    b.meta('asks', { x: (rings[0].cx + rings[1].cx) / 2 - 40, y: rings[0].cy - 28, w: 80, align: 'center', at: 2.0 * k }); b.meta('refers', { x: (rings[1].cx + rings[2].cx) / 2 - 40, y: rings[0].cy - 28, w: 80, align: 'center', at: 2.7 * k });
    const span = { x: cells[0].x, w: cells[2].x + cells[2].w - cells[0].x }, by = rings[0].cy + 62 + 150;
    b.ticks({ x: span.x, y: by, w: span.w, n: 20, major: 5, len: 10, side: 'down', at: 3.2 * k, drawDur: 1.2 * k });
    b.label('one warm intro', { x: span.x, y: by + 34, w: span.w, h: 30, align: 'center', at: 3.9 * k, color: 'muted' });
    b.underline({ x: cells[2].x + cells[2].w / 2 - 110, y: rings[2].y + rings[2].h + 112, w: 220, at: 4.4 * k });
  }) },
};
export const order = ['map', 'dotgrid', 'number', 'timeline', 'photo', 'freeform'];
// one beat per example, back to back (panel handed off: no exit/enter between them); real pacing
export function chain(mg, { per = D, k = 1 } = {}) { order.forEach((n, i) => examples[n].fn(mg, { at: i * per, dur: per, k })); }
